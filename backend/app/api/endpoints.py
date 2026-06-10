import random
from datetime import UTC, datetime
from typing import Any, cast

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel
from sqlalchemy import asc, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.telegram import ROAST_TEMPLATES
from app.db.session import get_session
from app.models.models import Match, Prediction, TournamentPrediction, User
from app.services.match_service import MatchService, calculate_points

router = APIRouter(prefix="/api", tags=["api"])


class TournamentPredictionResponse(BaseModel):
    champion: str | None = None
    runner_up: str | None = None
    top_scorer: str | None = None
    best_goalkeeper: str | None = None
    surprise_team: str | None = None


class TournamentPredictionRequest(BaseModel):
    champion: str | None = None
    runner_up: str | None = None
    top_scorer: str | None = None
    best_goalkeeper: str | None = None
    surprise_team: str | None = None



class AuthRequest(BaseModel):
    username_or_id: str


class RegisterRequest(BaseModel):
    username: str
    full_name: str


class PredictionRequest(BaseModel):
    match_id: int
    home_score: int
    away_score: int
    penalty_winner_home: bool | None = None


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


@router.post("/register")
async def register(
    payload: RegisterRequest, db: AsyncSession = Depends(get_session)
) -> dict[str, Any]:
    username = payload.username.strip().replace("@", "").lower()
    full_name = payload.full_name.strip()

    if not username:
        raise HTTPException(status_code=400, detail="El nombre de usuario es obligatorio.")
    if not full_name:
        full_name = username

    # Check if username already exists case-insensitively
    result = await db.execute(select(User).where(func.lower(User.username) == username))
    if result.scalars().first():
        raise HTTPException(status_code=400, detail="El nombre de usuario ya está registrado.")

    # Check if telegram_id already exists case-insensitively
    result = await db.execute(select(User).where(func.lower(User.telegram_id) == username))
    if result.scalars().first():
        raise HTTPException(status_code=400, detail="El identificador ya está registrado.")

    new_user = User(
        telegram_id=username,
        username=username,
        full_name=full_name,
        points=0
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    return {
        "id": new_user.id,
        "telegram_id": new_user.telegram_id,
        "username": new_user.username,
        "full_name": new_user.full_name,
        "points": new_user.points,
    }


@router.post("/auth")
async def authenticate(
    payload: AuthRequest, db: AsyncSession = Depends(get_session)
) -> dict[str, Any]:
    search_str = payload.username_or_id.strip().replace("@", "").lower()

    # Try looking up by telegram_id directly (case-insensitive)
    result = await db.execute(select(User).where(func.lower(User.telegram_id) == search_str))
    user = result.scalars().first()

    # Try looking up by username (case-insensitive)
    if not user:
        result = await db.execute(select(User).where(func.lower(User.username) == search_str))
        user = result.scalars().first()

    if not user:
        raise HTTPException(
            status_code=404,
            detail="Usuario no encontrado. Regístrate en la pantalla de inicio o usa el bot de Telegram.",
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
            "group": m.group,
            "stage": m.stage,
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
            "penalty_winner_home": p.penalty_winner_home,
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
        prediction.penalty_winner_home = payload.penalty_winner_home
    else:
        prediction = Prediction(
            user_id=cast(int, current_user.id),
            match_id=payload.match_id,
            home_score=payload.home_score,
            away_score=payload.away_score,
            penalty_winner_home=payload.penalty_winner_home,
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
        "penalty_winner_home": prediction.penalty_winner_home,
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


@router.get("/tournament-predictions", response_model=TournamentPredictionResponse)
async def get_tournament_predictions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> TournamentPredictionResponse:
    result = await db.execute(
        select(TournamentPrediction).where(TournamentPrediction.user_id == current_user.id)  # type: ignore[arg-type]
    )
    pred = result.scalars().first()
    if not pred:
        return TournamentPredictionResponse()
    return TournamentPredictionResponse(
        champion=pred.champion,
        runner_up=pred.runner_up,
        top_scorer=pred.top_scorer,
        best_goalkeeper=pred.best_goalkeeper,
        surprise_team=pred.surprise_team,
    )


@router.post("/tournament-predictions", response_model=TournamentPredictionResponse)
async def save_tournament_predictions(
    payload: TournamentPredictionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> TournamentPredictionResponse:
    result = await db.execute(
        select(TournamentPrediction).where(TournamentPrediction.user_id == current_user.id)  # type: ignore[arg-type]
    )
    pred = result.scalars().first()

    now = datetime.utcnow()
    if pred:
        pred.champion = payload.champion
        pred.runner_up = payload.runner_up
        pred.top_scorer = payload.top_scorer
        pred.best_goalkeeper = payload.best_goalkeeper
        pred.surprise_team = payload.surprise_team
        pred.last_updated = now
    else:
        pred = TournamentPrediction(
            user_id=current_user.id,
            champion=payload.champion,
            runner_up=payload.runner_up,
            top_scorer=payload.top_scorer,
            best_goalkeeper=payload.best_goalkeeper,
            surprise_team=payload.surprise_team,
            last_updated=now,
        )
        db.add(pred)

    await db.commit()
    return TournamentPredictionResponse(
        champion=pred.champion,
        runner_up=pred.runner_up,
        top_scorer=pred.top_scorer,
        best_goalkeeper=pred.best_goalkeeper,
        surprise_team=pred.surprise_team,
    )


@router.post("/debug/simulate-real-scores")
async def simulate_real_scores(
    db: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    # Select all matches
    result = await db.execute(select(Match))
    matches = result.scalars().all()

    now = datetime.utcnow()
    updated_count = 0
    for m in matches:
        home_score = random.randint(0, 4)
        away_score = random.randint(0, 4)

        score_changed = m.home_score != home_score or m.away_score != away_score

        m.home_score = home_score
        m.away_score = away_score
        m.status = "FT"
        m.last_updated = now

        if score_changed:
            pred_result = await db.execute(
                select(Prediction).where(Prediction.match_id == m.id)  # type: ignore[arg-type]
            )

            predictions = pred_result.scalars().all()
            for prediction in predictions:
                new_points = calculate_points(
                    prediction.home_score, prediction.away_score, home_score, away_score
                )
                prediction.points_earned = new_points
                db.add(prediction)
        updated_count += 1

    # Recalculate all user points consolidated
    await MatchService.recalculate_all_users_points(db)
    await db.commit()
    return {"message": f"Simulated scores for {updated_count} matches.", "success": True}

