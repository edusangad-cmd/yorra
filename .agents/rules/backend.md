# Rule: backend (FastAPI + SQLModel)

Applies to work under `backend/`.

- **Layering:** routes in `app/api/` (or `app/main.py` for trivial ones) → call services/models; keep
  business logic out of route handlers. Settings come from `app/core/config.py::get_settings()` —
  never read `os.environ` directly in feature code.
- **Async everywhere:** endpoints and DB access are `async`. Get a session via the `get_session`
  FastAPI dependency (`app/db/session.py`); don't create engines/sessions ad hoc.
- **Typing:** mypy runs **strict**. Annotate every function. Avoid `Any`. Pydantic/SQLModel models are
  the typed boundary for request/response shapes.
- **Errors:** raise `fastapi.HTTPException` with a clear status for client errors; don't swallow
  exceptions with bare `except`.
- **Tests:** pytest with `asyncio_mode=auto`. Liveness/route tests use `httpx.ASGITransport` so they
  don't need a live DB. Every new endpoint gets at least one test.
- **Lint/format:** `uv run ruff check . --fix` before committing.
