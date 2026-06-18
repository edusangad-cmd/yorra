from collections.abc import AsyncGenerator
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from app.db.session import async_session_maker
from app.main import app
from app.models.models import DailySummary, Match, Prediction, TournamentPrediction, User

TEST_TELEGRAM_ID = "999999999"
TEST_USERNAME = "test_user_porra"
TEST_FULL_NAME = "Test User"
TEST_MATCH_ID = 999999


async def do_db_cleanup() -> None:
    async with async_session_maker() as session:
        # Delete predictions
        pred_res = await session.execute(
            select(Prediction).where(Prediction.match_id == TEST_MATCH_ID)  # type: ignore[arg-type]
        )
        for pred in pred_res.scalars().all():
            await session.delete(pred)

        # Delete match
        match = await session.get(Match, TEST_MATCH_ID)
        if match:
            await session.delete(match)

        # Delete tournament predictions
        user_res = await session.execute(
            select(User).where(User.telegram_id == TEST_TELEGRAM_ID)  # type: ignore[arg-type]
        )
        user = user_res.scalars().first()
        if user:
            tp_res = await session.execute(
                select(TournamentPrediction).where(TournamentPrediction.user_id == user.id)  # type: ignore[arg-type]
            )
            for tp in tp_res.scalars().all():
                await session.delete(tp)

        # Delete user
        user_res = await session.execute(
            select(User).where(User.telegram_id == TEST_TELEGRAM_ID)  # type: ignore[arg-type]
        )
        for u in user_res.scalars().all():
            await session.delete(u)

        user_res2 = await session.execute(
            select(User).where(User.telegram_id == "pedro_perez")  # type: ignore[arg-type]
        )
        for u in user_res2.scalars().all():
            await session.delete(u)

        user_res_un = await session.execute(
            select(User).where(User.telegram_id == TEST_USERNAME)  # type: ignore[arg-type]
        )
        for u in user_res_un.scalars().all():
            tps = (await session.execute(select(TournamentPrediction).where(TournamentPrediction.user_id == u.id))).scalars().all()  # type: ignore[arg-type]
            for tp in tps:
                await session.delete(tp)
            preds = (await session.execute(select(Prediction).where(Prediction.user_id == u.id))).scalars().all()  # type: ignore[arg-type]
            for p in preds:
                await session.delete(p)
            await session.delete(u)

        # Delete target_tele_id user, predictions and tournament predictions
        user_res_target = await session.execute(
            select(User).where(User.telegram_id == "target_tele_id")  # type: ignore[arg-type]
        )
        user_target = user_res_target.scalars().first()
        if user_target:
            tp_res_target = await session.execute(
                select(TournamentPrediction).where(TournamentPrediction.user_id == user_target.id)  # type: ignore[arg-type]
            )
            for tp in tp_res_target.scalars().all():
                await session.delete(tp)
            pred_res_target = await session.execute(
                select(Prediction).where(Prediction.user_id == user_target.id)  # type: ignore[arg-type]
            )
            for pred in pred_res_target.scalars().all():
                await session.delete(pred)
            await session.delete(user_target)

        await session.commit()



@pytest.fixture(autouse=True)
async def cleanup() -> AsyncGenerator[None, None]:
    # Clean up before test in case database is dirty
    await do_db_cleanup()
    yield
    # Clean up after test
    await do_db_cleanup()


@pytest.mark.asyncio
async def test_auth_flow() -> None:
    # 1. Create a user directly in DB to simulate Telegram bot registration
    async with async_session_maker() as session:
        user = User(telegram_id=TEST_TELEGRAM_ID, username=TEST_USERNAME, full_name=TEST_FULL_NAME)
        session.add(user)
        await session.commit()

    # 2. Test authenticating via REST API
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.post("/api/auth", json={"username_or_id": TEST_USERNAME})
        assert response.status_code == 200
        data = response.json()
        assert data["telegram_id"] == TEST_TELEGRAM_ID
        assert data["full_name"] == TEST_FULL_NAME

        # Test auth with prefix @
        response_with_at = await ac.post("/api/auth", json={"username_or_id": f"@{TEST_USERNAME}"})
        assert response_with_at.status_code == 200

        # Test auth with ID
        response_with_id = await ac.post("/api/auth", json={"username_or_id": TEST_TELEGRAM_ID})
        assert response_with_id.status_code == 200

        # Test non-existent user (should auto-register now)
        response_success = await ac.post("/api/auth", json={"username_or_id": "temp_user_auth"})
        assert response_success.status_code == 200
        data = response_success.json()
        assert data["username"] == "temp_user_auth"
        assert data["full_name"] == "temp_user_auth"

        # Clean up temp_user_auth
        async with async_session_maker() as session:
            user_res = await session.execute(
                select(User).where(User.telegram_id == "temp_user_auth")  # type: ignore[arg-type]
            )
            for u in user_res.scalars().all():
                await session.delete(u)
            await session.commit()


