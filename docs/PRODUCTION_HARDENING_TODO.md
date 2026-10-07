# Production Hardening TODO

These rules are important, but in the current prototype phase they can be TODO items unless specifically requested.

## 1. STAFF must not receive expectedQty from API

**Status (2026-10-07):** Done for tablet document/version APIs via `filterLinesForRole` + unit tests. Keep using the filter on any new line-returning endpoint.

Prototype:

- STAFF should not see expectedQty on UI.

Production:

- STAFF/COUNTER API responses must remove expectedQty completely.
- Do not send expectedQty and hide it only in UI.
- SUPERVISOR/ADMIN can receive expectedQty only if they have branch permission.

## 2. Every API must prevent IDOR by Branch

**Status (2026-10-07):** Main count/submit/save paths use `getDocumentForSession`. Presence/lock helpers now check access. Document GET returns 403 (not 404) on denied access. Still no API-wide middleware for every `/api` route.

Production:

- Every API must check session, role, and branch.
- Never trust documentId from URL.
- Check document.branchId against user branches.

Applies to:

- document API
- lines API
- auto save
- submit
- approve
- recount
- audit log
- export
- version compare
- image proxy
- sync API

## 3. Offline Draft must be scoped correctly

Production offline draft key:

```text
userId
branchId
documentId
versionId
lineId
```

Rules:

- Do not load another user's draft on the same Tablet.
- Warn/block logout if unsynced draft exists.
- Warn/block switching user if unsynced draft exists.
- Use IndexedDB / Dexie.js, not LocalStorage.

## 4. Submit must be blocked if Sync is not complete

**Status (2026-10-07):** Partial — count page flushes lines+note, writes sessionStorage flush receipt; summary requires receipt; readiness/submit reject when other users hold line locks. Full IndexedDB offline draft still TODO (§3). Server cannot see in-memory client queues.

Production:

Before submit:

- No PENDING draft
- No SYNCING draft
- No FAILED draft
- No CONFLICT draft
- All save requests are flushed
- Server confirms latest saved state

Frontend and API should both enforce this.

## 5. Auto Save must have clientMutationId

Production:

- Every save mutation includes clientMutationId.
- Server stores processed clientMutationId.
- Retry should not duplicate count entry or audit log.
- Audit log should store clientMutationId.

## 6. Version delta must have resolveEffectiveEntries

Production:

If versions store only changed lines, create service:

```text
resolveEffectiveEntries(documentId, versionId)
```

It must:

- Walk baseVersionId chain
- Merge entries from oldest to newest
- Return full effective result
- Be used by supervisor review, export, compare, and final snapshot

## 7. Completed should have final snapshot

Production:

- On approve/completed, calculate effective entries
- Store final_count_entries
- Lock document
- Do not depend on future product/unit changes for historical result

## 8. Express sync must not overwrite started documents

**Status (2026-10-07):** Overwrite guard done (`!== IMPORTED` → skip). Sync results set `skippedBecauseStarted` + warning; ExpressSyncPanel shows a banner listing skipped started docs.

Production:

- If status is IMPORTED, Express sync may update lines
- If status is COUNTING or later, do not overwrite silently
- Create sync warning if Express data changed
- Sync must be idempotent
- Sync must not duplicate documents or lines

## 9. Mock mutable state should move to dev DB

Production-like dev:

- Static seed can stay in src/mock
- Mutable state should use SQLite/PostgreSQL through Prisma
- Avoid relying on in-memory array for real testing
- Use prisma seed for mock users, branches, documents, lines

## 10. Audit Log must be append-only

Production:

- Audit logs are append-only
- No normal update/delete API for audit logs
- Admin unlock creates new audit log
- Correction creates new audit action
- Mutations should write audit log server-side
- Write audit log in same transaction where possible

## Suggested AuditLog fields

```text
id
userId
branchId
documentId
versionId
lineId
action
oldValue
newValue
ipAddress
userAgent
requestId
clientMutationId
createdAt
```
