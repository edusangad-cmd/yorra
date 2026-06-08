---
description: Build the current implementation plan section-by-section (TDD), then run the verify gate.
---

Act as **@developer** (see `.agents/agents.md`). Work from
`docs/memory/<date>_<slug>/implementation_plan.md`.

For **each section**, in order:
1. **Red** — write the failing test(s) named in the section.
2. **Green** — implement the minimum to pass them.
3. **Review** — quick self-check against the section's done-criteria; spawn **@reviewer** for
   non-trivial diffs.
4. **Commit** — `<type>(<scope>): <what>`. Update `docs/memory/<date>_<slug>/progress.md`.

After all sections:
5. **Deploy** — `docker compose up -d --build`.
6. **Verify** — run `VERIFY_STATUS_DIR=docs/memory/<date>_<slug> ./scripts/verify.sh` and confirm
   `exit=0`. Default to `--fast` (lint + types) unless the user asks for the full run.
7. **Smoke test** — give the user an explicit browser/endpoint checklist for what changed.
8. **Handoff** — tell the user to run `/writer` once they're satisfied.

Never commit to `main`. Stay within the plan's scope.
