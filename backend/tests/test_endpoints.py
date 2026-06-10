from collections.abc import AsyncGenerator
from datetime import UTC, datetime, timedelta

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from app.db.session import async_session_maker
from app.main import app
from app.models.models import Match, Prediction, TournamentPrediction, User

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

        # Test non-existent user
        response_fail = await ac.post("/api/auth", json={"username_or_id": "non_existent_username"})
        assert response_fail.status_code == 404


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

        # Clear all matches scores and status first
        for m in all_matches:
            m.home_score = None
            m.away_score = None
            m.status = "NS"

        # Find specific matches to modify
        m1 = next((x for x in all_matches if x.id == 1), None)
        m2 = next((x for x in all_matches if x.id == 2), None)
        m3 = next((x for x in all_matches if x.id == 3), None)
        m4 = next((x for x in all_matches if x.id == 4), None)
        m73 = next((x for x in all_matches if x.id == 73), None)

        assert m1 and m2 and m3 and m4 and m73, "Required seeded matches do not exist"

        # Modify matches for the test
        m1.home_team = "Spain"
        m1.away_team = "Germany"
        m1.home_score = 2
        m1.away_score = 1
        m1.status = "FT"
        m1.group = "A"
        m1.stage = "group"

        m2.home_team = "Spain"
        m2.away_team = "Germany"
        m2.home_score = 2
        m2.away_score = 1
        m2.status = "FT"
        m2.group = "A"
        m2.stage = "group"

        m3.home_team = "France"
        m3.away_team = "Italy"
        m3.home_score = 1
        m3.away_score = 0
        m3.status = "FT"
        m3.group = "B"
        m3.stage = "group"

        m4.home_team = "France"
        m4.away_team = "Italy"
        m4.home_score = 1
        m4.away_score = 0
        m4.status = "FT"
        m4.group = "B"
        m4.stage = "group"

        m73.home_team = "Germany"
        m73.away_team = "Italy"
        m73.home_score = None
        m73.away_score = None
        m73.status = "NS"
        m73.group = "R32"
        m73.stage = "r32"

        session.add_all(all_matches)
        
        user_obj = User(
            id=999,
            telegram_id="test_user_bracket",
            full_name="Bracket Test User",
            points=0
        )
        session.add(user_obj)
        await session.commit()

        p1 = Prediction(
            user_id=999,
            match_id=1,
            home_score=2,
            away_score=1,
            points_earned=3
        )
        p2 = Prediction(
            user_id=999,
            match_id=2,
            home_score=2,
            away_score=1,
            points_earned=3
        )
        p3 = Prediction(
            user_id=999,
            match_id=3,
            home_score=1,
            away_score=0,
            points_earned=3
        )
        p4 = Prediction(
            user_id=999,
            match_id=4,
            home_score=1,
            away_score=0,
            points_earned=3
        )
        session.add_all([p1, p2, p3, p4])
        await session.commit()

        from app.services.match_service import MatchService
        await MatchService.recalculate_all_users_points(session)
        await session.commit()
        
        await session.refresh(user_obj)
        assert user_obj.points == 44

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

