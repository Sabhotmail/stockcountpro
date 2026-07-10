# Admin Branch CRUD (Soft Delete)

**Date:** 2026-07-10  
**Status:** Draft for review  
**Goal:** Let Admin/HQ fully manage branches on `/admin/branches`: create, edit name/prefix, and soft-disable/enable — without losing historical count documents.

## Decisions

| Topic | Choice |
|-------|--------|
| Scope | Full CRUD on Admin Branches page |
| Delete model | Soft delete via `Branch.isActive` (like users) |
| Inactive visibility | Still listed in Admin with Enable; excluded from user-branch pickers and Express sync mapping |
| Editable fields after create | Name + Express prefix only; **code immutable** |
| Create fields | Code + name + optional prefix |

## Data model

Add to `Branch`:

```prisma
model Branch {
  id                    String   @id
  code                  String   @unique
  name                  String
  expressLocationPrefix String?  @unique
  isActive              Boolean  @default(true)
  // relations unchanged
}
```

Migration: `ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true`.

Seed / existing rows remain active.

### ID generation (create)

`id = "branch_" + code.toLowerCase()` after normalizing code (uppercase for `code` field, lowercase slug for id). If collision, return 400.

### Code rules

- Required on create
- Trim + uppercase
- Pattern: `^[A-Z0-9]{2,16}$` (align with practical branch codes like `BKK1`, `PNL`)
- Unique
- **Not accepted on PATCH** (ignored or 400 if sent)

### Name rules

- Required, non-empty after trim
- Max length 100

### Prefix rules

- Same as today: optional, exactly 2 alphanumeric when set, unique across branches
- Clearing sends `null`

## API

All Admin/HQ only (existing `canAccessAdmin`).

| Method | Path | Body / behavior |
|--------|------|-----------------|
| `GET` | `/api/admin/branches` | All branches (active + inactive), ordered by code |
| `POST` | `/api/admin/branches` | `{ code, name, expressLocationPrefix?: string \| null }` → create `isActive: true` |
| `PATCH` | `/api/admin/branches/[branchId]` | `{ name?, expressLocationPrefix?, isActive? }` — at least one field; **no `code`** |

### PATCH semantics

- Partial update
- `isActive: false` = Disable; `true` = Enable
- Disabling self’s only branch is allowed (admin may not be branch-scoped)
- No hard delete endpoint

### Errors

| Case | Status |
|------|--------|
| Unauthorized / not admin | 401 / 403 |
| Validation (code/name/prefix) | 400 |
| Duplicate code or prefix | 400 |
| Branch not found | 404 |

## Service layer

Extend `admin.service.ts` (or small `admin-branch.service.ts` if file grows — prefer extend existing for consistency with current branch update):

- `createBranchForAdmin`
- `updateBranchForAdmin` — expand input beyond prefix-only
- `listBranchesForAdmin` — include `isActive` via mapper

Update `mapBranch` / `Branch` type:

```ts
export interface Branch {
  id: string;
  code: string;
  name: string;
  expressLocationPrefix: string | null;
  isActive: boolean;
}
```

## Inactive branch behavior (non-Admin surfaces)

| Surface | Behavior |
|---------|----------|
| Admin Branches page | Show all; badge Active/Disabled; Enable/Disable actions |
| Admin Users branch multi-select | **Active branches only** (filter `isActive`) |
| Express sync prefix lookup | Load only `isActive: true` branches |
| Existing documents for disabled branch | Still openable if user already has access; no new sync into inactive branch |
| Staff document list | Unchanged filter by user branchIds (historical docs remain) |

If a user remains assigned to a disabled branch, they can still see old documents for that branchId; Admin should reassign users when disabling (UI hint only — not forced unassign in MVP).

## UI (`/admin/branches`)

Follow patterns from `/admin/users` (dialogs, busy states, alerts).

1. **Header action:** “เพิ่มสาขา”
2. **Create dialog:** code, name, prefix (optional)
3. **Edit dialog:** name + prefix (code shown read-only)
4. **Disable / Enable:** confirm dialog (Thai copy), then PATCH `isActive`
5. **Table/cards:** columns Code, Name, Prefix, Status, Actions
6. Keep mobile card layout

## Out of scope

- Hard delete / cascade wipe of documents
- Renaming branch `code` after create
- Auto-unassign users on disable
- Tabs Active/Disabled (list shows all with status badge)
- Audit log entries for branch CRUD (nice-to-have later)

## Verification

1. Create branch `PNL` / name / prefix `32` → appears in list
2. Edit name + prefix → saves; attempting to change code not possible in UI
3. Disable → still listed as Disabled; disappears from Users branch picker; sync no longer maps that prefix
4. Enable → restored
5. Duplicate code/prefix → 400 with clear message
6. `npm run build` passes after migration

## Implementation notes

- Run migration on deploy: `npm run db:deploy`
- Update mock branches with `isActive: true`
- Grep for `prisma.branch.findMany` used in sync/user assignment and filter active where required
