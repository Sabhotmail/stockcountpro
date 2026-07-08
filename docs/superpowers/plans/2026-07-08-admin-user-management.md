# Admin User Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add admin UI + API to create/edit/disable users and reset passwords with either manual or generated password modes.

**Architecture:** Keep `/admin/users` as the single management screen. Use server Route Handlers under `/api/admin/users*` that call new functions in `src/services/admin-user.service.ts` and reuse existing admin authorization (`canAccessAdmin`) and password hashing utilities.

**Tech Stack:** Next.js 16 App Router, TypeScript, Prisma (PostgreSQL), shadcn/ui, bcryptjs.

---

## File Structure (new + modified)

**Create:**
- `src/services/admin-user.service.ts` — Admin-only user CRUD operations (create/update/disable/reset password) using Prisma transactions.
- `src/app/api/admin/users/[userId]/route.ts` — PATCH update user fields + disable/enable.
- `src/app/api/admin/users/[userId]/reset-password/route.ts` — reset password endpoint.
- `docs/superpowers/plans/2026-07-08-admin-user-management.md` — this plan (already created).

**Modify:**
- `src/types/user.ts` — include `isActive` in `User` type.
- `src/lib/db/mappers.ts` — include `isActive` in `mapUser`.
- `src/services/user.service.ts` — optionally include `isActive` for user reads (via mapper).
- `src/app/api/admin/users/route.ts` — add POST create user handler.
- `src/app/admin/users/page.tsx` — add dialogs and actions (create/edit/disable/reset), and render `isActive`.

## Task 1: Add `isActive` to shared `User` type

**Files:**
- Modify: `src/types/user.ts`
- Modify: `src/lib/db/mappers.ts`

- [ ] **Step 1: Update `User` type**

Edit `src/types/user.ts`:

```ts
export interface User {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  branchIds: string[];
  isActive: boolean;
}
```

- [ ] **Step 2: Update `mapUser` to include `isActive`**

Edit `src/lib/db/mappers.ts` `mapUser` return object:

```ts
export function mapUser(user: PrismaUser & { branches: { branchId: string }[] }): User {
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role as UserRole,
    branchIds: user.branches.map((item) => item.branchId),
    isActive: user.isActive,
  };
}
```

- [ ] **Step 3: Quick sanity check**

Run: `npm run lint`  
Expected: no new TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add src/types/user.ts src/lib/db/mappers.ts
git commit -m "Expose user isActive in API types."
```

## Task 2: Create admin user service (`admin-user.service.ts`)

**Files:**
- Create: `src/services/admin-user.service.ts`
- Modify: `src/services/admin.service.ts` (optional, if you want to export wrappers; otherwise Route Handlers call new service directly)

- [ ] **Step 1: Create service skeleton**

Create `src/services/admin-user.service.ts`:

```ts
import { prisma } from "@/lib/prisma";
import { canAccessAdmin } from "@/lib/permissions";
import { hashPassword } from "@/lib/auth/password";
import type { MockSession, UserRole } from "@/types/user";
import { mapUser } from "@/lib/db/mappers";

function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