@pytest.mark.asyncio
async def test_predictions_flow() -> None:
    # 1. Setup user and match in DB
    async with async_session_maker() as session:
        user = User(telegram_id=TEST_TELEGRAM_ID, username=TEST_USERNAME, full_name=TEST_FULL_NAME)
        session.add(user)

        # Upcoming match (1 day from now)
        future_match = Match(
            id=TEST_MATCH_ID,
            home_team="Spain",
            away_team="Germany",
            status="NS",
            date=datetime.now(UTC).replace(tzinfo=None) + timedelta(days=1),
        )
        session.add(future_match)
        await session.commit()

    # 2. Test placing prediction
    headers = {"X-Telegram-Id": TEST_TELEGRAM_ID}
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Get matches
        res_matches = await ac.get("/api/matches")
        assert res_matches.status_code == 200
        matches_list = res_matches.json()
        assert any(m["id"] == TEST_MATCH_ID for m in matches_list)

        # Place prediction España 2 - 1 Alemania
        res_pred = await ac.post(
            "/api/predictions",
            headers=headers,
            json={"match_id": TEST_MATCH_ID, "home_score": 2, "away_score": 1},
        )
        assert res_pred.status_code == 200
        pred_data = res_pred.json()
        assert pred_data["home_score"] == 2
        assert pred_data["away_score"] == 1

        # Get user predictions
        res_get_pred = await ac.get("/api/predictions", headers=headers)
        assert res_get_pred.status_code == 200
        preds_list = res_get_pred.json()
        assert any(p["match_id"] == TEST_MATCH_ID for p in preds_list)


@pytest.mark.asyncio
async def test_predictions_locked_for_started_matches() -> None:
    # 1. Setup user and started match in DB
    async with async_session_maker() as session:
        user = User(telegram_id=TEST_TELEGRAM_ID, username=TEST_USERNAME, full_name=TEST_FULL_NAME)
        session.add(user)

        # Started match (1 hour ago)
        started_match = Match(
            id=TEST_MATCH_ID,
            home_team="Brazil",
            away_team="Argentina",
            status="1H",
            date=datetime.now(UTC).replace(tzinfo=None) - timedelta(hours=1),
        )
        session.add(started_match)
        await session.commit()

    # 2. Placing prediction should fail with 400
    headers = {"X-Telegram-Id": TEST_TELEGRAM_ID}
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res_pred = await ac.post(
            "/api/predictions",
            headers=headers,
            json={"match_id": TEST_MATCH_ID, "home_score": 3, "away_score": 0},
        )
        assert res_pred.status_code == 400
        assert "ya ha comenzado" in res_pred.json()["detail"]


@pytest.mark.asyncio
async def test_leaderboard() -> None:
    # 1. Setup multiple users
    async with async_session_maker() as session:
        user = User(
            telegram_id=TEST_TELEGRAM_ID,
            username=TEST_USERNAME,
            full_name=TEST_FULL_NAME,
            points=10,
        )
        session.add(user)
        await session.commit()

    # 2. Get leaderboard
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get("/api/leaderboard")
        assert response.status_code == 200
        data = response.json()
        assert "users" in data
        assert "roast" in data
        assert any(u["username"] == TEST_USERNAME for u in data["users"])


