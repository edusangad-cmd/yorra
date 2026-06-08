from datetime import datetime, timedelta

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import Match, Prediction, User
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
                    old_points = prediction.points_earned
                    new_points = calculate_points(
                        prediction.home_score, prediction.away_score, home_score, away_score
                    )
                    prediction.points_earned = new_points

                    # Update user points total
                    user = await db.get(User, prediction.user_id)
                    if user:
                        user.points = user.points - old_points + new_points

        await db.commit()
        return True
