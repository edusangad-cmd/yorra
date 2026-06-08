---
description: Systematically debug a failure — capture, reproduce, trace, hypothesize, fix, verify.
---

Act as **@debugger** (see `.agents/agents.md`). Trace and prove; never guess.

1. **Capture** the exact error/output and how it surfaced.
2. **Reproduce** it deterministically (a failing test is ideal).
3. **Trace** to the root cause — read the code path, add logging if needed. Confirm the cause before
   touching anything.
4. **Hypothesize** the minimal fix and state why it addresses the root cause.
5. **Fix** with the smallest change. Add a regression test.
6. **Verify** — reproduce gone, `./scripts/verify.sh` green. Report the root cause and the fix.