@pytest.mark.asyncio
async def test_tournament_predictions_flow() -> None:
    # 1. Setup user in DB
    async with async_session_maker() as session:
        user = User(telegram_id=TEST_TELEGRAM_ID, username=TEST_USERNAME, full_name=TEST_FULL_NAME)
        session.add(user)
        await session.commit()

    headers = {"X-Telegram-Id": TEST_TELEGRAM_ID}
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Get predictions (should be empty initially)
        res_get = await ac.get("/api/tournament-predictions", headers=headers)
        assert res_get.status_code == 200
        assert res_get.json()["champion"] is None

        # Save predictions
        res_post = await ac.post(
            "/api/tournament-predictions",
            headers=headers,
            json={
                "champion": "Spain",
                "runner_up": "Brazil",
                "top_scorer": "Haaland",
                "surprise_team": "Morocco"
            }
        )
        assert res_post.status_code == 200
        assert res_post.json()["champion"] == "Spain"

        # Get again and confirm
        res_get_again = await ac.get("/api/tournament-predictions", headers=headers)
        assert res_get_again.status_code == 200
        assert res_get_again.json()["champion"] == "Spain"
        assert res_get_again.json()["top_scorer"] == "Haaland"


@pytest.mark.asyncio
async def test_debug_simulate_real_scores() -> None:
    # 1. Setup match in DB
    async with async_session_maker() as session:
        match = Match(
            id=TEST_MATCH_ID,
            home_team="Spain",
            away_team="Germany",
            status="NS",
            date=datetime.now(UTC).replace(tzinfo=None) + timedelta(days=1),
        )
        session.add(match)
        await session.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.post("/api/debug/simulate-real-scores")
        assert res.status_code == 200
        assert res.json()["success"] is True

        # Check that the match has a score now
        async with async_session_maker() as session:
            db_match = await session.get(Match, TEST_MATCH_ID)
            assert db_match is not None
            assert db_match.home_score is not None
            assert db_match.away_score is not None
            assert db_match.status == "FT"


@pytest.mark.asyncio
async def test_user_registration_and_case_insensitive_auth() -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # 1. Register new user
        res_reg = await ac.post(
            "/api/register",
            json={"username": "Pedro_Perez", "full_name": "Pedro Pérez"}
        )
        assert res_reg.status_code == 200
        data = res_reg.json()
        assert data["username"] == "pedro_perez"
        assert data["full_name"] == "Pedro Pérez"
        assert data["telegram_id"] == "pedro_perez"

        # 2. Try registering duplicate username
        res_reg_dup = await ac.post(
            "/api/register",
            json={"username": "@Pedro_Perez", "full_name": "Otro Pedro"}
        )
        assert res_reg_dup.status_code == 400

        # 3. Authenticate with original casing
        res_auth_orig = await ac.post(
            "/api/auth",
            json={"username_or_id": "Pedro_Perez"}
        )
        assert res_auth_orig.status_code == 200
        assert res_auth_orig.json()["username"] == "pedro_perez"

        # 4. Authenticate with lowercase and @
        res_auth_at = await ac.post(
            "/api/auth",
            json={"username_or_id": "@pedro_perez"}
        )
        assert res_auth_at.status_code == 200
        assert res_auth_at.json()["username"] == "pedro_perez"


