# GEMINI.md — Antigravity-specific overrides

This file is read **after** `AGENTS.md` and **wins on conflict** (precedence: System rules → GEMINI.md
→ AGENTS.md → `.agents/rules/`). Keep it small: only Antigravity-specific behavior goes here; all the
shared, cross-tool rules stay in `AGENTS.md`.

## Artifacts & verification

- Produce **Artifacts** for non-trivial work: a task list, an implementation plan, and a final
  walkthrough. Mirror durable results into `docs/memory/<YYYY-MM-DD>_<slug>/` so they survive across
  sessions and live in git history.
- **Verify in the browser.** After a frontend change, open `http://localhost:3000`, exercise the
  changed flow, and attach a screenshot/recording Artifact. After a backend change, hit the endpoint
  (`/docs` or `curl`) and show the response.
- Prefer evidence over assertion: a passing `./scripts/verify.sh` run and a browser/endpoint check
  beat "it should work."

## Subagents, parallelism & worktrees

- Use **parallel subagents** to fan out independent research or build streams and to keep the main
  agent's context clean — delegate focused subtasks rather than doing everything serially.
- For parallel *implementation* streams, start the conversation in a **new Git worktree** so the
  working tree stays clean and streams don't collide. This replaces the old "worker subagent in a
  worktree" pattern.
- Subagents inherit the parent's tool permissions and directory scopes — they can't do anything you
  haven't already approved for the parent.

## Personas

When a workflow says "act as @architect / @developer / @writer / @reviewer / @explorer / @debugger",
adopt the matching persona defined in `.agents/agents.md`. Personas are how this repo expresses the
roles that used to be separate subagent configs.

## Design

Match the product's look via the **`brand-identity`** skill (design tokens live in
`frontend/src/index.css`). When building UI, use the **`shadcn-ui`** skill and keep components owned
in-repo under `frontend/src/components/ui/` — do not add a competing component library.

## Scope discipline

Don't expand scope beyond the active task. If you spot adjacent issues, note them in the walkthrough
Artifact instead of fixing them inline.

## Communication

- **Edu (Teacher/Professor):** Always respond to **Edu** (when he says "soy Edu") with extreme clarity and in non-technical terms. Avoid/explain development jargon, keeping him informed about what each action accomplishes in plain words.
- **Pull Request Rule:** Do not merge code to `main` or automatically resolve tasks. Add a notice in the Pull Request description that review and approval from external players is required before merging.

