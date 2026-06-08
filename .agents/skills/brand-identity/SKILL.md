---
name: brand-identity
description: Use when generating UI, styling, or writing user-facing copy for interinos — the source of truth for design tokens, the technology stack, and voice/tone.
---

# interinos brand identity

## Goal
Keep everything user-facing consistent: colors, radius, typography, the tech choices, and the product's
voice.

## Design tokens
- The **runtime** source of truth is `frontend/src/index.css` (`:root` / `.dark` CSS variables mapped
  via `@theme inline`). `resources/design-tokens.json` mirrors them for reference/tooling.
- Palette: **indigo** primary on a **slate** neutral scale; light + dark via the `.dark` class.
  Radius base `0.625rem`.
- Always style with token utilities (`bg-primary`, `text-foreground`, `border-border`,
  `text-muted-foreground`) — never hard-coded hex.

## Tech stack
See `resources/tech-stack.md` (and the repo's `docs/tech-stack.md`) — React 19 + Vite + Tailwind 4 +
shadcn/ui on the frontend; FastAPI + SQLModel + Postgres on the backend.

## Voice & tone
See `resources/voice-tone.md`. In short: clear, concise, confident; plain language over jargon;
action-first labels.

## Constraints
- One token source: edit `index.css`, then sync `resources/design-tokens.json`.
- Don't introduce off-palette colors or a second font family without updating the tokens here first.
