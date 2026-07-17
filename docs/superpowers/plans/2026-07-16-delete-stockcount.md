# Delete Stock Count Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a separate role-restricted page that deletes one stock-count dataset from Express and StockCount Pro by count date and location code.

**Architecture:** Reuse the existing Express authentication client, document access lookup, Prisma cascade deletion, audit action, and navigation components. A single app route coordinates validation, local status/access checks, upstream deletion first, then local deletion.

**Tech Stack:** Next.js App Router, TypeScript, React 19, Prisma, Zod, existing shadcn/ui components.

## Global Constraints

- Allowed roles are exactly `ADMIN`, `HQ`, and `SUPERVISOR`.
- Block local statuses `APPROVED` and `COMPLETED` before calling Express.
- Delete Express first; delete the local document only after upstream success.
- Do not add dependencies or bulk-delete behavior.
- Preserve unrelated working-tree changes.

---

### Task 1: Permission and request validation

**Files:**
- Modify: `src/lib/permissions.ts`
- Modify: `src/lib/api/schemas.ts`
- Test: `src/lib/permissions.delete-stockcount.test.ts`
- Test: `src/lib/api/schemas.test.ts`

**Interfaces:**
- Produces: `canDeleteStockCount(role: UserRole): boolean`
- Produces: `deleteStockCountSchema` accepting `{ countDate: "yyyy-MM-dd", locationCode: non-empty safe code }`

- [ ] Write failing assertions that Admin/HQ/Supervisor are allowed and every other role is denied.
- [ ] Add failing schema assertions for a valid payload, malformed date, and unsafe/empty location code.
- [ ] Run `npx tsx src/lib/permissions.delete-stockcount.test.ts` and `npx tsx src/lib/api/schemas.test.ts`; verify the new assertions fail because the exports do not exist.
- [ ] Add the two minimal exports using existing Zod/date/location conventions.
- [ ] Re-run both commands and verify they pass.

### Task 2: Express DELETE client

**Files:**
- Modify: `src/services/express-api.service.ts`
- Create: `src/services/express-api.delete.test.ts`

**Interfaces:**
- Produces: `deleteExpressCountByLocation(countDate: string, locationCode: string): Promise<{ success: true; response: unknown } | { error: string }>`

- [ ] Write a failing test with a stubbed `fetch` proving the helper uses `DELETE`, bearer auth, encoded date/location path, and retries once after `401`.
- [ ] Run `npx tsx src/services/express-api.delete.test.ts`; verify failure because the helper is missing.
- [ ] Implement the helper beside the existing PUT helper, reusing Express config/token behavior and parsing empty or JSON responses.
- [ ] Re-run the test and verify it passes.

### Task 3: Coordinated delete service and API route

**Files:**
- Modify: `src/services/count-document.service.ts`
- Create: `src/services/delete-stockcount.service.ts`
- Create: `src/services/delete-stockcount.service.test.ts`
- Create: `src/app/api/express/delete-stockcount/route.ts`
- Modify: `src/lib/api/error-status.ts`

**Interfaces:**
- Produces: `findDeletableDocument(session, countDate, locationCode)` returning the exact accessible local document or a typed error.
- Produces: `deleteStockCount(session, countDate, locationCode)` coordinating upstream then local deletion.
- Consumes: `deleteExpressCountByLocation`, `canDeleteStockCount`, existing Prisma deletion/audit behavior.

- [ ] Write failing service tests for denied role, missing local document, blocked `APPROVED`/`COMPLETED`, Express failure preserving local data, and successful two-system deletion.
- [ ] Run `npx tsx src/services/delete-stockcount.service.test.ts`; verify expected failures.
- [ ] Extract only the existing local Prisma delete/audit tail into a reusable internal/exported function; keep the old imported-document endpoint behavior unchanged.
- [ ] Implement exact date/location lookup, session access check, blocked-status guard, Express-first call, local delete, and explicit partial-failure message.
- [ ] Add `DELETE /api/express/delete-stockcount` using `parseRequestBody` and `deleteStockCountSchema`; map typed errors to 400/403/404/409/502/503.
- [ ] Re-run the service test and existing API/schema tests.

### Task 4: Separate Delete page and navigation

**Files:**
- Create: `src/app/admin/delete-stockcount/page.tsx`
- Modify: `src/components/AdminNav.tsx`
- Modify: `src/components/SupervisorNav.tsx`

**Interfaces:**
- Consumes: `GET /api/express/sync?date=...` for the existing role-filtered location preview.
- Consumes: `DELETE /api/express/delete-stockcount` with `{ countDate, locationCode }`.

- [ ] Build the page with the existing `PageShell`, `DateInputDMY`, buttons, alerts, and location preview types.
- [ ] Require one location selection, display the exact date/location in a native confirmation, then call the delete route.
- [ ] On `401`, redirect to login; on `403`, redirect to the role home; otherwise show server errors and refresh the location list after success.
- [ ] Add “Delete รายการนับสต็อก” to Admin/HQ navigation and Supervisor navigation only.
- [ ] Run targeted ESLint on the page, nav files, route, services, tests, schemas, and permissions.

### Task 5: Full verification

**Files:**
- Verify all modified files.

- [ ] Run all new direct tests and relevant existing tests.
- [ ] Run `npm run lint`.
- [ ] Run `npm run build`.
- [ ] Review `git diff --check`, `git diff --stat`, and `git status --short`.
- [ ] Confirm no unrelated user changes were overwritten and report any pre-existing failures separately.
