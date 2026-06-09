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

