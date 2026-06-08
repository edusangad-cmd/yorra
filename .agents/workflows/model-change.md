---
description: Apply a DB schema change without Alembic — edit the SQLModel + idempotent ALTER.
---

Use for any table/column change. See `.agents/rules/database.md`.

1. **Edit the model** in `backend/app/models/<name>.py`. For a new table, re-export it from
   `app/models/__init__.py`.
2. **New table?** `create_all()` will pick it up on the next boot — no further DDL needed.
3. **New/changed column on an existing table?** `create_all()` will NOT alter it. Add an idempotent
   statement to `init_db` in `app/db/session.py`:
   `ALTER TABLE <table> ADD COLUMN IF NOT EXISTS <col> <type>;`
4. **Rebuild** so the change takes effect: `docker compose up -d --build backend`.
5. **Verify** the column exists:
   `docker compose exec db psql -U postgres -d interinos -c '\d+ <table>'`.
6. Add/adjust a test that exercises the new field. **Never** add Alembic or a migrations folder.
