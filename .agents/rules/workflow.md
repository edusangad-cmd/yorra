# Rule: workflow & git discipline

Applies repo-wide.

- **Branches:** `feature/<initials>/<short-slug>`. Never commit directly to `main` or the shared
  integration branch.
- **Commits:** one logical unit each; message `<type>(<scope>): <what>` (types: feat, fix, docs,
  refactor, test, chore).
- **Verify gate:** `./scripts/verify.sh` must report `✅ verify passed` (exit 0) before opening a PR.
  When `VERIFY_STATUS_DIR` is set it writes `verify.status` (`exit=0`) — the `/writer` workflow trusts
  that marker.
- **Deploy before merge:** `docker compose up -d --build` and confirm the app runs; verify the changed
  flow in the browser / via the API before requesting review.
- **PRs:** target the integration branch; include a short "what + why" and a link to the
  `docs/memory/<date>_<slug>/` record. A human reviews and merges — agents never self-merge.
- **Memory:** each feature gets `docs/memory/<YYYY-MM-DD>_<slug>/` with `implementation_plan.md`,
  `progress.md`, `verify.status`, and `walkthrough.md` (see `docs/memory/README.md`).
