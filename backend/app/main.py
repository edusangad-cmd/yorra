from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api import endpoints, telegram
from app.core.config import settings
from app.db.session import init_db


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    # Initialize Database tables on startup
    await init_db()
    yield


app = FastAPI(title=settings.PROJECT_NAME, lifespan=lifespan)

# Include API Routers
app.include_router(telegram.router)
app.include_router(endpoints.router)


@app.get("/")
async def root() -> dict[str, str]:
    return {"message": f"Welcome to {settings.PROJECT_NAME} API"}


@app.get("/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok"}
