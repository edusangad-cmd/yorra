import httpx

from app.core.config import settings


class TelegramService:
    BASE_URL = f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}"

    @classmethod
    async def send_message(cls, chat_id: int, text: str, parse_mode: str = "HTML") -> bool:
        """Sends a text message to the specified Telegram chat ID."""
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    f"{cls.BASE_URL}/sendMessage",
                    json={"chat_id": chat_id, "text": text, "parse_mode": parse_mode},
                )
                response.raise_for_status()
                return True
            except Exception as e:
                print(f"Failed to send Telegram message: {e}")
                return False
