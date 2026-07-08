# Admin User Management (Design Spec)

Date: 2026-07-08  
Owner: StockCount Pro  
Scope: Admin UI + API for managing users (create/edit/disable/reset password)

## Goals

- Provide an Admin-only screen to manage users:
  - Create users
  - Edit users (name, role, branch access)
  - Disable/enable users (no hard delete)
  - Reset passwords
- Support two password creation/reset modes:
  - Admin sets password manually
  - System generates a password (shown once for copy)
- Keep existing auth behavior: disabled users cannot log in.

## Non-goals

- Self-service “change password” flow for normal users
- Email/SMS password delivery
- Audit log for user admin actions (can be added later)

## Current State (as-is)

- Admin page `src/app/admin/users/page.tsx` only lists users.
- API `GET /api/admin/users` returns list.
- Prisma `User` model already has `isActive`.
- Login (`authenticateUser`) blocks `!user.isActive`.

## Proposed UX (Recommended: Dialogs on `/admin/users`)

### Users Table (existing page enhanced)

Columns:
- Name
- Username
- Role
- Branches (count + quick view)
- Status (Active / Disabled)
- Actions (row menu/buttons)

Top actions:
- “Add user” button
- Search/filter (optional, phase 2)

### Dialog: Create User

Fields:
- Name (required)
- Username (required, normalized to lowercase)
- Role (required)
- Branch access (multi-select)
  - Required for non-`ADMIN`/`HQ` roles
  - Optional/hidden for `ADMIN`/`HQ` (they implicitly access all branches)

Password mode:
- “Set password”
  - password input + confirm
- “Generate password”
  - system generates a strong password
  - show in a “copy” field after successful create
  - shown **once** (do not store plaintext)

Success behavior:
- Close dialog
- Refresh table
- If generated: show a success dialog/alert with password + copy button

### Dialog: Edit User

Editable:
- Name
- Role
- Branch access (multi-select)

Restricted:
- Username: not editable (avoids breaking login expectations)

### Action: Disable / Enable User

- Toggle `isActive`
- Confirmation prompt
- When disabled: user cannot log in (already enforced)

### Dialog: Reset Password

Two modes (same as create):
- Admin sets password
- System generates password (shown once)

## Permissions / Authorization

- Only `ADMIN` and `HQ` can access all admin endpoints and pages.
- Reuse existing `canAccessAdmin` checks.

## API Design

All endpoints are server-side Next.js route handlers.

### `GET /api/admin/users`

Returns list of users (existing).

Response:

```json
{ "users": [ { "id": "...", "username": "...", "name": "...", "role": "STAFF", "branchIds": ["branch_bkk1"], "isActive": true } ] }
```

Note: `types/user.ts` currently omits `isActive`; this will be added.

### `POST /api/admin/users` (Create)

Body:
- `name: string`
- `username: string`
- `role: UserRole`
- `branchIds: string[]`
- `passwordMode: "set" | "generate"`
- `password?: string` (required when `passwordMode="set"`)

Response:
- Always returns created user (without password hash)
- If generated, returns `generatedPassword` once

### `PATCH /api/admin/users/[userId]` (Edit + status)

Body (any of):
- `name?: string`
- `role?: UserRole`
- `branchIds?: string[]`
- `isActive?: boolean`

Response:
- updated user

### `POST /api/admin/users/[userId]/reset-password`

Body:
- `passwordMode: "set" | "generate"`
- `password?: string`

Response:
- `{ success: true, generatedPassword?: string }`

## Data / Validation Rules

- `username`
  - trim, lowercase
  - unique constraint already in Prisma
- `password`
  - minimum length (e.g. 8+) and basic complexity (phase 1 can be minimal)
  - hashed with existing password helper (`hashPassword`)
- `branchIds`
  - For roles other than `ADMIN`/`HQ`, require at least 1 branch
  - For `ADMIN`/`HQ`, allow empty (they have implicit access anyway)
- Cannot disable yourself? (recommended safety)
  - If `session.userId === targetUserId`, block disabling and show error

## UI Components (shadcn already available)

- Table (`src/components/ui/table`)
- Dialog (`src/components/ui/dialog`)
- Button/Input/Label/Card/Alert

## Implementation Notes (later plan will detail)

- Extend `User` type to include `isActive`
- Add admin service functions:
  - `createUserForAdmin`
  - `updateUserForAdmin`
  - `resetPasswordForAdmin`
- Ensure branch join table updates via transactions
- Ensure disabled users are hidden/handled consistently in app (login already blocks)

## Test Plan (manual)

- Create user with manual password → login works
- Create user with generated password → login works; password shown once
- Edit user role + branches → access changes accordingly
- Disable user → login fails
- Re-enable user → login works again
- Reset password (both modes) → old password stops working; new works

