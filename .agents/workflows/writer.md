---
description: Sync docs, write the walkthrough, and open the PR — after the verify gate passes.
---

Act as **@writer** (see `.agents/agents.md`).

1. **Gate check.** Confirm `docs/memory/<date>_<slug>/verify.status` shows `exit=0`. If it doesn't,
   stop and tell the user to finish `/developer`.
2. **Doc sync.** Update `README.md` / `docs/tech-stack.md` / `AGENTS.md` if the change affects setup,
   stack, or conventions. Re-scan for code↔docs contradictions.
3. **Walkthrough.** Write `docs/memory/<date>_<slug>/walkthrough.md` with a "What Was Built" summary
   (key files, decisions, follow-ups) and attach it as an Artifact.
4. **PR.** Open a PR to the integration branch (never `main`) with a concise what+why and a link to the
   memory folder. A human merges.
5. Report the PR link and the smoke-test checklist.
