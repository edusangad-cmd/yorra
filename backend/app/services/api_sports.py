from datetime import datetime
from typing import Any

import httpx


class APISportsClient:
    BASE_URL = "https://worldcup26.ir/get"

    def __init__(self) -> None:
        pass

    def translate_team_name(self, name: str | None) -> str:
        if not name:
            return ""

        # Placeholders translations
        name = name.replace("Winner Group ", "1º Grupo ")
        name = name.replace("Runner-up Group ", "2º Grupo ")
        name = name.replace("Winner Match ", "Ganador Partido ")
        name = name.replace("Loser Match ", "Perdedor Partido ")

        # Country translations
        country_map = {
            'Algeria': 'Argelia',
            'Argentina': 'Argentina',
            'Australia': 'Australia',
            'Austria': 'Austria',
            'Belgium': 'Bélgica',
            'Bosnia and Herzegovina': 'Bosnia y Herzegovina',
            'Brazil': 'Brasil',
            'Canada': 'Canadá',
            'Cape Verde': 'Cabo Verde',
            'Colombia': 'Colombia',
            'Croatia': 'Croacia',
            'Curaçao': 'Curazao',
            'Czech Republic': 'República Checa',
            'Czechia': 'República Checa',
            'Democratic Republic of the Congo': 'República Democrática del Congo',
            'Ecuador': 'Ecuador',
            'Egypt': 'Egipto',
            'England': 'Inglaterra',
            'France': 'Francia',
            'Germany': 'Alemania',
            'Ghana': 'Ghana',
            'Haiti': 'Haití',
            'Iran': 'Irán',
            'Iraq': 'Irak',
            'Ivory Coast': 'Costa de Marfil',
            'Japan': 'Japón',
            'Jordan': 'Jordania',
            'Mexico': 'México',
            'Morocco': 'Marruecos',
            'Netherlands': 'Países Bajos',
            'New Zealand': 'Nueva Zelanda',
            'Norway': 'Noruega',
            'Panama': 'Panamá',
            'Paraguay': 'Paraguay',
            'Portugal': 'Portugal',
            'Qatar': 'Catar',
            'Saudi Arabia': 'Arabia Saudí',
            'Scotland': 'Escocia',
            'Senegal': 'Senegal',
            'South Africa': 'Sudáfrica',
            'South Korea': 'Corea del Sur',
            'Spain': 'España',
            'Sweden': 'Suecia',
            'Switzerland': 'Suiza',
            'Tunisia': 'Túnez',
            'Turkey': 'Turquía',
            'United States': 'Estados Unidos',
            'Uruguay': 'Uruguay',
            'Uzbekistan': 'Uzbekistán'
        }
        return country_map.get(name, name)

    async def get_world_cup_fixtures(self) -> list[dict[str, Any]]:
        """
        Fetch World Cup 2026 fixtures from the public free API.
        """
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.BASE_URL}/games",
                timeout=15.0
            )
            response.raise_for_status()
            data = response.json()
            games = data.get("games", [])

            mapped_fixtures = []
            for g in games:
                finished = g.get("finished") == "TRUE"
                time_elapsed = g.get("time_elapsed")

                status_short = "FT" if finished else ("NS" if time_elapsed == "notstarted" else "1H")

                home_score = None
                away_score = None
                if finished or time_elapsed != "notstarted":
                    try:
                        home_score = int(g.get("home_score", 0))
                        away_score = int(g.get("away_score", 0))
                    except (ValueError, TypeError):
                        pass

                raw_home = g.get("home_team_name_en") or g.get("home_team_label") or ""
                raw_away = g.get("away_team_name_en") or g.get("away_team_label") or ""

                home_name = self.translate_team_name(raw_home)
                away_name = self.translate_team_name(raw_away)

                date_str = g.get("date")
                if not date_str:
                    local_date = g.get("local_date")
                    if local_date:
                        try:
                            # format: MM/DD/YYYY HH:MM
                            parsed = datetime.strptime(local_date, "%m/%d/%Y %H:%M")
                            date_str = parsed.isoformat() + "Z"
                        except Exception:
                            date_str = "2026-06-11T18:00:00.000Z"
                    else:
                        date_str = "2026-06-11T18:00:00.000Z"

                mapped_fixtures.append({
                    "fixture": {
                        "id": int(g.get("id")),
                        "status": {
                            "short": status_short
                        },
                        "date": date_str
                    },
                    "teams": {
                        "home": {
                            "name": home_name
                        },
                        "away": {
                            "name": away_name
                        }
                    },
                    "goals": {
                        "home": home_score,
                        "away": away_score
                    },
                    "group": g.get("group"),
                    "stage": g.get("type")
                })
            return mapped_fixtures


    async def get_fixtures_by_date(self, date_str: str) -> list[dict[str, Any]]:
        """
        Stub to keep backward compatibility.
        """
        fixtures = await self.get_world_cup_fixtures()
        return [f for f in fixtures if f["fixture"]["date"].startswith(date_str)]