@pytest.mark.asyncio
async def test_bracket_advancement_points() -> None:
    # Pre-cleanup to avoid leftover IntegrityErrors
    async with async_session_maker() as session:
        pred_res = await session.execute(
            select(Prediction).where(Prediction.user_id == 999)  # type: ignore[arg-type]
        )
        for pred in pred_res.scalars().all():
            await session.delete(pred)
        user = await session.get(User, 999)
        if user:
            await session.delete(user)
        await session.commit()

    # Setup matches in DB
    async with async_session_maker() as session:
        # Fetch all matches to save and clear their scores
        all_matches_res = await session.execute(select(Match))
        all_matches = list(all_matches_res.scalars().all())

        assert len(all_matches) > 0, "No seeded matches exist"

        # Save original states
        from typing import Any
        orig_states: dict[int, dict[str, Any]] = {}
        for m in all_matches:
            orig_states[m.id] = {
                "home_team": m.home_team,
                "away_team": m.away_team,
                "home_score": m.home_score,
                "away_score": m.away_score,
                "status": m.status,
                "group": m.group,
                "stage": m.stage,
            }

        try:
            # Clear all matches scores and status first
            for m in all_matches:
                m.home_score = None
                m.away_score = None
                m.status = "NS"

            # Set up Group A matches (1, 2, 25, 28, 51, 52)
            # Set up Group B matches (3, 8, 26, 27, 53, 54)
            # Set up Match 73 (R32)
            match_data: dict[int, dict[str, Any]] = {
                1: {"home": "México", "away": "Sudáfrica", "h_score": 2, "a_score": 1, "group": "A", "stage": "group"},
                2: {"home": "Corea del Sur", "away": "República Checa", "h_score": 1, "a_score": 0, "group": "A", "stage": "group"},
                25: {"home": "México", "away": "Corea del Sur", "h_score": 2, "a_score": 0, "group": "A", "stage": "group"},
                28: {"home": "República Checa", "away": "Sudáfrica", "h_score": 1, "a_score": 2, "group": "A", "stage": "group"},
                51: {"home": "Sudáfrica", "away": "Corea del Sur", "h_score": 0, "a_score": 2, "group": "A", "stage": "group"},
                52: {"home": "República Checa", "away": "México", "h_score": 1, "a_score": 3, "group": "A", "stage": "group"},
                
                3: {"home": "Canadá", "away": "Bosnia y Herzegovina", "h_score": 2, "a_score": 0, "group": "B", "stage": "group"},
                8: {"home": "Catar", "away": "Suiza", "h_score": 1, "a_score": 2, "group": "B", "stage": "group"},
                26: {"home": "Suiza", "away": "Bosnia y Herzegovina", "h_score": 1, "a_score": 0, "group": "B", "stage": "group"},
                27: {"home": "Canadá", "away": "Catar", "h_score": 3, "a_score": 0, "group": "B", "stage": "group"},
                53: {"home": "Bosnia y Herzegovina", "away": "Catar", "h_score": 1, "a_score": 2, "group": "B", "stage": "group"},
                54: {"home": "Suiza", "away": "Canadá", "h_score": 1, "a_score": 0, "group": "B", "stage": "group"},
                
                73: {"home": "Corea del Sur", "away": "Canadá", "h_score": 2, "a_score": 1, "group": "R32", "stage": "r32"},
            }

            for mid, info in match_data.items():
                db_m = next((x for x in all_matches if x.id == mid), None)
                assert db_m is not None, f"Match {mid} not found"
                db_m.home_team = info["home"]
                db_m.away_team = info["away"]
                db_m.home_score = info["h_score"]
                db_m.away_score = info["a_score"]
                db_m.status = "FT"
                db_m.group = info["group"]
                db_m.stage = info["stage"]

            session.add_all(all_matches)
            
            user_obj = User(
                id=999,
                telegram_id="test_user_bracket",
                full_name="Bracket Test User",
                points=0
            )
            session.add(user_obj)
            await session.commit()

            # Add Predictions for the same scores
            preds_to_add = []
            for mid, info in match_data.items():
                preds_to_add.append(
                    Prediction(
                        user_id=999,
                        match_id=mid,
                        home_score=info["h_score"],
                        away_score=info["a_score"],
                        points_earned=3
                    )
                )
            session.add_all(preds_to_add)
            await session.commit()

            from app.services.match_service import MatchService
            await MatchService.recalculate_all_users_points(session)
            await session.commit()
            
            await session.refresh(user_obj)
            assert user_obj.points == 45

        finally:
            # Clean up: delete user and predictions
            pred_res2 = await session.execute(
                select(Prediction).where(Prediction.user_id == 999)  # type: ignore[arg-type]
            )
            for pred in pred_res2.scalars().all():
                await session.delete(pred)
            user_to_del = await session.get(User, 999)
            if user_to_del:
                await session.delete(user_to_del)

            # Restore original matches
            for m in all_matches:
                state = orig_states[m.id]
                m.home_team = str(state["home_team"])
                m.away_team = str(state["away_team"])
                m.home_score = state["home_score"]
                m.away_score = state["away_score"]
                m.status = str(state["status"])
                m.group = str(state["group"]) if state["group"] is not None else None
                m.stage = str(state["stage"]) if state["stage"] is not None else None
                session.add(m)

            await session.commit()


