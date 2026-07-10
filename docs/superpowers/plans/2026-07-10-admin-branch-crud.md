# Admin Branch CRUD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add full Admin branch CRUD with soft delete (`isActive`) on `/admin/branches`.

**Architecture:** Extend `Branch` with `isActive`; expand admin branch service/API for create + partial update (name/prefix/isActive); filter inactive branches from user pickers and Express sync; upgrade Admin Branches UI with create/edit/disable dialogs.

**Tech Stack:** Next.js App Router, Prisma/PostgreSQL, TypeScript, shadcn UI.

**Spec:** `docs/superpowers/specs/2026-07-10-admin-branch-crud-design.md`

**Note:** No unit-test runner — verify with `npx tsc --noEmit` / `npm run build` and manual checks.

---

### Task 1: Schema + types + mapper + mocks

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260710120000_branch_is_active/migration.sql`
- Modify: `src/types/user.ts`
- Modify: `src/lib/db/mappers.ts`
- Modify: `src/mock/branches.ts`
- Modify: `prisma/seed.ts` (pass `isActive` if needed; default true is enough)

- [ ] Add `isActive Boolean @default(true)` to Branch
- [ ] Migration SQL: `ALTER TABLE "Branch" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;`
- [ ] `Branch` type + `mapBranch` include `isActive`
- [ ] Mock branches set `isActive: true`
- [ ] `npm run db:deploy` + `npx prisma generate`
- [ ] Commit: `Add Branch.isActive for soft delete.`

---

### Task 2: Admin branch service create/update

**Files:**
- Modify: `src/services/admin.service.ts`
- Create (optional helpers in same file or `src/lib/branch.ts`): code/name validators

- [ ] `CreateAdminBranchInput`: `{ code, name, expressLocationPrefix?: string | null }`
- [ ] `UpdateAdminBranchInput`: `{ name?: string; expressLocationPrefix?: string | null; isActive?: boolean }` — at least one field
- [ ] `createBranchForAdmin`: normalize code uppercase, validate `^[A-Z0-9]{2,16}$`, name trim 1–100, prefix rules, id `branch_${code.toLowerCase()}`, create `isActive: true`
- [ ] Expand `updateBranchForAdmin`: partial name/prefix/isActive; reject if `code` present in input type (don't accept); keep prefix uniqueness
- [ ] Commit: `Add admin create/update branch service with soft disable.`

---

### Task 3: API routes

**Files:**
- Modify: `src/app/api/admin/branches/route.ts` — add POST
- Modify: `src/app/api/admin/branches/[branchId]/route.ts` — expand PATCH

- [ ] POST validates body fields, calls create
- [ ] PATCH accepts optional name, expressLocationPrefix, isActive; require ≥1 field; if `code` in body → 400
- [ ] Commit: `Expose admin branch create and expanded update APIs.`

---

### Task 4: Filter inactive in sync + users UI

**Files:**
- Modify: `src/services/express-sync.service.ts` — `loadBranchesForExpressLookup` where `isActive: true`
- Modify: `src/app/admin/users/page.tsx` — branch pickers/filters use `branches.filter(b => b.isActive)` for assignment; filter dropdown may still show all or active-only — use active-only for create/edit multi-select; filter dropdown can show all for finding users on disabled branches OR active-only — prefer: multi-select active only; filter dropdown all with label

- [ ] Sync lookup active only
- [ ] Users page: create/edit branch checkboxes = active only
- [ ] Commit: `Exclude inactive branches from sync and user assignment.`

---

### Task 5: Admin Branches UI CRUD

**Files:**
- Modify: `src/app/admin/branches/page.tsx`

- [ ] Button เพิ่มสาขา + create dialog (code, name, prefix)
- [ ] Edit dialog: code read-only, name + prefix editable
- [ ] Disable/Enable confirm + PATCH isActive
- [ ] Status badge Active/Disabled on table/cards
- [ ] Hint when disabling: ผู้ใช้อาจยังผูกสาขานี้ — ควรย้ายสิทธิ์ถ้าจำเป็น
- [ ] Commit: `Add admin branch create, edit, and soft-disable UI.`

---

### Task 6: Verify + docs touch

- [ ] `npx tsc --noEmit` + `npm run build`
- [ ] Grep `expressLocationPrefix` / Branch create paths OK
- [ ] Optional one-line note in EXPRESS_API_SETUP or leave as-is
- [ ] Push master if repo rule requires (commit-and-push)

---

## Spec coverage

| Spec item | Task |
|-----------|------|
| isActive column | 1 |
| Create/update service | 2 |
| POST/PATCH APIs | 3 |
| Sync + user picker filter | 4 |
| Admin UI CRUD | 5 |
| Build verify | 6 |
