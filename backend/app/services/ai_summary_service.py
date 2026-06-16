import logging
from collections.abc import Sequence
from datetime import datetime, time, timedelta
from typing import cast

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.models import DailySummary, Match, Prediction, User

logger = logging.getLogger(__name__)

class AISummaryService:
    @staticmethod
    async def generate_daily_summary(db: AsyncSession, summary_date: str) -> DailySummary:
        """
        Generates and saves the daily summary for the given date (format YYYY-MM-DD).
        If a summary already exists, it is overwritten.
        """
        # Parse date and find matches played on that calendar day
        try:
            target_date = datetime.strptime(summary_date, "%Y-%m-%d").date()
        except ValueError as e:
            raise ValueError("El formato de fecha debe ser YYYY-MM-DD") from e

        start_dt = datetime.combine(target_date, time.min)
        end_dt = datetime.combine(target_date, time.max)

        # Get matches
        match_query = select(Match).where(Match.date >= start_dt, Match.date <= end_dt)  # type: ignore[arg-type]
        match_result = await db.execute(match_query)
        matches = match_result.scalars().all()

        # Query matches from the previous day that are now finalized (FT)
        yesterday_date = target_date - timedelta(days=1)
        start_yesterday = datetime.combine(yesterday_date, time.min)
        end_yesterday = datetime.combine(yesterday_date, time.max)
        yesterday_query = select(Match).where(
            Match.date >= start_yesterday,
            Match.date <= end_yesterday,
            Match.status == "FT"
        )  # type: ignore[arg-type]
        yesterday_result = await db.execute(yesterday_query)
        pending_matches = yesterday_result.scalars().all()
        pending_reports = []
        for pm in pending_matches:
            pending_reports.append(f"Resultado pendiente del día anterior: {pm.home_team} {pm.home_score}-{pm.away_score} {pm.away_team} (FINALIZADO)")

        if not matches:
            content = f"Hoy ({summary_date}) no se disputó ningún partido del Mundial. ¡Día de descanso y siesta para los participantes!"
            return await AISummaryService._save_summary(db, summary_date, content)

        # Gather results and predictions data
        match_reports = []
        user_scores_today: dict[int, int] = {}  # user_id -> points_today
        user_names = {}

        for match in matches:
            if match.status == "FT":
                status_desc = "FINALIZADO"
                score_desc = f"{match.home_score}-{match.away_score}"
            elif match.status == "NS":
                status_desc = "NO EMPEZADO"
                score_desc = "Sin jugar"
            else:
                status_desc = "EN JUEGO"
                score_desc = f"{match.home_score}-{match.away_score} (provisional)"
            
            match_info = f"Partido: {match.home_team} vs {match.away_team} | Estado: {status_desc} | Marcador Real/Actual: {score_desc}"
            prediction_lines = []

            # Get predictions for this match
            pred_query = select(Prediction, User).join(User).where(Prediction.match_id == match.id)  # type: ignore[arg-type]
            pred_result = await db.execute(pred_query)
            predictions_with_users = pred_result.all()

            for pred, user in predictions_with_users:
                user_names[user.id] = user.full_name
                
                pred_desc = f"{pred.home_score}-{pred.away_score}"
                if match.status == "FT":
                    user_scores_today[user.id] = user_scores_today.get(user.id, 0) + pred.points_earned
                    points_desc = f"+{pred.points_earned} pts (DEFINITIVOS)"
                elif match.status == "NS":
                    points_desc = "0 pts (Aún no jugado)"
                else:
                    from app.services.match_service import calculate_points
                    h_score = match.home_score if match.home_score is not None else 0
                    a_score = match.away_score if match.away_score is not None else 0
                    prov_points = calculate_points(pred.home_score, pred.away_score, h_score, a_score)
                    points_desc = f"+{prov_points} pts (PROVISIONALES con el marcador actual)"
                
                prediction_lines.append(f"  - {user.full_name}: pronosticó {pred_desc} -> {points_desc}")
            
            if not prediction_lines:
                prediction_lines.append("  - Nadie hizo predicciones para este partido.")
            
            match_reports.append(match_info + "\n" + "\n".join(prediction_lines))

        # Summarize who won the most points today
        rankings_today = []
        if user_scores_today:
            sorted_users = sorted(user_scores_today.items(), key=lambda x: x[1], reverse=True)
            for uid, pts in sorted_users:
                rankings_today.append(f"{user_names[uid]}: +{pts} puntos hoy (solo de partidos finalizados)")
        else:
            rankings_today.append("Nadie ha sumado puntos definitivos hoy.")

        # Build prompt
        prompt = (
            "Eres el Cronista Oficial de la Porra del Mundial 2026. Tu estilo es ingenioso, divertido, futbolero "
            "y competitivo (con piques sanos pero graciosos entre los participantes). Alguien que sabe mucho de fútbol "
            "y comenta la porra con humor, destacando aciertos heroicos y fallos catastróficos.\n\n",
            f"Escribe una crónica diaria para el día {summary_date} basada en los siguientes datos:\n\n"
            # Include pending results from previous day if any
            + ("\n".join(pending_reports) + "\n\n" if pending_reports else "")
            "PARTIDOS Y PRONÓSTICOS DE HOY:\n"
            + "\n\n".join(match_reports)
            + "\n\nPUNTUACIÓN TOTAL DEFINITIVA DEL DÍA (solo de partidos finalizados):\n"
            + "\n".join(rankings_today)
            + "\n\nInstrucciones:\n"
            "1. EXTENSIÓN CORTA: Sé breve, directo y al grano. La crónica debe ocupar: una o dos líneas de título, un párrafo por cada partido comentado de no más de 3 líneas, una o dos líneas de cierre.\n"
            "2. REGLA CRÍTICA DE ESTADOS: Distingue claramente entre partidos FINALIZADOS, EN JUEGO y NO EMPEZADOS.\n"
            "   - Para partidos FINALIZADOS: Comenta el resultado definitivo de forma rápida y destaca aciertos de marcador exacto.\n"
            "   - Para partidos EN JUEGO o NO EMPEZADOS: Habla de ellos en futuro o condicional (ej. 'Edu va ganando..., pero todo puede cambiar si Uganda gana a México...'). NUNCA los comentes como si ya hubieran terminado.\n"
            "3. GLOSARIO LOCAL (úsalos con moderación y gracia, sin abusar):\n"
            "   - 'embudo': locura, excentricidad (ej. 'menudo embudo de pronóstico').\n"
            "   - 'ponerse un embudo': volverse loco.\n"
            "   - 'la glora': la selección española. (nunca la gloria ni nada simular, estrictamente La glora)\n"
            "   - 'el lama': el futbolista Lamine Yamal (que es muy bueno y desatasca partidos).\n"
            "   - 'el ferro': el futbolista Ferrán Torres (que es muy malo).\n"
            "   - 'el dado': el entrenador de España.\n"
            "   - 'la rapa': Raphinha.\n"
            "   - 'meso' o 'mesón': Messi.\n"
            "   - 'países zes' o 'países meninos': Países Bajos.\n"
            "   - 'moros': cualquier equipo que sale a poner el cerrojazo.\n"
            "4. Escribe en español de España de manera natural, cercana y divertida."
            "5. NO USES ASTERISCOS PARA DIFERENCIAR O DESTACAR NADA: es decir, que no se vean diferencias estilísticas dentro de la crónica sino un texto corrido y natural\n"
        )

        content = await AISummaryService._call_gemini_api(prompt, matches, rankings_today)
        return await AISummaryService._save_summary(db, summary_date, content)

    @staticmethod
    async def _call_gemini_api(prompt: str, matches: Sequence[Match], rankings_today: list[str]) -> str:
        api_key = settings.GEMINI_API_KEY
        if not api_key:
            logger.warning("GEMINI_API_KEY no está configurada. Usando fallback local humorístico.")
            return AISummaryService._generate_fallback_summary(matches, rankings_today)

        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
        headers = {"Content-Type": "application/json"}
        payload = {
            "contents": [{
                "parts": [{"text": prompt}]
            }]
        }

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(url, json=payload, headers=headers, timeout=15.0)
                if response.status_code == 200:
                    data = response.json()
                    # Extract text content from Gemini response structure
                    text_content = data['candidates'][0]['content']['parts'][0]['text']
                    return cast(str, text_content).strip()
                else:
                    logger.error(f"Error llamando a Gemini API: {response.status_code} - {response.text}")
                    return (
                        "⚠️ ¡La IA de la Porra se ha quedado sin cobertura en el estadio! "
                        "El servidor de Gemini ha devuelto un error, pero te aseguramos que hoy ha habido emoción "
                        "de la buena. ¡Mira la tabla general para ver cómo han quedado los puntos!"
                    )
        except Exception as e:
            logger.exception("Excepción al conectar con la API de Gemini")
            return (
                f"⚠️ Error de conexión al generar la crónica diaria: {str(e)}. "
                "¡Por favor, comprueba tu conexión a internet o la configuración del archivo .env!"
            )

    @staticmethod
    def _generate_fallback_summary(matches: Sequence[Match], rankings_today: list[str]) -> str:
        """Generates a nice, dynamic mock summary so that the app behaves beautifully without an API key."""
        matches_parts = []
        for m in matches:
            if m.status == "FT":
                matches_parts.append(f"{m.home_team} {m.home_score}-{m.away_score} {m.away_team} (Finalizado)")
            elif m.status == "NS":
                matches_parts.append(f"{m.home_team} vs {m.away_team} (No empezado)")
            else:
                matches_parts.append(f"{m.home_team} {m.home_score}-{m.away_score} {m.away_team} (En juego)")
        matches_summary = ", ".join(matches_parts)
        rankings_summary = ", ".join(rankings_today)
        
        return (
            "🤖 **[Crónica de Simulación - Sin GEMINI_API_KEY]**\n\n"
            f"¡Menuda jornada hemos vivido! Hoy los estadios han vibrado con los siguientes encuentros: **{matches_summary}**.\n\n"
            "Nuestros intrépidos participantes lo han dado todo en sus predicciones. Haciendo cuentas de las puntuaciones "
            f"de hoy, el reparto de gloria queda de la siguiente manera: **{rankings_summary}**.\n\n"
            "¡El pique está que arde! Algunos han demostrado tener un ojo clínico digno de un seleccionador nacional, "
            "mientras que otros deberían dedicarse a la petanca. ¡Mañana más y mejor!\n\n"
            "*(Para activar crónicas personalizadas detalladas generadas por IA, recuerda añadir la clave `GEMINI_API_KEY` en tu archivo `.env`)*"
        )

    @staticmethod
    async def _save_summary(db: AsyncSession, summary_date: str, content: str) -> DailySummary:
        # Check if already exists
        query = select(DailySummary).where(DailySummary.summary_date == summary_date)  # type: ignore[arg-type]
        result = await db.execute(query)
        existing = result.scalars().first()

        if existing:
            existing.content = content
            existing.created_at = datetime.utcnow()
            db.add(existing)
            await db.commit()
            await db.refresh(existing)
            return existing
        else:
            new_summary = DailySummary(summary_date=summary_date, content=content)
            db.add(new_summary)
            await db.commit()
            await db.refresh(new_summary)
            return new_summary