function generatePassword(length = 12): string {
  const alphabet =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*";
  let out = "";
  for (let i = 0; i < length; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

export type PasswordMode = "set" | "generate";

export type AdminCreateUserInput = {
  name: string;
  username: string;
  role: UserRole;
  branchIds: string[];
  passwordMode: PasswordMode;
  password?: string;
};

export type AdminUpdateUserInput = {
  name?: string;
  role?: UserRole;
  branchIds?: string[];
  isActive?: boolean;
};

export async function createUserForAdmin(
  session: MockSession,
  input: AdminCreateUserInput,
) {
  if (!canAccessAdmin(session.role)) return { error: "Access denied" as const };

  const name = input.name.trim();
  const username = normalizeUsername(input.username);
  if (!name) return { error: "name is required" as const };
  if (!username) return { error: "username is required" as const };

  const password =
    input.passwordMode === "generate" ? generatePassword() : input.password ?? "";
  if (input.passwordMode === "set" && password.trim().length < 8) {
    return { error: "password must be at least 8 characters" as const };
  }

  // Branch requirement: non-admin/hq must have at least one branch
  const requiresBranches = input.role !== "ADMIN" && input.role !== "HQ";
  if (requiresBranches && (!input.branchIds || input.branchIds.length === 0)) {
    return { error: "branchIds is required" as const };
  }

  const passwordHash = await hashPassword(password);

  try {
    const created = await prisma.user.create({
      data: {
        id: `user_${username.replace(/[^a-z0-9._-]/g, "_")}`,
        username,
        name,
        passwordHash,
        role: input.role,
        isActive: true,
        branches: requiresBranches
          ? { create: input.branchIds.map((branchId) => ({ branchId })) }
          : undefined,
      },
      include: { branches: true },
    });

    return {
      user: mapUser(created),
      generatedPassword: input.passwordMode === "generate" ? password : undefined,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Create user failed" as const };
  }
}

export async function updateUserForAdmin(
  session: MockSession,
  userId: string,
  input: AdminUpdateUserInput,
) {
  if (!canAccessAdmin(session.role)) return { error: "Access denied" as const };
  if (!userId) return { error: "userId is required" as const };

  if (input.isActive === false && session.userId === userId) {
    return { error: "cannot disable yourself" as const };
  }

  const existing = await prisma.user.findUnique({
    where: { id: userId },
    include: { branches: true },
  });
  if (!existing) return { error: "User not found" as const };

  const nextName = input.name !== undefined ? input.name.trim() : existing.name;
  if (!nextName) return { error: "name is required" as const };

  const nextRole = input.role ?? (existing.role as UserRole);
  const requiresBranches = nextRole !== "ADMIN" && nextRole !== "HQ";
  const nextBranchIds =
    input.branchIds ?? existing.branches.map((b) => b.branchId);

  if (requiresBranches && nextBranchIds.length === 0) {
    return { error: "branchIds is required" as const };
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (input.branchIds) {
      await tx.userBranch.deleteMany({ where: { userId } });
      if (requiresBranches) {
        await tx.userBranch.createMany({
          data: nextBranchIds.map((branchId) => ({ userId, branchId })),
        });
      }
    }

    return tx.user.update({
      where: { id: userId },
      data: {
        name: nextName,
        role: nextRole,
        isActive: input.isActive ?? existing.isActive,
      },
      include: { branches: true },
    });
  });

  return { user: mapUser(updated) };
}

export async function resetPasswordForAdmin(
  session: MockSession,
  userId: string,
  passwordMode: PasswordMode,
  password?: string,
) {
  if (!canAccessAdmin(session.role)) return { error: "Access denied" as const };
  if (!userId) return { error: "userId is required" as const };

  const newPassword =
    passwordMode === "generate" ? generatePassword() : password ?? "";
  if (passwordMode === "set" && newPassword.trim().length < 8) {
    return { error: "password must be at least 8 characters" as const };
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
  });

  return {
    success: true as const,
    generatedPassword: passwordMode === "generate" ? newPassword : undefined,
  };
}
```

- [ ] **Step 2: Lint**

Run: `npm run lint`  
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/services/admin-user.service.ts
git commit -m "Add admin user management service."
```

## Task 3: Add admin API endpoints for create/update/reset-password

**Files:**
- Modify: `src/app/api/admin/users/route.ts`
- Create: `src/app/api/admin/users/[userId]/route.ts`
- Create: `src/app/api/admin/users/[userId]/reset-password/route.ts`

- [ ] **Step 1: Add POST create to `/api/admin/users`**

Edit `src/app/api/admin/users/route.ts` to include:

```ts
import { createUserForAdmin } from "@/services/admin-user.service";

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const result = await createUserForAdmin(session, body);
  if ("error" in result) {
    const status = result.error === "Access denied" ? 403 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json(result);
}
```

- [ ] **Step 2: Create PATCH `/api/admin/users/[userId]`**

Create `src/app/api/admin/users/[userId]/route.ts`:

```ts
import { NextResponse } from "next/server";
import { updateUserForAdmin } from "@/services/admin-user.service";
import { getServerSession } from "@/services/mock-session.service";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId } = await params;
  const body = await request.json();
  const result = await updateUserForAdmin(session, userId, body);

  if ("error" in result) {
    const status = result.error === "Access denied" ? 403 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json(result);
}
```

- [ ] **Step 3: Create POST `/api/admin/users/[userId]/reset-password`**

Create `src/app/api/admin/users/[userId]/reset-password/route.ts`:

```ts
import { NextResponse } from "next/server";
import { resetPasswordForAdmin } from "@/services/admin-user.service";
import { getServerSession } from "@/services/mock-session.service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId } = await params;
  const body = await request.json();
  const result = await resetPasswordForAdmin(
    session,
    userId,
    body.passwordMode,
    body.password,
  );

  if ("error" in result) {
    const status = result.error === "Access denied" ? 403 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json(result);
}
```

- [ ] **Step 4: Lint**

Run: `npm run lint`  
Expected: no errors.

- [ ] **Step 5: Manual API smoke test**

Run dev server: `npm run dev`  
Then as admin (cookie session), try:
- Create user (generate password) → response includes `generatedPassword`
- Disable user → login fails

- [ ] **Step 6: Commit**

```bash
git add src/app/api/admin/users/route.ts src/app/api/admin/users/[userId]/route.ts src/app/api/admin/users/[userId]/reset-password/route.ts
git commit -m "Add admin user management API endpoints."
```

## Task 4: Enhance Admin Users UI with dialogs + actions

**Files:**
- Modify: `src/app/admin/users/page.tsx`

- [ ] **Step 1: Add `isActive` column + action buttons**

In `src/app/admin/users/page.tsx`, add:
- Status column showing “ใช้งานอยู่ / ปิดใช้งาน”
- Row actions:
  - Edit
  - Disable/Enable (with confirm)
  - Reset password

- [ ] **Step 2: Add “Add user” dialog**

Dialog includes:
- Name, Username, Role
- Branch multi-select (load branches via `GET /api/admin/branches`)
- Password mode toggle:
  - Set password (password + confirm)
  - Generate password

On success:
- refresh list
- if generated: show password in a success alert with copy button

- [ ] **Step 3: Add “Edit user” dialog**

Fields:
- Name, Role, Branch multi-select
- Username read-only

- [ ] **Step 4: Add “Reset password” dialog**

Same mode selector as create. Show generated password once.

- [ ] **Step 5: Lint**

Run: `npm run lint`  
Expected: no errors.

- [ ] **Step 6: Manual UI test**

As admin:
- Create user (set password) → can login with it
- Create user (generated) → can copy password and login
- Disable user → cannot login
- Enable user → can login
- Edit branches/role → access changes

- [ ] **Step 7: Commit**

```bash
git add src/app/admin/users/page.tsx
git commit -m "Add admin UI for managing users."
```

## Task 5: Clean-up and verification

- [ ] **Step 1: Ensure docs are up to date**

Confirm spec remains accurate:
- `docs/superpowers/specs/2026-07-08-admin-user-management-design.md`

- [ ] **Step 2: Verify build (best-effort on Windows)**

Run: `npm run build`  
Note: Prisma on Windows may hit `EPERM` if query engine is locked. If it fails, restart dev server / close node processes and retry.

- [ ] **Step 3: Push final commits**

```bash
git push
```

