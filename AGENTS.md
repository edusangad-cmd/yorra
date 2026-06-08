# AGENTS.md

Standing instructions for **every agent** working in this repo (Antigravity reads this; it's also the
cross-tool standard). Antigravity-specific overrides live in `GEMINI.md` (which wins on conflict).
Deeper, domain-specific guidance lives in `.agents/rules/`.

**interinos** — a full-stack web app: **FastAPI** backend + **React** frontend, **PostgreSQL**,
fully containerized with **Docker Compose**. Built collaboratively; keep the harness and conventions
consistent so any agent (or teammate) can pick up work cold.

## Tech stack

- **Backend:** Python 3.12 · FastAPI · SQLModel · asyncpg · Pydantic Settings · managed with **uv**.
- **Frontend:** React 19 · Vite 6 · TypeScript (strict) · Tailwind CSS 4 · shadcn/ui (Radix + CVA).
- **Database:** PostgreSQL 16. **No Alembic** — schema is created/extended idempotently (see below).
- **Tooling:** Docker + Docker Compose; ruff + mypy (backend), ESLint + tsc + Vitest (frontend).

## Development commands

```bash
docker compose up -d --build      # full stack — db + backend + frontend
# API:  http://localhost:8000/docs   ·   Frontend: http://localhost:3000

# Backend (inside the container or, with uv installed, from backend/)
uv run uvicorn app.main:app --reload
uv run ruff check . --fix
uv run mypy .
uv run pytest

# Frontend (from frontend/)
npm run dev
npm run lint
npm run typecheck      # tsc --noEmit
npm test               # vitest

./scripts/verify.sh           # CI gate: ruff+mypy+pytest || eslint+tsc+vitest (in containers)
./scripts/verify.sh --fast    # lint + types only
```

We **test through Docker** (`docker compose exec`), not the host — keep the toolchain in the containers.

## Code map

```
backend/app/    main.py (FastAPI app) · core/config.py (settings) · db/session.py (async engine,
                init_db) · models/ (SQLModel tables) · api/ (route modules)
backend/tests/  pytest (asyncio mode)
frontend/src/   App.tsx · components/ui/ (shadcn, owned in-repo) · services/ (API clients) ·
                lib/utils.ts (cn) · index.css (Tailwind 4 + design tokens)
scripts/        verify.sh (CI gate)
docs/           tech-stack.md (stack reference) · memory/ (durable per-feature records)
.agents/        the Antigravity harness — rules/, workflows/, skills/, agents.md, hooks.json
```

## Database — no migrations

`SQLModel.metadata.create_all()` runs on startup (`app/db/session.py::init_db`) and only **adds**
missing tables. Adding a column to an existing DB needs an idempotent
`ALTER TABLE ... ADD COLUMN IF NOT EXISTS` in `init_db`. **Never add Alembic or migration files.**
See `.agents/rules/database.md` and the `/model-change` workflow.

## Code quality

- **Backend:** ruff (lint+imports) and mypy **strict** must pass. Type everything; no bare `except`
  except where annotated. Keep functions small and modules focused.
- **Frontend:** ESLint and `tsc --noEmit` (strict) must pass. No `any`. Components stay presentational;
  data access goes through `src/services/`.
- Match the surrounding file's style, naming, and comment density. Comment the *why*, not the *what*.

## Testing

- Backend: pytest (`asyncio_mode=auto`). Health/route tests use `httpx.ASGITransport` (no DB needed
  for liveness). New endpoints get at least one test.
- Frontend: Vitest + Testing Library. New components/behaviors get a smoke test.
- Red → green: write a failing test first when adding behavior.

## Safety guardrails

- **Never commit to `main`.** Work on feature/<initials>/<slug> branches; open a PR; a human reviews
  and merges.
- **Edu's Pull Request Rules:** When working with **Edu**, the agent must never merge or auto-approve pull requests. Every PR must state in its description that approval from **Manu** is mandatory. Additionally, the agent must pause and ask for confirmation in the chat that Manu has approved the changes.
- Confirm before destructive or outward-facing actions (dropping data, deleting files you didn't
  create, force-push, publishing).
- **Secrets:** read `.env` for config, but never print/commit secret *values*. `.env` is git-ignored;
  `.env.example` documents the keys.
- Deploy before merge: `docker compose up -d --build` so changes can be tested in the running app.

## Git conventions

- Branch: `feature/<initials>/<short-slug>` (e.g. `feature/mb/health-endpoint`).
- Commit per logical unit: `<type>(<scope>): <what>` (e.g. `feat(api): add /items endpoint`).
- PRs target the integration branch (not `main` directly); only a human merges.

## Working with the harness

- `.agents/workflows/*` are slash commands — type `/architect`, `/developer`, `/writer`, `/review`,
  `/debug`, `/contract-check`, `/model-change`. See `.agents/agents.md` for the personas they use.
- Durable records of "what was built" go in `docs/memory/` (see `docs/memory/README.md`); lean on
  Antigravity **Artifacts** for in-flight plans/walkthroughs.

## Communication

Be concise and factual. Report what you actually did and verified; if a step was skipped or a test
failed, say so plainly. Reference code as `path:line`.

- **Parallel Team Members:** There are two people working in parallel on this project:
  - **Manu:** A developer.
  - **Edu:** A teacher/professor without development background.
- **Edu's Communication Rule:** Whenever the user states **"soy Edu"** (or **"I am Edu"**), the agent **must** explain what is being done with maximum clarity, using simple and understandable language, avoiding unexplained technical jargon.
