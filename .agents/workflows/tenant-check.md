---
description: (Dormant) Verify tenant isolation — only relevant once multi-tenancy is added.
---

> **Status: dormant.** interinos is single-tenant today. This workflow is carried over from the
> team's multi-tenant playbook so it's ready if/when you add per-tenant isolation. Until then, running
> it should report "not applicable — single-tenant."

When the app becomes multi-tenant (e.g. schema-per-tenant with `search_path`, or a `tenant_id` column
+ row-level scoping), use this to verify isolation after any route/model/middleware change:

1. **Auth guards.** Every tenant-scoped route requires auth and derives the tenant from the token —
   never from a client-supplied parameter.
2. **Scope integrity.** Confirm the isolation mechanism (schema `search_path` or `tenant_id` filter) is
   applied on every query path; look for queries that bypass it.
3. **Cross-tenant leakage.** Check that list/detail/aggregate endpoints can't return another tenant's
   rows. Add a test that asserts tenant A cannot read tenant B's data.
4. Report gaps as `path:line` with the leak and the fix.
