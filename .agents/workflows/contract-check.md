---
description: Check FastAPI routes against the frontend's TypeScript API calls for contract drift.
---

Run before a PR when routes/schemas or `frontend/src/services/*` changed.

1. Enumerate backend routes (path, method, request body, response model, auth) from `backend/app/api/`
   and `backend/app/main.py`.
2. Enumerate frontend calls in `frontend/src/services/*` (URL, method, body shape, expected response
   type).
3. **Diff them.** Flag mismatches in: URL/path, HTTP method, request body fields/types, response
   shape, and auth expectations.
4. Report each drift as `frontend path:line ↔ backend path:line` with the specific mismatch. Suggest
   the fix on whichever side is wrong; **do not** silently change both.
