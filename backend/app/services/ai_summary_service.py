import logging
from collections.abc import Sequence
from datetime import datetime, time, timedelta
from typing import cast
from zoneinfo import ZoneInfo

import httpx
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.models import DailySummary, Match, Prediction, User

logger = logging.getLogger(__name__)

class AISummaryService:
    @staticmethod
    async def get_overall_rankings_str(db: AsyncSession) -> str:
        """Helper to fetch overall rankings directly from the database."""
        user_query = select(User).order_by(desc(User.points))  # type: ignore[arg-type]
        user_result = await db.execute(user_query)
        all_users = user_result.scalars().all()
        overall_rankings = [f"{u.full_name} ({u.points} pts)" for u in all_users]
        return ", ".join(overall_rankings)

    @staticmethod
    async def generate_daily_summary(db: AsyncSession, summary_date: str) -> DailySummary:
        """
        Generates and saves the daily summary for the given date (format YYYY-MM-DD).
        If a summary already exists, it is overwritten.
        """
        # Update matches from API and force points recalculation so database is up-to-date
        from app.services.match_service import MatchService
        await MatchService.update_matches_if_needed(db)
        await MatchService.recalculate_all_users_points(db)

        # Parse date and find matches played on that calendar day
        try:
            target_date = datetime.strptime(summary_date, "%Y-%m-%d").date()
        except ValueError as e:
            raise ValueError("El formato de fecha debe ser YYYY-MM-DD") from e

        madrid_tz = ZoneInfo("Europe/Madrid")
        local_start = datetime.combine(target_date, time.min).replace(tzinfo=madrid_tz)
        local_end = datetime.combine(target_date, time.max).replace(tzinfo=madrid_tz)
        start_dt = local_start.astimezone(ZoneInfo("UTC")).replace(tzinfo=None)
        end_dt = local_end.astimezone(ZoneInfo("UTC")).replace(tzinfo=None)

        # Get matches
        match_query = select(Match).where(Match.date >= start_dt, Match.date <= end_dt)  # type: ignore[arg-type]
        match_result = await db.execute(match_query)
        matches = match_result.scalars().all()

        # Query yesterday's summary and yesterday's matches/predictions for AI context (memory)
        yesterday_date = target_date - timedelta(days=1)
        local_start_yesterday = datetime.combine(yesterday_date, time.min).replace(tzinfo=madrid_tz)
        local_end_yesterday = datetime.combine(yesterday_date, time.max).replace(tzinfo=madrid_tz)
        start_yesterday = local_start_yesterday.astimezone(ZoneInfo("UTC")).replace(tzinfo=None)
        end_yesterday = local_end_yesterday.astimezone(ZoneInfo("UTC")).replace(tzinfo=None)

        # 1. Get yesterday's written summary text
        yesterday_summary_text = "No hay crónica registrada para el día anterior."
        yesterday_summary_query = select(DailySummary).where(DailySummary.summary_date == str(yesterday_date))  # type: ignore[arg-type]
        yesterday_summary_result = await db.execute(yesterday_summary_query)
        yesterday_summary_obj = yesterday_summary_result.scalars().first()
        if yesterday_summary_obj:
            yesterday_summary_text = yesterday_summary_obj.content

        # 2. Get matches from yesterday with predictions and final points (without timestamp filtering)
        yesterday_match_query = select(Match).where(Match.date >= start_yesterday, Match.date <= end_yesterday)  # type: ignore[arg-type]
        yesterday_match_result = await db.execute(yesterday_match_query)
        yesterday_matches = yesterday_match_result.scalars().all()

        yesterday_reports = []
        for pm in yesterday_matches:
            status_desc = "FINALIZADO" if pm.status == "FT" else pm.status
            score_desc = f"{pm.home_score}-{pm.away_score}" if pm.home_score is not None else "Sin jugar"
            match_info = f"Partido: {pm.home_team} vs {pm.away_team} | Estado: {status_desc} | Marcador Real Final: {score_desc}"
            
            prediction_lines = []
            pred_query = select(Prediction, User).join(User).where(Prediction.match_id == pm.id)  # type: ignore[arg-type]
            pred_result = await db.execute(pred_query)
            predictions_with_users = pred_result.all()

            for pred, user in predictions_with_users:
                pred_desc = f"{pred.home_score}-{pred.away_score}"
                points_desc = f"+{pred.points_earned} pts (DEFINITIVOS)"
                prediction_lines.append(f"  - {user.full_name}: pronosticó {pred_desc} -> {points_desc}")
            
            if not prediction_lines:
                prediction_lines.append("  - Nadie hizo predicciones para este partido.")
            
            yesterday_reports.append(match_info + "\n" + "\n".join(prediction_lines))

        if not matches:
            content = f"Hoy ({summary_date}) no se disputó ningún partido del Mundial. ¡Día de descanso y siesta para los participantes!"
            return await AISummaryService._save_summary(db, summary_date, content)

        # Gather results and predictions data for today
        match_reports = []
        user_scores_today: dict[int, float] = {}  # user_id -> points_today
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
        pending_section = ""
        if yesterday_reports:
            pending_section = (
                "=== CRÓNICA DEL DÍA ANTERIOR (MEMORIA) ===\n"
                f"{yesterday_summary_text}\n\n"
                "=== PARTIDOS Y PRONÓSTICOS DE AYER ===\n"
                + "\n\n".join(yesterday_reports) + "\n\n"
            )

        matches_section = "\n\n".join(match_reports)
        rankings_section = "\n".join(rankings_today)

        prompt = f"""Eres el Cronista Oficial de la Porra del Mundial 2026. Tu estilo es ingenioso, divertido, futbolero y competitivo (con piques sanos pero graciosos entre los participantes). Alguien que sabe mucho de fútbol y comenta la porra con humor, destacando aciertos heroicos y fallos catastróficos.

Escribe una crónica diaria para el día {summary_date} basada en los siguientes datos:

{pending_section}PARTIDOS Y PRONÓSTICOS DE HOY:
{matches_section}

PUNTUACIÓN TOTAL DEFINITIVA DEL DÍA (solo de partidos finalizados):
{rankings_section}

Instrucciones:
1. EXTENSIÓN CORTA Y DINÁMICA: Sé breve, directo y al grano. La crónica debe ocupar un párrafo por cada partido comentado (de no más de 3 líneas) y una o dos líneas de cierre. NO escribas ningún título, cabecera ni clasificación al principio. Empieza directamente con el primer párrafo del comentario.
2. REGLA CRÍTICA DE ESTADOS: Distingue claramente entre partidos FINALIZADOS, EN JUEGO y NO EMPEZADOS. Comenta los finalizados de forma rápida destacando aciertos. Comenta los en juego o no empezados en futuro o condicional, NUNCA como si ya hubieran terminado.
3. GLOSARIO LOCAL (VARIADO Y SIN REPETIR): Utiliza los siguientes términos de forma variada y natural, sin abusar. No metas todos los términos en el mismo texto ni repitas siempre los mismos conectores o frases (por ejemplo, evita muletillas rígidas como 'veremos qué hace el dado' o similares). Selecciona únicamente 2 o 3 términos del glosario que encajen mejor con el contexto del partido de hoy y varía la elección en cada crónica:
   - 'embudo': locura, excentricidad (ej. 'menudo embudo de pronóstico').
   - 'ponerse un embudo': volverse loco.
   - 'la glora': la selección española. (nunca la gloria ni nada similar, estrictamente La glora)
   - 'el lama': el futbolista Lamine Yamal (que es muy bueno y desatasca partidos).
   - 'el ferro': el futbolista Ferrán Torres (que es muy malo).
   - 'el dado': el entrenador de España.
   - 'la rapa': Raphinha.
   - 'meso' o 'mesón': Messi.
   - 'países zes' o 'países meninos' o 'países cés': Países Bajos (Holanda).
   - 'moros': cualquier equipo que sale a poner el cerrojazo.
   - 'el gitano' o 'el gincho' o 'méndez': un empresario de publicidad muy religioso al que le gustan los grandes eventos. Busca metáforas de fútbol para él.
   - 'el fercho' o 'fersu' o 'ferchongo' o 'ferchongazo' o 'el uarro' o 'el cerdo': un jugador de la selección española lesionado que no pudo ir al mundial. Habla de él cuando un partido esté atascado (ej. 'ay si estuviera el fercho...').
   - 'el cé' o 'menino': un empresario de la construcción extremadamente pequeñito. De gente o cosas muy pequeñas se dice que son cés. Se relaciona con 'países cés' (Países Bajos).
   - 'negros': equipos alegres, que no son grandes potencias pero juegan con desparpajo y atacan mucho.
   - 'zarik': un tipo metódico, fino y minucioso (como un diseñador que pasa horas moviendo/meneando un solo píxel).
   - 'el bomba': director creativo especializado en destruir ideas (llevado a otros aspectos como destruir jugadas o cosas).
   - 'la yorra' o 'yorrón' o 'yorrazo': la propia porra en la que participamos.
   - 'llevar goles': ser goleado (ej. 'han llevado goles').
   - 'el filmo': preparador físico de categorías bajas con pelo de rata y muchas ínfulas, que en sus fantasías prepotentes diría que conoce a todos los jugadores del mundial.
4. PROSA NATURAL Y EVITAR PLANTILLAS: Escribe con un estilo periodístico-deportivo desenfadado pero natural. Evita estructurar todas las crónicas o párrafos de la misma manera (por ejemplo, no empieces siempre los párrafos con el nombre de los participantes o con la misma fórmula). Varía tus oraciones para que cada crónica se lea fresca, única y original.
5. TONO Y EXPRESIONES PARTICULARES: Cuando algo esté bien, di "qué bello" o "og qué bello". Dirígete o habla de los participantes usando términos como "macho" o "niño" (ej. "og qué bello el gol del cé, niño", "macho, menuda jugada"). Escribe en español de España de manera natural, cercana y divertida.
6. REGLA DE PUNTUACIONES: NO menciones, calcules, ni intentes deducir clasificaciones generales o puntuaciones acumuladas en la crónica. No digas cosas como 'Edu va primero con X puntos' o 'se pone líder'. Céntrate únicamente en comentar las predicciones y aciertos de los partidos de hoy/ayer de forma individual.
7. NO USES ASTERISCOS PARA DIFERENCIAR O DESTACAR NADA: es decir, que no se vean diferencias estilísticas dentro de la crónica sino un texto corrido y natural.
8. MEMORIA Y REPASO DE PARTIDOS PENDIENTES: Revisa la 'CRÓNICA DEL DÍA ANTERIOR' y contrástala con 'PARTIDOS Y PRONÓSTICOS DE AYER'. Si en la crónica anterior un partido ya aparecía descrito como finalizado definitivamente, ¡NO vuelvas a hablar de él hoy! Solo debes repasar los partidos de ayer que aparecían en juego, no empezados, provisionales o no mencionados. Comenta brevemente su desenlace final y los puntos ganados por los participantes de manera muy específica (ej. 'Ayer al final el EQUIPO A - EQUIPO B acabó 1-1, por lo que Edu se llevó 3 puntazos al casillero...')."""

        content = await AISummaryService._call_gemini_api(prompt, matches, rankings_today)
        return await AISummaryService._save_summary(db, summary_date, content)

    @staticmethod
    async def _call_gemini_api(prompt: str, matches: Sequence[Match], rankings_today: list[str]) -> str:
        api_key = settings.GEMINI_API_KEY
        if api_key:
            api_key = api_key.strip().strip("'").strip('"')
            
        if not api_key:
            logger.warning("GEMINI_API_KEY no está configurada. Usando fallback local humorístico.")
            return AISummaryService._generate_fallback_summary(matches, rankings_today)

        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key={api_key}"
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
                        f"⚠️ ¡La IA de la Porra se ha quedado sin cobertura en el estadio! "
                        f"El servidor de Gemini ha devuelto un error ({response.status_code}). "
                        "¡Mira la tabla general para ver cómo han quedado los puntos!"
                    )
        except Exception as e:
            logger.exception("Excepción al conectar con la API de Gemini")
            error_details = f"{type(e).__name__}: {str(e)}" if str(e) else f"{type(e).__name__}"
            return (
                f"⚠️ Error de conexión al generar la crónica diaria ({error_details}). "
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
