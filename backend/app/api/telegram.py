import random

from fastapi import APIRouter, Depends, Request
from sqlalchemy import asc, desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session
from app.models.models import Match, User
from app.services.match_service import MatchService
from app.services.telegram_service import TelegramService

router = APIRouter(prefix="/telegram", tags=["telegram"])

ROAST_TEMPLATES = [
    "<b>{last_user}</b> va el último con {last_points} puntos. ¡{last_user}, espabila! ¿A quién se le ocurre que va a ganar Uganda a Brasil? 🤦‍♂️",
    "<b>{first_user}</b> lidera la porra con {first_points} puntos. ¡{first_user}, baja de ahí que hace frío! 🥶",
    "Clasificación actualizada. Parece que <b>{last_user}</b> ({last_points} pts) está jugando con las reglas de otro deporte. ¡Ánimo! 📈",
    "<b>{first_user}</b> ({first_points} pts) está imparable. ¿Habrá comprado el pulpo Paul o tiene información privilegiada? 🐙",
    "Por favor, que alguien le enseñe a <b>{last_user}</b> ({last_points} pts) cómo funciona el fuera de juego... ⚽️",
]


@router.post("/webhook")
async def telegram_webhook(
    request: Request, db: AsyncSession = Depends(get_session)
) -> dict[str, str]:
    try:
        payload = await request.json()
    except Exception:
        return {"status": "invalid json"}

    message = payload.get("message")
    if not message or "text" not in message:
        return {"status": "no text message"}

    chat_id = message["chat"]["id"]
    from_user = message["from"]
    telegram_id = str(from_user["id"])
    username = from_user.get("username")
    first_name = from_user.get("first_name", "")
    last_name = from_user.get("last_name", "")
    full_name = f"{first_name} {last_name}".strip() or "Participante"

    text = message["text"].strip()

    # Route commands
    if text.startswith("/start"):
        await handle_start(chat_id, telegram_id, username, full_name, db)
    elif text.startswith("/ayuda"):
        await handle_ayuda(chat_id)
    elif text.startswith("/resultados"):
        await handle_resultados(chat_id, db)
    elif text.startswith("/clasificacion"):
        await handle_clasificacion(chat_id, db)
    elif text.startswith("/consulada"):
        await handle_consulada(chat_id, db)

    return {"status": "processed"}


async def handle_start(
    chat_id: int, telegram_id: str, username: str | None, full_name: str, db: AsyncSession
) -> None:
    # Register user if not exists
    result = await db.execute(select(User).where(User.telegram_id == telegram_id))  # type: ignore[arg-type]
    user = result.scalars().first()

    if not user:
        user = User(telegram_id=telegram_id, username=username, full_name=full_name)
        db.add(user)
        await db.commit()
        msg = f"¡Hola <b>{full_name}</b>! Bienvenido/a a la Porra Deportiva del Mundial 2026. 🏆\n\nYa estás registrado. Usa /ayuda para ver los comandos disponibles."
    else:
        msg = f"¡Hola de nuevo, <b>{full_name}</b>! Ya estás registrado en el juego. Escribe /ayuda para ver qué puedo hacer."

    await TelegramService.send_message(chat_id, msg)


async def handle_ayuda(chat_id: int) -> None:
    msg = (
        "<b>Comandos disponibles:</b>\n\n"
        "/resultados - Ver los partidos de hoy (se actualizan automáticamente)\n"
        "/clasificacion - Tabla de posiciones del grupo\n"
        "/consulada - Tabla de posiciones con un toque de humor sarcástico 🍿\n"
        "/ayuda - Muestra este mensaje"
    )
    await TelegramService.send_message(chat_id, msg)


async def handle_resultados(chat_id: int, db: AsyncSession) -> None:
    await TelegramService.send_message(chat_id, "<i>Actualizando partidos...</i>")

    # Lazy update!
    await MatchService.update_matches_if_needed(db)

    # Fetch today's matches (for demo/implementation purposes, let's fetch the next 5 matches)
    result = await db.execute(select(Match).order_by(asc(Match.date)).limit(5))  # type: ignore[arg-type]
    matches = result.scalars().all()

    if not matches:
        msg = "No hay partidos registrados en el sistema todavía."
    else:
        msg = "<b>Partidos del Mundial:</b>\n\n"
        for m in matches:
            home_s = m.home_score if m.home_score is not None else "-"
            away_s = m.away_score if m.away_score is not None else "-"
            status_str = f"({m.status})" if m.status != "NS" else ""
            msg += f"⚽️ {m.home_team} {home_s} - {away_s} {m.away_team} {status_str}\n🕒 {m.date.strftime('%d/%m %H:%M')}\n\n"

    await TelegramService.send_message(chat_id, msg)


async def handle_clasificacion(chat_id: int, db: AsyncSession) -> None:
    result = await db.execute(select(User).order_by(desc(User.points)))  # type: ignore[arg-type]
    users = result.scalars().all()

    if not users:
        msg = "No hay participantes registrados todavía en la porra."
    else:
        msg = "<b>🏆 CLASIFICACIÓN DE LA PORRA 🏆</b>\n\n"
        for idx, u in enumerate(users, start=1):
            msg += f"{idx}. {u.full_name} - <b>{u.points} pts</b>\n"

    await TelegramService.send_message(chat_id, msg)


async def handle_consulada(chat_id: int, db: AsyncSession) -> None:
    # Fetch classification
    result = await db.execute(select(User).order_by(desc(User.points)))  # type: ignore[arg-type]
    users = result.scalars().all()

    if not users or len(users) < 1:
        await TelegramService.send_message(
            chat_id, "No hay suficientes participantes para hacer la consulada."
        )
        return

    # Standard classification list
    msg = "<b>🏆 LA CONSULADA: CLASIFICACIÓN Y PULLAS 🍿</b>\n\n"
    for idx, u in enumerate(users, start=1):
        msg += f"{idx}. {u.full_name} - <b>{u.points} pts</b>\n"

    msg += "\n---\n💬 <b>Comentario técnico:</b>\n"

    # Generate dynamic roast based on participants
    first_user = users[0]
    last_user = users[-1]

    roast = random.choice(ROAST_TEMPLATES).format(
        first_user=first_user.full_name,
        first_points=first_user.points,
        last_user=last_user.full_name,
        last_points=last_user.points,
    )
    msg += roast

    await TelegramService.send_message(chat_id, msg)
