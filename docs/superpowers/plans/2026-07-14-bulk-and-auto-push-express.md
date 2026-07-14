# Bulk + Auto-Push Express Implementation Plan

> **For agentic workers:** Execute task-by-task. Checkboxes track progress.

**Goal:** Bulk push never-sent COMPLETED docs; optional Express push after approve (default off, soft-fail).

**Architecture:** Reuse `pushDocumentToExpress`. Add bulk service + route. Extend `approveDocument` with optional post-approve push. Wire Supervisor/Admin list selection and Review approve dialog.

**Tech Stack:** Next.js App Router, existing Dialog/Button patterns, Prisma audit for push status.

---

### Task 1: Bulk service + API

**Files:**
- Modify: `src/services/express-push.service.ts`
- Create: `src/app/api/count-documents/push-express-bulk/route.ts`

- [ ] Add `pushDocumentsToExpressBulk(session, documentIds)`
- [ ] POST route returning summary + results
- [ ] Cap 50 IDs; sequential push; skip already_pushed / not_completed

### Task 2: Approve optional push

**Files:**
- Modify: `src/services/review.service.ts` (`approveDocument`)
- Modify: `src/app/api/supervisor/count-documents/[documentId]/approve/route.ts`
- Modify: `src/app/supervisor/review/[documentId]/page.tsx`

- [ ] `approveDocument(session, id, { pushToExpress?: boolean })`
- [ ] Parse body; return `expressPush` soft-fail
- [ ] Approve dialog + checkbox default off

### Task 3: Bulk UI

**Files:**
- Create: `src/components/BulkPushExpressBar.tsx` (or inline)
- Modify: `src/app/supervisor/documents/page.tsx`
- Modify: `src/app/admin/documents/page.tsx`

- [ ] Selection state for eligible rows
- [ ] Bulk action + result dialog
- [ ] Refresh `lastExpressPushAt` for successes

### Task 4: Verify + commit

- [ ] `npx tsc --noEmit`
- [ ] Commit + push