@pytest.mark.asyncio
async def test_reset_endpoints() -> None:
    # 1. Setup user, match, prediction, and tournament prediction
    async with async_session_maker() as session:
        user = User(telegram_id=TEST_TELEGRAM_ID, username=TEST_USERNAME, full_name=TEST_FULL_NAME)
        session.add(user)
        await session.commit()
        await session.refresh(user)

        match = Match(
            id=TEST_MATCH_ID,
            home_team="Spain",
            away_team="Germany",
            home_score=2,
            away_score=1,
            status="FT",
            date=datetime.now(UTC).replace(tzinfo=None),
        )
        session.add(match)

        pred = Prediction(
            user_id=user.id,
            match_id=TEST_MATCH_ID,
            home_score=2,
            away_score=1,
            points_earned=3,
        )
        session.add(pred)

        tp = TournamentPrediction(
            user_id=user.id,
            champion="España",
            runner_up="Alemania",
            top_scorer="Lamine Yamal",
            best_goalkeeper="Unai Simón",
            surprise_team="Marruecos",
        )
        session.add(tp)
        await session.commit()

    headers = {"X-Telegram-Id": TEST_TELEGRAM_ID}
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # A. Reset predictions
        res_reset_pred = await ac.post("/api/predictions/reset", headers=headers)
        assert res_reset_pred.status_code == 200
        assert "reseteados" in res_reset_pred.json()["message"]

        # Verify deletion in DB
        async with async_session_maker() as session:
            preds = (await session.execute(select(Prediction).where(Prediction.user_id == user.id))).scalars().all()  # type: ignore[arg-type]
            assert len(preds) == 0

            tps = (await session.execute(select(TournamentPrediction).where(TournamentPrediction.user_id == user.id))).scalars().all()  # type: ignore[arg-type]
            assert len(tps) == 0

        # B. Reset real scores
        res_reset_real = await ac.post("/api/debug/reset-real-scores")
        assert res_reset_real.status_code == 200
        assert "reseteados" in res_reset_real.json()["message"]

        # Verify real scores reset in DB
        async with async_session_maker() as session:
            db_match = await session.get(Match, TEST_MATCH_ID)
            assert db_match is not None
            assert db_match.home_score is None
            assert db_match.away_score is None
            assert db_match.status == "NS"


@pytest.mark.asyncio
async def test_third_place_combinations_resolution() -> None:
    from app.models.models import Match
    from app.services.match_service import resolve_bracket_teams

    matches = []
    scores_map: dict[int, tuple[int | None, int | None]] = {}
    
    # 1. Generate 72 group stage matches (6 per group for groups A-L)
    match_id = 1
    groups = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"]
    for g in groups:
        teams = [f"{g}1", f"{g}2", f"{g}3", f"{g}4"]
        group_match_pairs = [
            (teams[0], teams[1]),
            (teams[2], teams[3]),
            (teams[0], teams[2]),
            (teams[1], teams[3]),
            (teams[0], teams[3]),
            (teams[1], teams[2]),
        ]
        
        is_best_3rd = g in ["E", "F", "G", "H", "I", "J", "K", "L"]
        
        for idx, (home, away) in enumerate(group_match_pairs):
            m = Match(
                id=match_id,
                home_team=home,
                away_team=away,
                stage="group",
                group=g,
                status="NS",
                date=datetime.utcnow(),
            )
            matches.append(m)
            
            # Assign scores to determine standings
            score: tuple[int | None, int | None]
            if is_best_3rd:
                # 3rd place gets 4 points (E2)
                if idx == 0:    # 0 vs 1 (E1 vs E2) -> (2, 1)
                    score = (2, 1)
                elif idx == 1:  # 2 vs 3 (E3 vs E4) -> (3, 0)
                    score = (3, 0)
                elif idx == 2:  # 0 vs 2 (E1 vs E3) -> (1, 1)
                    score = (1, 1)
                elif idx == 3:  # 1 vs 3 (E2 vs E4) -> (2, 0)
                    score = (2, 0)
                elif idx == 4:  # 0 vs 3 (E1 vs E4) -> (3, 0)
                    score = (3, 0)
                else:           # 1 vs 2 (E2 vs E3) -> (1, 1)
                    score = (1, 1)
            else:
                # 3rd place gets 1 point
                if idx == 0:    # (2, 0)
                    score = (2, 0)
                elif idx == 1:  # (3, 0)
                    score = (3, 0)
                elif idx == 2:  # (4, 0)
                    score = (4, 0)
                elif idx == 3:  # (0, 0)
                    score = (0, 0)
                elif idx == 4:  # (5, 0)
                    score = (5, 0)
                else:           # (0, 4)
                    score = (0, 4)
                
            scores_map[match_id] = score
            match_id += 1

    # 2. Add dummy knockout matches (Match 73 to 104)
    for kid in range(73, 105):
        matches.append(
            Match(
                id=kid,
                home_team=f"T1_{kid}",
                away_team=f"T2_{kid}",
                stage="knockout",
                status="NS",
                date=datetime.utcnow(),
            )
        )

    # 3. Call resolve_bracket_teams
    resolved = resolve_bracket_teams(matches, scores_map, {})

    # 4. Assertions for EFGHIJKL combination
    # Winner Group A (A1) vs 3rd Group E (E2) -> Match 79
    assert resolved[79]["home"] == "A1"
    assert resolved[79]["away"] == "E2"

    # Winner Group B (B1) vs 3rd Group J (J2) -> Match 85
    assert resolved[85]["home"] == "B1"
    assert resolved[85]["away"] == "J2"

    # Winner Group D (D1) vs 3rd Group I (I2) -> Match 81
    assert resolved[81]["home"] == "D1"
    assert resolved[81]["away"] == "I2"

    # Winner Group E (E1 or E3/E2 depending on standing, let's just make sure it's resolved and matches combination)
    # Under new standings, E1 is 1st in E.
    assert resolved[74]["home"] == "E1"
    # Winner Group E (E1) vs 3rd Group F (F2) -> Match 74
    assert resolved[74]["away"] == "F2"

    # Winner Group I (I1) vs 3rd Group G (G2) -> Match 77
    assert resolved[77]["home"] == "I1"
    assert resolved[77]["away"] == "G2"


