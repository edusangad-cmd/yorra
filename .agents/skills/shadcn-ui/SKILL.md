---
name: shadcn-ui
description: Use when adding, customizing, or building UI with shadcn/ui in this React + Tailwind 4 app — component discovery, installation via the CLI, and the in-repo ownership model.
---

# shadcn/ui

## Goal
Build UI with shadcn/ui components that are **owned in this repo** under `frontend/src/components/ui/`,
styled with Tailwind 4 design tokens.

## Key facts for this project
- Config lives in `frontend/components.json` (style `new-york`, base color `slate`, CSS variables on,
  icon library `lucide`). Aliases: `@/components`, `@/components/ui`, `@/lib/utils`.
- The class-merging helper is `cn()` in `frontend/src/lib/utils.ts`.
- Tokens (colors, radius) are defined in `frontend/src/index.css` — see the `brand-identity` skill.

## How to add a component
```bash
cd frontend
npx shadcn@latest add button card dialog   # writes into src/components/ui/
```
Then edit the generated files freely — they're ours now.

## Instructions
1. Check whether the component already exists in `src/components/ui/` before adding it.
2. Prefer composing existing primitives (`Button`, `Card`) over inventing new ones.
3. Style with token utilities (`bg-primary`, `text-muted-foreground`, `rounded-lg`) — not hard-coded
   hex values — so light/dark and re-theming keep working.
4. Keep components presentational; fetch data in `src/services/*` and pass it in as props.

## Constraints
- **Do not** add a competing component library (MUI, Chakra, Mantine, …).
- **Do not** introduce a separate design-token source — `index.css` is the single source of truth.
- New components get a Vitest smoke test.

See `resources/usage.md` for a worked example.
