# Rule: database (SQLModel, no Alembic)

Applies to model and schema work (`backend/app/models/`, `backend/app/db/`).

- **No migration tool.** `SQLModel.metadata.create_all()` runs on startup
  (`app/db/session.py::init_db`) and only **adds** missing tables — it never alters or drops existing
  columns.
- **New table:** define the `SQLModel` (`table=True`) in `app/models/<name>.py`, then re-export it
  from `app/models/__init__.py` so `init_db` registers it. Rebuild → `create_all()` picks it up.
- **New column on an existing table:** add the field to the model **and** an idempotent
  `ALTER TABLE <t> ADD COLUMN IF NOT EXISTS <col> <type>` inside `init_db` so already-provisioned
  databases get it. `create_all()` alone will **not** add columns to a table that already exists.
- **Never** add Alembic, a `migrations/` folder, or `alembic.ini`.
- Use the `/model-change` workflow for any schema change so the steps above aren't skipped.
