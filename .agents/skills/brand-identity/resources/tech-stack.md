# Tech stack (brand reference)

The canonical, fuller version is `docs/tech-stack.md`. Summary:

- **Frontend:** React 19, Vite 6, TypeScript (strict), Tailwind CSS 4, shadcn/ui (Radix + CVA),
  lucide-react icons.
- **Backend:** Python 3.12, FastAPI, SQLModel, asyncpg, Pydantic Settings, managed with uv.
- **Database:** PostgreSQL 16. No Alembic — idempotent `create_all()` + `ALTER ... IF NOT EXISTS`.
- **Infra:** Docker + Docker Compose. Tests run inside the containers.

Stick to this stack for new work unless the team agrees to change it; record any change in
`docs/tech-stack.md`.
