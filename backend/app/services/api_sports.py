from typing import Any, cast

import httpx

from app.core.config import settings


class APISportsClient:
    BASE_URL = "https://v3.football.api-sports.io"

    def __init__(self) -> None:
        self.headers = {
            "x-rapidapi-key": settings.API_SPORTS_KEY,
            "x-rapidapi-host": "v3.football.api-sports.io",
        }

    async def get_world_cup_fixtures(self) -> list[dict[str, Any]]:
        """
        Fetch World Cup 2026 fixtures.
        League ID for World Cup in API-Sports is 1.
        """
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.BASE_URL}/fixtures",
                headers=self.headers,
                params={"league": 1, "season": 2026},
            )
            response.raise_for_status()
            data = response.json()
            return cast(list[dict[str, Any]], data.get("response", []))

    async def get_fixtures_by_date(self, date_str: str) -> list[dict[str, Any]]:
        """
        Fetch fixtures for a specific date (YYYY-MM-DD)
        """
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.BASE_URL}/fixtures",
                headers=self.headers,
                params={"league": 1, "season": 2026, "date": date_str},
            )
            response.raise_for_status()
            data = response.json()
            return cast(list[dict[str, Any]], data.get("response", []))
