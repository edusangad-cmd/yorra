---
description: Research the codebase and write a sectioned implementation plan for a feature (no code).
---

Act as **@architect** (see `.agents/agents.md`).

1. **Clarify.** Restate the goal. Ask the user any blocking questions before planning.
2. **Set up.** Create the feature branch `feature/<initials>/<slug>` and the memory folder
   `docs/memory/<YYYY-MM-DD>_<slug>/`.
3. **Research.** Fan out **@explorer** subagents to locate relevant files, patterns, and call sites.
   Read what they flag. Prefer reusing existing utilities over new code.
4. **Plan.** Write `docs/memory/<date>_<slug>/implementation_plan.md` as an Artifact, broken into
   **sections**; each section lists: files to touch · test cases · done-criteria.
5. **Self-review** the plan for completeness, feasibility, and codebase-specific gaps (the old
   plan-reviewer pass). Note open risks.
6. **Handoff.** Summarize the plan and tell the user to run `/developer` to build it.

Do **not** write feature code in this workflow.
