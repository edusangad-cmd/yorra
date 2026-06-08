# Rule: frontend (React + Vite + Tailwind 4 + shadcn/ui)

Applies to work under `frontend/`.

- **shadcn/ui is owned in-repo** under `src/components/ui/`. Add components with the shadcn CLI
  (`npx shadcn@latest add <name>`) or by following the `shadcn-ui` skill — then edit them freely. Do
  **not** add a second component library (MUI, Chakra, etc.).
- **Styling:** Tailwind CSS 4 (CSS-first config via `@import "tailwindcss"` in `src/index.css`). Use
  the design tokens (`bg-background`, `text-primary`, …) defined there — the source of truth for color
  and radius. The `brand-identity` skill mirrors these values.
- **Data access** goes through `src/services/*` (e.g. `services/api.ts`). Components stay
  presentational; the API base URL is `import.meta.env.VITE_API_URL`.
- **Class merging:** compose classes with `cn()` from `src/lib/utils.ts`.
- **Typing:** `tsc --noEmit` runs strict. No `any`. Type component props explicitly.
- **Checks:** `npm run lint` and `npm run typecheck` must pass; new components get a Vitest smoke test.
