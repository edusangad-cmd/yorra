import random
from datetime import UTC, datetime
from typing import Any, cast

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel
from sqlalchemy import asc, desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.telegram import ROAST_TEMPLATES
from app.db.session import get_session
from app.models.models import Match, Prediction, User
from app.services.match_service import MatchService

router = APIRouter(prefix="/api", tags=["api"])


class AuthRequest(BaseModel):
    username_or_id: str


class PredictionRequest(BaseModel):
    match_id: int
    home_score: int
    away_score: int


async def get_current_user(
    x_telegram_id: str = Header(..., description="Telegram ID of the user"),
    db: AsyncSession = Depends(get_session),
) -> User:
    result = await db.execute(select(User).where(User.telegram_id == x_telegram_id))  # type: ignore[arg-type]
    user = result.scalars().first()
    if not user:
        raise HTTPException(
            status_code=401,
            detail="Usuario no registrado en Telegram. Ejecuta /start en el bot primero.",
        )
    return user


@router.post("/auth")
async def authenticate(
    payload: AuthRequest, db: AsyncSession = Depends(get_session)
) -> dict[str, Any]:
    search_str = payload.username_or_id.strip()

    # Try looking up by telegram_id directly
    result = await db.execute(select(User).where(User.telegram_id == search_str))  # type: ignore[arg-type]
    user = result.scalars().first()

    # If not found and search_str starts with @, remove it and look up by username
    if not user and search_str.startswith("@"):
        username = search_str[1:]
        result = await db.execute(select(User).where(User.username == username))  # type: ignore[arg-type]
        user = result.scalars().first()

    if not user:
        # Also try looking up by username directly without @
        result = await db.execute(select(User).where(User.username == search_str))  # type: ignore[arg-type]
        user = result.scalars().first()

    if not user:
        raise HTTPException(
            status_code=404,
            detail="Usuario no encontrado. Asegúrate de registrarte primero en el bot de Telegram usando /start.",
        )

    return {
        "id": user.id,
        "telegram_id": user.telegram_id,
        "username": user.username,
        "full_name": user.full_name,
        "points": user.points,
    }


@router.get("/matches")
async def get_matches(db: AsyncSession = Depends(get_session)) -> list[dict[str, Any]]:
    # Trigger lazy update to fetch new matches/scores if needed
    await MatchService.update_matches_if_needed(db)

    result = await db.execute(select(Match).order_by(asc(Match.date)))  # type: ignore[arg-type]
    matches = result.scalars().all()

    return [
        {
            "id": m.id,
            "home_team": m.home_team,
            "away_team": m.away_team,
            "home_score": m.home_score,
            "away_score": m.away_score,
            "status": m.status,
            "date": m.date.isoformat(),
        }
        for m in matches
    ]


@router.get("/predictions")
async def get_predictions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> list[dict[str, Any]]:
    result = await db.execute(
        select(Prediction).where(Prediction.user_id == current_user.id)  # type: ignore[arg-type]
    )
    predictions = result.scalars().all()

    return [
        {
            "id": p.id,
            "match_id": p.match_id,
            "home_score": p.home_score,
            "away_score": p.away_score,
            "points_earned": p.points_earned,
        }
        for p in predictions
    ]


@router.post("/predictions")
async def place_prediction(
    payload: PredictionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    # 1. Fetch the match
    match = await db.get(Match, payload.match_id)
    if not match:
        raise HTTPException(status_code=404, detail="Partido no encontrado")

    # 2. Check if the match has started
    # Compare in UTC timezone to be secure
    now = datetime.now(UTC).replace(tzinfo=None)
    if match.date <= now:
        raise HTTPException(
            status_code=400,
            detail="No puedes predecir o modificar un partido que ya ha comenzado",
        )

    # 3. Find or create prediction
    uid_cond = Prediction.user_id == current_user.id
    mid_cond = Prediction.match_id == payload.match_id
    result = await db.execute(
        select(Prediction).where(uid_cond & mid_cond)  # type: ignore[arg-type]
    )
    prediction = result.scalars().first()

    if prediction:
        prediction.home_score = payload.home_score
        prediction.away_score = payload.away_score
    else:
        prediction = Prediction(
            user_id=cast(int, current_user.id),
            match_id=payload.match_id,
            home_score=payload.home_score,
            away_score=payload.away_score,
            points_earned=0,
        )
        db.add(prediction)

    await db.commit()
    await db.refresh(prediction)

    return {
        "id": prediction.id,
        "match_id": prediction.match_id,
        "home_score": prediction.home_score,
        "away_score": prediction.away_score,
        "points_earned": prediction.points_earned,
    }


@router.get("/leaderboard")
async def get_leaderboard(db: AsyncSession = Depends(get_session)) -> dict[str, Any]:
    result = await db.execute(select(User).order_by(desc(User.points)))  # type: ignore[arg-type]
    users = result.scalars().all()

    leaderboard_list = [
        {
            "id": u.id,
            "telegram_id": u.telegram_id,
            "full_name": u.full_name,
            "username": u.username,
            "points": u.points,
        }
        for u in users
    ]

    roast = ""
    if len(users) >= 1:
        first_user = users[0]
        last_user = users[-1]
        roast = random.choice(ROAST_TEMPLATES).format(
            first_user=first_user.full_name,
            first_points=first_user.points,
            last_user=last_user.full_name,
            last_points=last_user.points,
        )

    return {
        "users": leaderboard_list,
        "roast": roast,
    }
