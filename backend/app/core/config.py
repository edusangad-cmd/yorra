from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    # App Settings
    PROJECT_NAME: str = "Porra Deportiva Mundial 2026"
    
    # Database
    DATABASE_URL: str
    
    # Telegram
    TELEGRAM_BOT_TOKEN: str
    
    # API Sports
    API_SPORTS_KEY: str

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

settings = Settings()
