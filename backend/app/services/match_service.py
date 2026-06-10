from collections.abc import Iterable
from datetime import datetime, timedelta
from functools import cmp_to_key
from typing import Any, cast

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import Match, Prediction, TournamentPrediction, User
from app.services.api_sports import APISportsClient


def calculate_points(pred_home: int, pred_away: int, real_home: int, real_away: int) -> int:
    """Calculate points based on predictions and actual scores."""
    if pred_home == real_home and pred_away == real_away:
        return 3  # Exact score

    # Correct outcome (win/lose/draw)
    pred_diff = pred_home - pred_away
    real_diff = real_home - real_away
    if (
        (pred_diff > 0 and real_diff > 0)
        or (pred_diff < 0 and real_diff < 0)
        or (pred_diff == 0 and real_diff == 0)
    ):
        return 1

    return 0


def compare_teams(a: dict[str, Any], b: dict[str, Any]) -> int:
    if b["points"] != a["points"]:
        return int(b["points"] - a["points"])
    if b["goalDiff"] != a["goalDiff"]:
        return int(b["goalDiff"] - a["goalDiff"])
    if b["goalsFor"] != a["goalsFor"]:
        return int(b["goalsFor"] - a["goalsFor"])
    if a["team"] < b["team"]:
        return -1
    if a["team"] > b["team"]:
        return 1
    return 0


