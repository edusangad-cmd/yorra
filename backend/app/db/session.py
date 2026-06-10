import sys
from collections.abc import AsyncGenerator

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool
from sqlmodel import SQLModel

from app.core.config import settings

# Database engine for async operations using asyncpg
is_testing = "pytest" in "".join(sys.argv)
engine = create_async_engine(
    settings.DATABASE_URL, echo=False, future=True, poolclass=NullPool if is_testing else None
)

async_session_maker = async_sessionmaker(bind=engine, expire_on_commit=False)


async def init_db() -> None:
    """Initialize the database and create tables if they do not exist."""
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
        # Idempotent column additions for existing tables
        await conn.execute(text('ALTER TABLE match ADD COLUMN IF NOT EXISTS "group" VARCHAR;'))
        await conn.execute(text('ALTER TABLE match ADD COLUMN IF NOT EXISTS stage VARCHAR;'))
        await conn.execute(text('ALTER TABLE prediction ADD COLUMN IF NOT EXISTS penalty_winner_home BOOLEAN;'))
        await conn.execute(text('ALTER TABLE tournamentprediction ADD COLUMN IF NOT EXISTS best_goalkeeper VARCHAR;'))



async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """Dependency for obtaining database sessions."""
    async with async_session_maker() as session:
        yield session
