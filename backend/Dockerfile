# porra-deportiva backend — FastAPI on Python 3.12 with uv.
FROM python:3.12-slim

# uv: fast, reproducible Python dependency management.
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app

# Install deps first for better layer caching.
COPY pyproject.toml ./
# Resolve and install into a project venv (creates uv.lock on first build).
RUN uv sync --no-install-project

COPY . .
RUN uv sync

CMD ["sh", "-c", "uv run uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