def resolve_bracket_teams(
    matches: list[Match],
    scores_map: dict[int, tuple[int | None, int | None]],
    penalty_winners_map: dict[int, bool | None]
) -> dict[int, dict[str, str]]:
    # 1. Calculate Group Standings
    group_standings: dict[str, dict[str, dict[str, Any]]] = {}
    for m in matches:
        if m.stage == "group" and m.group:
            g = m.group
            if g not in group_standings:
                group_standings[g] = {}
            if m.home_team not in group_standings[g]:
                group_standings[g][m.home_team] = {"team": m.home_team, "points": 0, "played": 0, "goalsFor": 0, "goalsAgainst": 0, "goalDiff": 0}
            if m.away_team not in group_standings[g]:
                group_standings[g][m.away_team] = {"team": m.away_team, "points": 0, "played": 0, "goalsFor": 0, "goalsAgainst": 0, "goalDiff": 0}

    for m in matches:
        if m.stage == "group" and m.group:
            g = m.group
            home_goals, away_goals = scores_map.get(m.id, (None, None))
            if home_goals is not None and away_goals is not None:
                home = group_standings[g][m.home_team]
                away = group_standings[g][m.away_team]

                home["played"] += 1
                away["played"] += 1
                home["goalsFor"] += home_goals
                home["goalsAgainst"] += away_goals
                away["goalsFor"] += away_goals
                away["goalsAgainst"] += home_goals

                home["goalDiff"] = home["goalsFor"] - home["goalsAgainst"]
                away["goalDiff"] = away["goalsFor"] - away["goalsAgainst"]

                if home_goals > away_goals:
                    home["points"] += 3
                elif home_goals < away_goals:
                    away["points"] += 3
                else:
                    home["points"] += 1
                    away["points"] += 1

    sorted_standings = {}
    for g, teams_dict in group_standings.items():
        teams_list = list(teams_dict.values())
        teams_list.sort(key=cmp_to_key(compare_teams))
        sorted_standings[g] = [str(t["team"]) for t in teams_list]

    # 2. Resolve Bracket
    group_1st = {}
    group_2nd = {}
    group_3rd_list = []

    for g, list_teams in sorted_standings.items():
        if len(list_teams) > 0:
            group_1st[g] = list_teams[0]
        if len(list_teams) > 1:
            group_2nd[g] = list_teams[1]
        if len(list_teams) > 2:
            team_3rd = list_teams[2]
            stats = group_standings[g][team_3rd]
            group_3rd_list.append({
                "group": g,
                "team": team_3rd,
                "points": stats["points"],
                "goalDiff": stats["goalDiff"],
                "goalsFor": stats["goalsFor"]
            })

    def compare_3rd(a: dict[str, Any], b: dict[str, Any]) -> int:
        if b["points"] != a["points"]:
            return int(b["points"] - a["points"])
        if b["goalDiff"] != a["goalDiff"]:
            return int(b["goalDiff"] - a["goalDiff"])
        if b["goalsFor"] != a["goalsFor"]:
            return int(b["goalsFor"] - a["goalsFor"])
        if a["group"] < b["group"]:
            return -1
        if a["group"] > b["group"]:
            return 1
        return 0

    group_3rd_list.sort(key=cmp_to_key(compare_3rd))
    qualified_3rd_groups = set([str(item["group"]) for item in group_3rd_list[:8]])

    assigned_3rd_groups = set()
    def assign_3rd_team(allowed_groups: list[str]) -> str:
        for item in group_3rd_list:
            if item["group"] in allowed_groups and item["group"] in qualified_3rd_groups and item["group"] not in assigned_3rd_groups:
                assigned_3rd_groups.add(item["group"])
                return str(item["team"])
        for item in group_3rd_list:
            if item["group"] in allowed_groups and item["group"] not in assigned_3rd_groups:
                assigned_3rd_groups.add(item["group"])
                return str(item["team"])
        return f"3º Grupo {'/'.join(allowed_groups)}"

    resolved = {}
    for m in matches:
        if m.stage == "group":
            resolved[m.id] = {"home": m.home_team, "away": m.away_team}

    def get_winner(match_id: int) -> str:
        m = next((x for x in matches if x.id == match_id), None)
        if not m:
            return f"Ganador Partido {match_id}"

        home_goals, away_goals = scores_map.get(match_id, (None, None))
        penalty_winner_home = penalty_winners_map.get(match_id, None)

        if home_goals is not None and away_goals is not None:
            if home_goals > away_goals:
                return str(resolved.get(match_id, {}).get("home", m.home_team))
            if home_goals < away_goals:
                return str(resolved.get(match_id, {}).get("away", m.away_team))
            
            # Draw
            if penalty_winner_home is not None:
                if penalty_winner_home:
                    return str(resolved.get(match_id, {}).get("home", m.home_team))
                else:
                    return str(resolved.get(match_id, {}).get("away", m.away_team))
            return str(resolved.get(match_id, {}).get("home", m.home_team))

        return f"Ganador Partido {match_id}"

    def get_loser(match_id: int) -> str:
        m = next((x for x in matches if x.id == match_id), None)
        if not m:
            return f"Perdedor Partido {match_id}"

        home_goals, away_goals = scores_map.get(match_id, (None, None))
        penalty_winner_home = penalty_winners_map.get(match_id, None)

        if home_goals is not None and away_goals is not None:
            if home_goals > away_goals:
                return str(resolved.get(match_id, {}).get("away", m.away_team))
            if home_goals < away_goals:
                return str(resolved.get(match_id, {}).get("home", m.home_team))
            
            # Draw
            if penalty_winner_home is not None:
                if penalty_winner_home:
                    return str(resolved.get(match_id, {}).get("away", m.away_team))
                else:
                    return str(resolved.get(match_id, {}).get("home", m.home_team))
            return str(resolved.get(match_id, {}).get("away", m.away_team))

        return f"Perdedor Partido {match_id}"

    # Dieciseisavos (Match 73 to 88)
    resolved[73] = { "home": group_2nd.get("A", "2º Grupo A"), "away": group_2nd.get("B", "2º Grupo B") }
    resolved[74] = { "home": group_1st.get("E", "1º Grupo E"), "away": assign_3rd_team(["A", "B", "C", "D", "F"]) }
    resolved[75] = { "home": group_1st.get("F", "1º Grupo F"), "away": group_2nd.get("C", "2º Grupo C") }
    resolved[76] = { "home": group_1st.get("C", "1º Grupo C"), "away": group_2nd.get("F", "2º Grupo F") }
    resolved[77] = { "home": group_1st.get("I", "1º Grupo I"), "away": assign_3rd_team(["C", "D", "F", "G", "H"]) }
    resolved[78] = { "home": group_2nd.get("E", "2º Grupo E"), "away": group_2nd.get("I", "2º Grupo I") }
    resolved[79] = { "home": group_1st.get("A", "1º Grupo A"), "away": assign_3rd_team(["C", "E", "F", "H", "I"]) }
    resolved[80] = { "home": group_1st.get("L", "1º Grupo L"), "away": assign_3rd_team(["E", "H", "I", "J", "K"]) }
    resolved[81] = { "home": group_1st.get("D", "1º Grupo D"), "away": assign_3rd_team(["B", "E", "F", "I", "J"]) }
    resolved[82] = { "home": group_1st.get("G", "1º Grupo G"), "away": assign_3rd_team(["A", "E", "H", "I", "J"]) }
    resolved[83] = { "home": group_2nd.get("K", "2º Grupo K"), "away": group_2nd.get("L", "2º Grupo L") }
    resolved[84] = { "home": group_1st.get("H", "1º Grupo H"), "away": group_2nd.get("J", "2º Grupo J") }
    resolved[85] = { "home": group_1st.get("B", "1º Grupo B"), "away": assign_3rd_team(["E", "F", "G", "I", "J"]) }
    resolved[86] = { "home": group_1st.get("J", "1º Grupo J"), "away": group_2nd.get("H", "2º Grupo H") }
    resolved[87] = { "home": group_1st.get("K", "1º Grupo K"), "away": assign_3rd_team(["D", "E", "I", "J", "L"]) }
    resolved[88] = { "home": group_2nd.get("D", "2º Grupo D"), "away": group_2nd.get("G", "2º Grupo G") }

    # Octavos (Match 89 to 96)
    resolved[89] = { "home": get_winner(74), "away": get_winner(77) }
    resolved[90] = { "home": get_winner(73), "away": get_winner(75) }
    resolved[91] = { "home": get_winner(76), "away": get_winner(78) }
    resolved[92] = { "home": get_winner(79), "away": get_winner(80) }
    resolved[93] = { "home": get_winner(83), "away": get_winner(84) }
    resolved[94] = { "home": get_winner(81), "away": get_winner(82) }
    resolved[95] = { "home": get_winner(86), "away": get_winner(88) }
    resolved[96] = { "home": get_winner(85), "away": get_winner(87) }

    # Cuartos (Match 97 to 100)
    resolved[97] = { "home": get_winner(89), "away": get_winner(90) }
    resolved[98] = { "home": get_winner(93), "away": get_winner(94) }
    resolved[99] = { "home": get_winner(91), "away": get_winner(92) }
    resolved[100] = { "home": get_winner(95), "away": get_winner(96) }

    # Semifinales (Match 101 to 102)
    resolved[101] = { "home": get_winner(97), "away": get_winner(98) }
    resolved[102] = { "home": get_winner(99), "away": get_winner(100) }

    # Tercer puesto
    resolved[103] = { "home": get_loser(101), "away": get_loser(102) }

    # Final (Match 104)
    resolved[104] = { "home": get_winner(101), "away": get_winner(102) }

    return resolved


