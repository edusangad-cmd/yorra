import sys

import httpx

from app.core.config import settings


def main() -> None:
    if len(sys.argv) < 2:
        print("Uso: docker compose exec backend uv run python set_webhook.py <URL_PUBLICA_HTTPS>")
        print("Ejemplo: docker compose exec backend uv run python set_webhook.py https://xxxx.ngrok-free.app")
        sys.exit(1)

    public_url = sys.argv[1].strip().rstrip("/")
    webhook_url = f"{public_url}/telegram/webhook"
    
    token = settings.TELEGRAM_BOT_TOKEN
    telegram_api_url = f"https://api.telegram.org/bot{token}/setWebhook"
    
    print("Configurando Webhook de Telegram...")
    print(f"  - Token del Bot: {token[:10]}... (ocultado por seguridad)")
    print(f"  - URL del Webhook: {webhook_url}")
    
    try:
        response = httpx.get(telegram_api_url, params={"url": webhook_url})
        result = response.json()
        if result.get("ok"):
            print("✅ ¡Webhook configurado con éxito en Telegram!")
            print(f"Detalle: {result.get('description')}")
        else:
            print("❌ Error al configurar el Webhook:")
            print(result)
    except Exception as e:
        print(f"❌ Error de conexión: {e}")

if __name__ == "__main__":
    main()
