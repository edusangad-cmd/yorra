# `.agents/` — the Antigravity harness

Antigravity natively reads this directory. Layout:

| Path | What it is | Triggered by |
|---|---|---|
| `agents.md` | Named personas (`@architect`, `@developer`, …) the workflows adopt | referenced by workflows |
| `rules/*.md` | Always-on guidance (backend, frontend, database, workflow) | loaded automatically |
| `workflows/*.md` | Slash commands (`/architect`, `/developer`, `/writer`, `/review`, `/debug`, `/contract-check`, `/model-change`, `/tenant-check`) | you type `/name` |
| `skills/<name>/SKILL.md` | Capability packages (`shadcn-ui`, `brand-identity`) | agent-triggered by semantic match on `description` |
| `hooks.json` | Event-driven automation (lint on save) | file save / commit events |
| `schedules.json` | Cron-style scheduled agent tasks | the scheduler |

Repo-root `AGENTS.md` (cross-tool) + `GEMINI.md` (Antigravity-only, wins on conflict) sit above these.
Precedence: **System rules → GEMINI.md → AGENTS.md → `.agents/rules/`**.

## ⚠️ Version caveats — confirm against your installed build

This harness was authored against the documented Antigravity 2.0 conventions. Two things vary by
version and should be checked once in **Settings → Rules / Skills** (or the docs for your build):

1. **Directory name:** official docs use **`.agents/`** (plural, used here); some guides show
   **`.agent/`** (singular). If your build only detects the singular form, rename this folder to
   `.agent/` (the file contents don't change).
2. **`hooks.json` / `schedules.json` schema:** the exact field names (`event`/`action`/`filter`/`cron`)
   and supported events differ between releases. Treat the files here as templates — open the Hooks /
   Scheduled-Tasks UI to confirm or regenerate them. They're harmless if the build ignores an unknown
   schema, but don't assume they're active until you've seen them load.

## Migrated from Claude Code

This harness is a translation of a Claude Code setup. Mapping:
`CLAUDE.md → AGENTS.md + GEMINI.md` · `.claude/rules → .agents/rules` ·
`.claude/commands → .agents/workflows` · `.claude/agents (subagents) → agents.md personas + native
parallel subagents` · `.claude/skills → .agents/skills`.