class MatchService:
    @staticmethod
    async def update_matches_if_needed(db: AsyncSession) -> bool:
        """
        Updates matches from API-Sports if the last update was more than 5 minutes ago.
        Returns True if an update happened, False otherwise.
        """
        # Check the latest match update timestamp
        result = await db.execute(select(Match).order_by(desc(Match.last_updated)).limit(1))  # type: ignore[arg-type]
        latest_match = result.scalars().first()

        now = datetime.utcnow()
        if latest_match and (now - latest_match.last_updated) < timedelta(minutes=5):
            return False  # Data is fresh enough

        # Fetch from API
        client = APISportsClient()
        try:
            fixtures = await client.get_world_cup_fixtures()
        except Exception as e:
            # If API fails, log it and keep going with local data
            print(f"API-Sports request failed: {e}")
            return False

        for fixture_data in fixtures:
            fixture = fixture_data.get("fixture", {})
            teams = fixture_data.get("teams", {})
            goals = fixture_data.get("goals", {})

            match_id = fixture.get("id")
            home_team = teams.get("home", {}).get("name")
            away_team = teams.get("away", {}).get("name")
            home_score = goals.get("home")
            away_score = goals.get("away")
            status = fixture.get("status", {}).get("short")
            match_date = datetime.fromisoformat(fixture.get("date").replace("Z", "+00:00")).replace(
                tzinfo=None
            )

            # Find existing match in DB
            db_match = await db.get(Match, match_id)
            score_changed = False

            if db_match:
                # Check if score changed
                if db_match.home_score != home_score or db_match.away_score != away_score:
                    score_changed = True

                db_match.home_score = home_score
                db_match.away_score = away_score
                db_match.status = status
                db_match.group = fixture_data.get("group")
                db_match.stage = fixture_data.get("stage")
                db_match.last_updated = now
            else:
                db_match = Match(
                    id=match_id,
                    home_team=home_team,
                    away_team=away_team,
                    home_score=home_score,
                    away_score=away_score,
                    status=status,
                    date=match_date,
                    group=fixture_data.get("group"),
                    stage=fixture_data.get("stage"),
                    last_updated=now,
                )
                db.add(db_match)

            if score_changed and home_score is not None and away_score is not None:
                # Recalculate points for predictions on this match
                pred_result = await db.execute(
                    select(Prediction).where(Prediction.match_id == match_id)
                )
                predictions = pred_result.scalars().all()
                for prediction in predictions:
                    new_points = calculate_points(
                        prediction.home_score, prediction.away_score, home_score, away_score
                    )
                    prediction.points_earned = new_points
                    db.add(prediction)

        # Consolidated points recalculation
        await MatchService.recalculate_all_users_points(db)
        await db.commit()
        return True

    @staticmethod
    async def recalculate_all_users_points(db: AsyncSession) -> None:
        """
        Recalculate points for all users from scratch.
        Sums:
        - Match predictions: exact (3 pts) or outcome (1 pt)
        - Bracket advancement: R32 (1 pt), R16 (2 pts), QF (3 pts), SF (5 pts), Final (8 pts) per correct team
        - Special bets: Champion (10 pts), Runner-up (5 pts)
          And from environment variables if set: Top scorer (5 pts), Best goalkeeper (5 pts), Surprise team (5 pts)
        """
        import os

        # 1. Fetch all matches
        res = await db.execute(select(Match))
        matches = list(res.scalars().all())

        # Resolve the real tournament bracket
        real_scores = {m.id: (m.home_score, m.away_score) for m in matches}
        real_resolved = resolve_bracket_teams(matches, real_scores, {})

        def get_teams_for_matches(resolved_dict: dict[int, dict[str, str]], match_ids: Iterable[int]) -> set[str]:
            teams = set()
            for mid in match_ids:
                match_resolved = resolved_dict.get(mid)
                if match_resolved:
                    h = match_resolved.get("home")
                    a = match_resolved.get("away")
                    if h and not (h.startswith("1º ") or h.startswith("2º ") or h.startswith("3º ") or h.startswith("Ganador ") or h.startswith("Perdedor ")):
                        teams.add(h)
                    if a and not (a.startswith("1º ") or a.startswith("2º ") or a.startswith("3º ") or a.startswith("Ganador ") or a.startswith("Perdedor ")):
                        teams.add(a)
            return teams

        real_r32 = get_teams_for_matches(real_resolved, range(73, 89))
        real_r16 = get_teams_for_matches(real_resolved, range(89, 97))
        real_qf = get_teams_for_matches(real_resolved, range(97, 101))
        real_sf = get_teams_for_matches(real_resolved, range(101, 103))
        real_final = get_teams_for_matches(real_resolved, [104])

        # Resolve champion and runner-up from real bracket final (Match 104)
        real_champion = None
        real_runner_up = None
        m104 = next((x for x in matches if x.id == 104), None)
        if m104 and m104.home_score is not None and m104.away_score is not None:
            m104_teams = real_resolved.get(104, {})
            h = m104_teams.get("home")
            a = m104_teams.get("away")
            if (
                h and not (h.startswith("1º ") or h.startswith("2º ") or h.startswith("3º ") or h.startswith("Ganador ") or h.startswith("Perdedor "))
                and a and not (a.startswith("1º ") or a.startswith("2º ") or a.startswith("3º ") or a.startswith("Ganador ") or a.startswith("Perdedor "))
            ):
                if m104.home_score > m104.away_score:
                    real_champion = h
                    real_runner_up = a
                elif m104.home_score < m104.away_score:
                    real_champion = a
                    real_runner_up = h
                else:
                    real_champion = h
                    real_runner_up = a

        # 2. Fetch all users
        users_res = await db.execute(select(User))
        users = users_res.scalars().all()

        for u in users:
            # Check user ID to avoid mypy error
            u_id = cast(int, u.id)

            # Fetch user predictions
            pred_res = await db.execute(select(Prediction).where(Prediction.user_id == u_id))  # type: ignore[arg-type]
            preds = list(pred_res.scalars().all())

            # A. Match predictions points
            match_points = sum(p.points_earned for p in preds)

            # B. Bracket advancement points
            user_scores: dict[int, tuple[int | None, int | None]] = {p.match_id: (p.home_score, p.away_score) for p in preds}
            user_penalties = {p.match_id: p.penalty_winner_home for p in preds}

            user_resolved = resolve_bracket_teams(matches, user_scores, user_penalties)

            user_r32 = get_teams_for_matches(user_resolved, range(73, 89))
            user_r16 = get_teams_for_matches(user_resolved, range(89, 97))
            user_qf = get_teams_for_matches(user_resolved, range(97, 101))
            user_sf = get_teams_for_matches(user_resolved, range(101, 103))
            user_final = get_teams_for_matches(user_resolved, [104])

            adv_points = 0
            adv_points += len(user_r32.intersection(real_r32)) * 1
            adv_points += len(user_r16.intersection(real_r16)) * 2
            adv_points += len(user_qf.intersection(real_qf)) * 3
            adv_points += len(user_sf.intersection(real_sf)) * 5
            adv_points += len(user_final.intersection(real_final)) * 8

            # C. Special bets points
            special_points = 0
            tp_res = await db.execute(select(TournamentPrediction).where(TournamentPrediction.user_id == u_id))  # type: ignore[arg-type]
            tp = tp_res.scalars().first()
            if tp:
                if real_champion and tp.champion == real_champion:
                    special_points += 10
                if real_runner_up and tp.runner_up == real_runner_up:
                    special_points += 5

                # Top Scorer
                real_top_scorer = os.environ.get("REAL_TOP_SCORER")
                if real_top_scorer and tp.top_scorer:
                    if tp.top_scorer.strip().lower() == real_top_scorer.strip().lower():
                        special_points += 5

                # Best Goalkeeper
                real_best_goalkeeper = os.environ.get("REAL_BEST_GOALKEEPER")
                if real_best_goalkeeper and tp.best_goalkeeper:
                    if tp.best_goalkeeper.strip().lower() == real_best_goalkeeper.strip().lower():
                        special_points += 5

                # Surprise Team
                real_surprise_team = os.environ.get("REAL_SURPRISE_TEAM")
                if real_surprise_team and tp.surprise_team:
                    if tp.surprise_team.strip().lower() == real_surprise_team.strip().lower():
                        special_points += 5

            # Set user total points
            u.points = match_points + adv_points + special_points
            db.add(u)