@pytest.mark.asyncio
async def test_get_user_predictions_endpoint() -> None:
    # 1. Setup user, match, predictions and tournament predictions
    async with async_session_maker() as session:
        # Create target user
        target_user = User(
            telegram_id="target_tele_id",
            username="target_user",
            full_name="Target User",
            points=5,
        )
        session.add(target_user)
        
        # Create active user (for auth)
        active_user = User(
            telegram_id=TEST_TELEGRAM_ID,
            username=TEST_USERNAME,
            full_name=TEST_FULL_NAME,
            points=0,
        )
        session.add(active_user)
        await session.commit()
        await session.refresh(target_user)
        await session.refresh(active_user)

        # Create dummy match
        match = Match(
            id=TEST_MATCH_ID,
            home_team="Team A",
            away_team="Team B",
            status="NS",
            date=datetime.utcnow(),
            stage="group",
        )
        session.add(match)

        # Create prediction for target user
        pred = Prediction(
            user_id=target_user.id,
            match_id=TEST_MATCH_ID,
            home_score=2,
            away_score=1,
            points_earned=3,
        )
        session.add(pred)

        # Create tournament prediction for target user
        tour_pred = TournamentPrediction(
            user_id=target_user.id,
            champion="Spain",
            runner_up="Argentina",
            top_scorer="Mbappe",
            best_goalkeeper="Martinez",
            surprise_team="Morocco",
        )
        session.add(tour_pred)
        await session.commit()

    # 2. Get predictions of target user
    headers = {"X-Telegram-Id": TEST_TELEGRAM_ID}
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Success case
        response = await ac.get(f"/api/users/{target_user.id}/predictions", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        # Verify user details
        assert data["user"]["id"] == target_user.id
        assert data["user"]["full_name"] == "Target User"
        assert data["user"]["points"] == 5

        # Verify predictions
        assert len(data["predictions"]) == 1
        assert data["predictions"][0]["match_id"] == TEST_MATCH_ID
        assert data["predictions"][0]["home_score"] == 2
        assert data["predictions"][0]["away_score"] == 1
        assert data["predictions"][0]["points_earned"] == 3

        # Verify tournament prediction
        assert data["tournament_prediction"] is not None
        assert data["tournament_prediction"]["champion"] == "Spain"
        assert data["tournament_prediction"]["surprise_team"] == "Morocco"

        # Not found case (404)
        response_404 = await ac.get("/api/users/9999999/predictions", headers=headers)
        assert response_404.status_code == 404
        assert response_404.json()["detail"] == "Usuario no encontrado"

        # Unauthenticated case (422 due to missing required X-Telegram-Id header)
        response_401 = await ac.get(f"/api/users/{target_user.id}/predictions")
        assert response_401.status_code == 422


@pytest.mark.asyncio
async def test_delete_user_flow() -> None:
    # 1. Setup target user, normal user, and admin in DB
    async with async_session_maker() as session:
        # Check if they exist from a dirty state
        old_target = (await session.execute(select(User).where(User.telegram_id == "to_be_deleted"))).scalars().first()  # type: ignore[arg-type]
        if old_target:
            await session.delete(old_target)
        old_admin = (await session.execute(select(User).where(User.telegram_id == "educonsul"))).scalars().first()  # type: ignore[arg-type]
        if old_admin:
            await session.delete(old_admin)
        await session.commit()

        target_user = User(telegram_id="to_be_deleted", username="to_be_deleted", full_name="To Delete")
        admin_user = User(telegram_id="educonsul", username="educonsul", full_name="Edu Consul")
        normal_user = User(telegram_id=TEST_TELEGRAM_ID, username=TEST_USERNAME, full_name=TEST_FULL_NAME)
        session.add(target_user)
        session.add(admin_user)
        session.add(normal_user)
        await session.commit()
        await session.refresh(target_user)
        await session.refresh(admin_user)
        await session.refresh(normal_user)
        target_id = target_user.id

    # 2. Try deleting with non-admin (should return 403)
    headers_normal = {"X-Telegram-Id": TEST_TELEGRAM_ID}
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res_normal = await ac.delete(f"/api/users/{target_id}", headers=headers_normal)
        assert res_normal.status_code == 403
        assert "permisos" in res_normal.json()["detail"]

    # 3. Try deleting with admin (should return 200)
    headers_admin = {"X-Telegram-Id": "educonsul"}
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res_admin = await ac.delete(f"/api/users/{target_id}", headers=headers_admin)
        assert res_admin.status_code == 200
        assert "eliminado" in res_admin.json()["message"]

    # 4. Verify user is deleted from DB
    async with async_session_maker() as session:
        db_user = await session.get(User, target_id)
        assert db_user is None

        # Clean up admin user
        admin_db = await session.get(User, admin_user.id)
        if admin_db:
            await session.delete(admin_db)
        await session.commit()


@pytest.mark.asyncio
async def test_daily_summaries_flow() -> None:
    # 1. Setup user, match, and predictions in DB
    async with async_session_maker() as session:
        user = User(telegram_id=TEST_TELEGRAM_ID, username=TEST_USERNAME, full_name=TEST_FULL_NAME)
        session.add(user)
        await session.commit()
        await session.refresh(user)

        # Match played today
        today_date = datetime.now(UTC).date()
        today_match = Match(
            id=TEST_MATCH_ID,
            home_team="Spain",
            away_team="Cabo Verde",
            home_score=6,
            away_score=0,
            status="FT",
            date=datetime.combine(today_date, datetime.now(UTC).time()),
        )
        session.add(today_match)

        pred = Prediction(
            user_id=user.id,
            match_id=TEST_MATCH_ID,
            home_score=6,
            away_score=0,
            points_earned=5,
        )
        session.add(pred)
        await session.commit()

    date_str = today_date.strftime("%Y-%m-%d")
    from unittest.mock import patch
    with patch("app.services.ai_summary_service.AISummaryService._call_gemini_api", return_value="Spain vs Cabo Verde summary"):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            # A. Generate daily summary
            res_gen = await ac.post("/api/daily-summaries/generate", json={"date": date_str})
            assert res_gen.status_code == 200
            data_gen = res_gen.json()
            assert data_gen["success"] is True
            assert data_gen["summary_date"] == date_str
            assert "Spain" in data_gen["content"]
            assert "Cabo Verde" in data_gen["content"]

            # B. Get daily summaries list
            res_list = await ac.get("/api/daily-summaries")
            assert res_list.status_code == 200
            summaries = res_list.json()
            assert len(summaries) >= 1
            assert summaries[0]["summary_date"] == date_str
            assert summaries[0]["content"] == data_gen["content"]

    # Clean up summary
    async with async_session_maker() as session:
        summary_res = await session.execute(
            select(DailySummary).where(DailySummary.summary_date == date_str)  # type: ignore[arg-type]
        )
        for s in summary_res.scalars().all():
            await session.delete(s)
        await session.commit()


@pytest.mark.asyncio
async def test_daily_summaries_prompt_content() -> None:
    # Pre-cleanup in case of a dirty state
    async with async_session_maker() as session:
        match_preds = (await session.execute(select(Prediction).where(Prediction.match_id == 9999))).scalars().all()  # type: ignore[arg-type]
        for mp in match_preds:
            await session.delete(mp)
        m_obj = await session.get(Match, 9999)
        if m_obj:
            await session.delete(m_obj)
            
        res = await session.execute(
            select(User).where(User.telegram_id == "test_prompt_user")  # type: ignore[arg-type]
        )
        for u in res.scalars().all():
            preds = (await session.execute(select(Prediction).where(Prediction.user_id == u.id))).scalars().all()  # type: ignore[arg-type]
            for p in preds:
                await session.delete(p)
            await session.delete(u)
        await session.commit()

    # 1. Setup user, match in DB
    async with async_session_maker() as session:
        user = User(telegram_id="test_prompt_user", username="test_prompt_user", full_name="Edu Sanchez", points=42)
        session.add(user)
        await session.commit()
        await session.refresh(user)

        # Match played today
        today_date = datetime.now(UTC).date()
        today_match = Match(
            id=9999,
            home_team="Spain",
            away_team="Cabo Verde",
            home_score=6,
            away_score=0,
            status="FT",
            date=datetime.combine(today_date, datetime.now(UTC).time()),
        )
        session.add(today_match)
        await session.commit()

    date_str = today_date.strftime("%Y-%m-%d")
    from unittest.mock import patch
    
    captured_prompt = None
    async def mock_call_gemini_api(prompt: str, matches: Any, rankings_today: Any) -> str:
        nonlocal captured_prompt
        captured_prompt = prompt
        return "mocked response"

    with patch("app.services.ai_summary_service.AISummaryService._call_gemini_api", side_effect=mock_call_gemini_api), \
         patch("app.services.match_service.MatchService.update_matches_if_needed", return_value=False), \
         patch("app.services.match_service.MatchService.recalculate_all_users_points", return_value=None):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            res_gen = await ac.post("/api/daily-summaries/generate", json={"date": date_str})
            assert res_gen.status_code == 200
            data_gen = res_gen.json()
            # Verify the API response contains the dynamic title with correct points from DB
            assert "Crónica de la Porra - Edu Sanchez (42 pts)" in data_gen["content"]

    # Verify captured prompt contents
    assert captured_prompt is not None
    # Check overall rankings are NOT in prompt context (pulled from database dynamic repository instead)
    assert "Edu Sanchez (42 pts)" not in captured_prompt
    assert "CLASIFICACIÓN GENERAL ACUMULADA HASTA HOY" not in captured_prompt
    assert "NO escribas ningún título, cabecera ni clasificación al principio" in captured_prompt
    
    # Check new glossary terms
    assert "el gitano" in captured_prompt
    assert "el fercho" in captured_prompt
    assert "el cé" in captured_prompt
    assert "negros" in captured_prompt
    assert "zarik" in captured_prompt
    assert "el bomba" in captured_prompt
    assert "la yorra" in captured_prompt
    assert "llevar goles" in captured_prompt
    assert "el filmo" in captured_prompt
    
    # Check tone rules
    assert "qué bello" in captured_prompt
    assert "macho" in captured_prompt
    assert "niño" in captured_prompt

    # Clean up
    async with async_session_maker() as session:
        db_user = await session.get(User, user.id)
        if db_user:
            await session.delete(db_user)
        m = await session.get(Match, 9999)
        if m:
            await session.delete(m)
        summary_res = await session.execute(
            select(DailySummary).where(DailySummary.summary_date == date_str)  # type: ignore[arg-type]
        )
        for s in summary_res.scalars().all():
            await session.delete(s)
        await session.commit()




