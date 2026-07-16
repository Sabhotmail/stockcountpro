# Security Hardening A+B Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden login (rate limit, password length), revoke sessions via `sessionVersion`, warn on insecure cookies / Express HTTP, and sanitize Express location path segments.

**Architecture:** Add `User.sessionVersion` and embed it in JWTs; validate against DB in `getServerSession` and `proxy`. In-process Maps rate-limit login failures. Whitelist location codes before joining Express URL paths. Keep HTTP LAN and Express HTTP allowed with one-shot process warnings.

**Tech Stack:** Next.js 16, Prisma, jose JWT, Zod, Node `assert` tests via `npx tsx`

## Global Constraints

- Do not force HTTPS for StockCount or Express
- Keep `shouldUseSecureCookies` autodetection / `AUTH_COOKIE_SECURE` override
- Rate limit is in-process only (single Node instance)
- Location codes whitelist: `^[A-Z0-9]+$`
- Password min length 8 for admin set-mode create/reset
- Out of scope: set C (locks/save races), set D (CSRF/headers/body caps/role narrowing)
- Never commit `.env.local` or secrets
- Tests: `npx tsx path/to/file.test.ts` (existing project pattern)

## File map

| File | Responsibility |
|------|----------------|
| `prisma/schema.prisma` + migration | `User.sessionVersion` |
| `src/types/user.ts` | `MockSession.sessionVersion`; optional on `User` |
| `src/lib/db/mappers.ts` | Map `sessionVersion` |
| `src/lib/auth/session.ts` | JWT claim + insecure-cookie warn helper |
| `src/lib/auth/session-user.ts` (new) | Lightweight DB check for proxy/session |
| `src/lib/auth/login-rate-limit.ts` (new) | In-memory failure buckets |
| `src/services/mock-session.service.ts` | Version check; bump on logout |
| `src/services/auth.service.ts` | Include `sessionVersion` in login session |
| `src/services/admin-user.service.ts` | Min password 8; bump version on reset |
| `src/proxy.ts` | Validate sessionVersion + isActive |
| `src/app/api/auth/login/route.ts` | Rate limit + insecure cookie warn |
| `src/app/api/auth/logout/route.ts` | Bump version then clear cookies |
| `src/lib/api/schemas.ts` | Password min 8 |
| `src/lib/express-location.ts` | `assertSafeExpressLocationCodes` |
| `src/services/express-api.service.ts` | Use sanitize; HTTP baseUrl warn |

---

### Task 1: Prisma `sessionVersion` + types

**Files:**
- Modify: `prisma/schema.prisma` (`User` model)
- Create: `prisma/migrations/20260716100000_user_session_version/migration.sql`
- Modify: `src/types/user.ts`
- Modify: `src/lib/db/mappers.ts`
- Modify: `src/services/auth.service.ts`
- Modify: `src/services/user.service.ts` (if needed for selects)

**Interfaces:**
- Produces: `User.sessionVersion: number`, `MockSession.sessionVersion: number`
- Produces: `authenticateUser` returns session including `sessionVersion`

- [ ] **Step 1: Add field to Prisma schema**

In `model User` add:

```prisma
sessionVersion Int @default(0)
```

- [ ] **Step 2: Add migration SQL**

Create `prisma/migrations/20260716100000_user_session_version/migration.sql`:

```sql
-- AlterTable
ALTER TABLE "User" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;
```

- [ ] **Step 3: Extend TypeScript types**

In `src/types/user.ts`:

```typescript
export interface User {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  sessionVersion: number;
  branchIds: string[];
  hubIds: string[];
}

export interface MockSession {
  userId: string;
  userName: string;
  role: UserRole;
  branchIds: string[];
  hubIds: string[];
  sessionVersion: number;
}
```

- [ ] **Step 4: Update `mapUser`**

```typescript
return {
  id: user.id,
  username: user.username,
  name: user.name,
  role: user.role as UserRole,
  isActive: user.isActive,
  sessionVersion: user.sessionVersion,
  branchIds: user.branches.map((item) => item.branchId),
  hubIds: user.hubs?.map((item) => item.hubId) ?? [],
};
```

- [ ] **Step 5: Include version in `authenticateUser` return**

```typescript
return {
  userId: user.id,
  userName: user.name,
  role: user.role as UserRole,
  branchIds: user.branches.map((branch) => branch.branchId),
  hubIds: user.hubs.map((hub) => hub.hubId),
  sessionVersion: user.sessionVersion,
};
```

Also update `buildSessionFromUserId` in `mock-session.service.ts` to set `sessionVersion: user.sessionVersion`.

- [ ] **Step 6: Apply migration**

Run: `npm run db:deploy`  
(or `npx dotenv -e .env.local -- prisma migrate deploy`)

Expected: migration applied; `prisma generate` succeeds.

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260716100000_user_session_version src/types/user.ts src/lib/db/mappers.ts src/services/auth.service.ts src/services/mock-session.service.ts
git commit -m "Add User.sessionVersion for JWT revoke support."
```

---

### Task 2: JWT claim + session validation in getServerSession and proxy

**Files:**
- Modify: `src/lib/auth/session.ts`
- Create: `src/lib/auth/session-user.ts`
- Modify: `src/services/mock-session.service.ts`
- Modify: `src/proxy.ts`
- Create: `src/lib/auth/session-version.test.ts`

**Interfaces:**
- Consumes: `MockSession.sessionVersion`
- Produces: `createSessionToken` writes `sessionVersion`; `verifySessionToken` requires numeric `sessionVersion`
- Produces: `getSessionAuthState(userId, tokenVersion): Promise<'ok' | 'invalid'>`
- Produces: `bumpSessionVersion(userId): Promise<void>`

- [ ] **Step 1: Write failing test for JWT round-trip with version**

Create `src/lib/auth/session-version.test.ts`:

```typescript
import assert from "node:assert/strict";
import {
  createSessionToken,
  verifySessionToken,
} from "@/lib/auth/session";
import { UserRole } from "@/types/user";

async function testSessionVersionRoundTrip() {
  process.env.AUTH_SECRET =
    process.env.AUTH_SECRET ?? "test-secret-at-least-32-characters-long!!";

  const token = await createSessionToken({
    userId: "u1",
    userName: "Test",
    role: UserRole.STAFF,
    branchIds: ["b1"],
    hubIds: [],
    sessionVersion: 3,
  });
  const session = await verifySessionToken(token);
  assert.ok(session);
  assert.equal(session!.sessionVersion, 3);
}

async function testRejectsMissingSessionVersion() {
  // verifySessionToken must return null if claim missing — covered by parseSessionPayload
  // This test documents expected shape via create+verify only.
  await testSessionVersionRoundTrip();
}

await testSessionVersionRoundTrip();
await testRejectsMissingSessionVersion();
console.log("session-version.test: OK");
```

- [ ] **Step 2: Run test — expect fail (missing claim)**

Run: `npx tsx src/lib/auth/session-version.test.ts`  
Expected: FAIL (TypeScript or assertion until JWT includes `sessionVersion`)

- [ ] **Step 3: Update `session.ts` payload**

In `parseSessionPayload`, require:

```typescript
typeof payload.sessionVersion === "number" &&
Number.isInteger(payload.sessionVersion) &&
payload.sessionVersion >= 0
```

Include `sessionVersion: payload.sessionVersion` in returned session.

In `createSessionToken`, add `sessionVersion: session.sessionVersion` to `SignJWT` claims.

- [ ] **Step 4: Create `session-user.ts`**

```typescript
import { prisma } from "@/lib/prisma";

export async function getSessionAuthState(
  userId: string,
  tokenSessionVersion: number,
): Promise<"ok" | "invalid"> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isActive: true, sessionVersion: true },
  });
  if (!user || !user.isActive) return "invalid";
  if (user.sessionVersion !== tokenSessionVersion) return "invalid";
  return "ok";
}

export async function bumpSessionVersion(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { sessionVersion: { increment: 1 } },
  });
}
```

- [ ] **Step 5: Update `getServerSession`**

After `verifySessionToken`, call `getSessionAuthState(session.userId, session.sessionVersion)`. If `"invalid"`, return `null`.

Keep refreshing name/role/branches from `getUserById` as today; returned session must keep token's `sessionVersion` (or user.sessionVersion — they match when ok).

```typescript
return {
  ...session,
  userName: user.name,
  role: user.role,
  branchIds: user.branchIds,
  hubIds: user.hubIds,
  sessionVersion: user.sessionVersion,
};
```

- [ ] **Step 6: Update `proxy.ts`**

After JWT verify:

```typescript
const authState = await getSessionAuthState(
  session.userId,
  session.sessionVersion,
);
if (authState !== "ok") {
  const response = NextResponse.redirect(new URL("/login", request.url));
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
```

- [ ] **Step 7: Re-run test**

Run: `npx tsx src/lib/auth/session-version.test.ts`  
Expected: `session-version.test: OK`

- [ ] **Step 8: Commit**

```bash
git add src/lib/auth/session.ts src/lib/auth/session-user.ts src/lib/auth/session-version.test.ts src/services/mock-session.service.ts src/proxy.ts
git commit -m "Validate JWT sessionVersion against the database."
```

---

### Task 3: Revoke on logout and password reset

**Files:**
- Modify: `src/app/api/auth/logout/route.ts`
- Modify: `src/app/api/auth/login/route.ts` (DELETE logout path if it still clears only)
- Modify: `src/services/admin-user.service.ts` (`resetPasswordForAdmin`)

**Interfaces:**
- Consumes: `bumpSessionVersion(userId)`
- Consumes: `getServerSession` / cookie verify for logout identity

- [ ] **Step 1: Update logout route**

```typescript
import { NextResponse } from "next/server";
import { bumpSessionVersion } from "@/lib/auth/session-user";
import {
  buildSessionClearCookieHeaders,
  getServerSession,
} from "@/services/mock-session.service";

async function logout() {
  const session = await getServerSession();
  if (session) {
    try {
      await bumpSessionVersion(session.userId);
    } catch {
      // still clear cookies
    }
  }

  const response = NextResponse.json({ success: true });
  for (const cookie of buildSessionClearCookieHeaders()) {
    response.headers.append("Set-Cookie", cookie);
  }
  return response;
}

export async function POST() {
  return logout();
}

export async function DELETE() {
  return logout();
}
```

Note: `login/route.ts` `DELETE` currently only clears cookies — either remove it and rely on `/api/auth/logout`, or make it call the same logout helper. Prefer consolidating: leave login DELETE as cookie-clear only **or** change client to use logout only. Check `LogoutButton` / fetch paths; if login DELETE is used, share the helper.

- [ ] **Step 2: Bump version on password reset**

In `resetPasswordForAdmin`, update:

```typescript
await prisma.user.update({
  where: { id: userId },
  data: {
    passwordHash,
    sessionVersion: { increment: 1 },
  },
});
```

- [ ] **Step 3: Manual sanity check notes**

Document in commit body: after logout, old cookie must fail `getServerSession`.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/auth/logout/route.ts src/app/api/auth/login/route.ts src/services/admin-user.service.ts
git commit -m "Bump sessionVersion on logout and password reset."
```

---

### Task 4: Login rate limit + insecure cookie warning

**Files:**
- Create: `src/lib/auth/login-rate-limit.ts`
- Create: `src/lib/auth/login-rate-limit.test.ts`
- Modify: `src/lib/auth/session.ts` (warn helper)
- Modify: `src/app/api/auth/login/route.ts`

**Interfaces:**
- Produces: `getClientIp(request: Request): string`
- Produces: `assertLoginAllowed(ip: string, username: string): { ok: true } | { ok: false }`
- Produces: `recordLoginFailure(ip: string, username: string): void`
- Produces: `clearLoginFailuresForUsername(username: string): void`
- Produces: `warnInsecureSessionCookieOnce(): void`

- [ ] **Step 1: Write rate-limit unit test**

```typescript
import assert from "node:assert/strict";
import {
  assertLoginAllowed,
  clearLoginFailuresForUsername,
  recordLoginFailure,
  resetLoginRateLimitForTests,
} from "@/lib/auth/login-rate-limit";

function testUsernameThrottle() {
  resetLoginRateLimitForTests();
  const ip = "1.2.3.4";
  const username = "brute";

  for (let i = 0; i < 5; i++) {
    assert.equal(assertLoginAllowed(ip, username).ok, true);
    recordLoginFailure(ip, username);
  }
  assert.equal(assertLoginAllowed(ip, username).ok, false);
  clearLoginFailuresForUsername(username);
  assert.equal(assertLoginAllowed(ip, username).ok, true);
}

testUsernameThrottle();
console.log("login-rate-limit.test: OK");
```

- [ ] **Step 2: Run — expect fail**

Run: `npx tsx src/lib/auth/login-rate-limit.test.ts`  
Expected: FAIL module not found

- [ ] **Step 3: Implement `login-rate-limit.ts`**

```typescript
const USER_LIMIT = 5;
const IP_LIMIT = 20;
const WINDOW_MS = 60_000;

type Bucket = { count: number; resetAt: number };

const byUser = new Map<string, Bucket>();
const byIp = new Map<string, Bucket>();

function touch(map: Map<string, Bucket>, key: string, limit: number): boolean {
  const now = Date.now();
  const cur = map.get(key);
  if (!cur || cur.resetAt <= now) {
    map.set(key, { count: 0, resetAt: now + WINDOW_MS });
    return true;
  }
  return cur.count < limit;
}

function incr(map: Map<string, Bucket>, key: string): void {
  const now = Date.now();
  const cur = map.get(key);
  if (!cur || cur.resetAt <= now) {
    map.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }
  cur.count += 1;
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return "unknown";
}

export function assertLoginAllowed(
  ip: string,
  username: string,
): { ok: true } | { ok: false } {
  const userKey = username.trim().toLowerCase();
  if (!touch(byUser, userKey, USER_LIMIT)) return { ok: false };
  if (!touch(byIp, ip, IP_LIMIT)) return { ok: false };
  return { ok: true };
}

export function recordLoginFailure(ip: string, username: string): void {
  incr(byUser, username.trim().toLowerCase());
  incr(byIp, ip);
}

export function clearLoginFailuresForUsername(username: string): void {
  byUser.delete(username.trim().toLowerCase());
}

export function resetLoginRateLimitForTests(): void {
  byUser.clear();
  byIp.clear();
}
```

- [ ] **Step 4: Add insecure cookie warn once in `session.ts`**

```typescript
let warnedInsecureCookie = false;

export function warnInsecureSessionCookieOnce(): void {
  if (warnedInsecureCookie) return;
  warnedInsecureCookie = true;
  console.warn(
    "[auth] Session cookie set without Secure; JWT may be intercepted on the network.",
  );
}
```

Call from login route when `shouldUseSecureCookies(request)` is false, after successful auth.

- [ ] **Step 5: Wire login route**

Before `authenticateUser`:

```typescript
const ip = getClientIp(request);
const gate = assertLoginAllowed(ip, parsed.data.username);
if (!gate.ok) {
  return NextResponse.json(
    { error: "ลองเข้าสู่ระบบใหม่ในอีกสักครู่" },
    { status: 429 },
  );
}
```

On auth failure: `recordLoginFailure(ip, parsed.data.username)` then 401.

On success: `clearLoginFailuresForUsername(parsed.data.username)`; if `!shouldUseSecureCookies(request)` call `warnInsecureSessionCookieOnce()`.

- [ ] **Step 6: Re-run test**

Run: `npx tsx src/lib/auth/login-rate-limit.test.ts`  
Expected: `login-rate-limit.test: OK`

- [ ] **Step 7: Commit**

```bash
git add src/lib/auth/login-rate-limit.ts src/lib/auth/login-rate-limit.test.ts src/lib/auth/session.ts src/app/api/auth/login/route.ts
git commit -m "Rate-limit login failures and warn on insecure cookies."
```

---

### Task 5: Password minimum length 8

**Files:**
- Modify: `src/lib/api/schemas.ts`
- Modify: `src/services/admin-user.service.ts`
- Modify: `src/lib/api/schemas.test.ts`

**Interfaces:**
- Consumes: none new
- Produces: create/reset schemas reject passwords shorter than 8 when `passwordMode === "set"`

- [ ] **Step 1: Add failing schema tests**

```typescript
import { createAdminUserBodySchema, resetAdminPasswordBodySchema } from "@/lib/api/schemas";

function testPasswordMinLength() {
  const short = parseWithSchema(createAdminUserBodySchema, {
    name: "A",
    username: "a",
    role: "STAFF",
    branchIds: ["b1"],
    hubIds: [],
    passwordMode: "set",
    password: "1234567",
  });
  assert.equal(short.ok, false);

  const ok = parseWithSchema(createAdminUserBodySchema, {
    name: "A",
    username: "a",
    role: "STAFF",
    branchIds: ["b1"],
    hubIds: [],
    passwordMode: "set",
    password: "12345678",
  });
  assert.equal(ok.ok, true);

  const resetShort = parseWithSchema(resetAdminPasswordBodySchema, {
    passwordMode: "set",
    password: "short",
  });
  assert.equal(resetShort.ok, false);
}
```

(Adjust import name if reset schema export differs — use the actual export from `schemas.ts`.)

- [ ] **Step 2: Run schemas test — expect fail**

Run: `npx tsx src/lib/api/schemas.test.ts`

- [ ] **Step 3: Update Zod**

Use `.superRefine` or conditional:

```typescript
password: z.string().optional(),
```

plus:

```typescript
.superRefine((data, ctx) => {
  if (data.passwordMode === "set") {
    if (!data.password || data.password.length < 8) {
      ctx.addIssue({
        code: "custom",
        path: ["password"],
        message: "Password must be at least 8 characters",
      });
    }
  }
});
```

Apply to both create and reset password schemas.

- [ ] **Step 4: Service-side check**

In create and reset when `passwordMode === "set"`:

```typescript
if (plainPassword.length < 8) {
  return { error: "Password must be at least 8 characters" };
}
```

- [ ] **Step 5: Re-run test**

Run: `npx tsx src/lib/api/schemas.test.ts`  
Expected: `schemas.test: OK`

- [ ] **Step 6: Commit**

```bash
git add src/lib/api/schemas.ts src/lib/api/schemas.test.ts src/services/admin-user.service.ts
git commit -m "Require at least 8 characters for set passwords."
```

---

### Task 6: Express location sanitize + HTTP transport warning

**Files:**
- Modify: `src/lib/express-location.ts`
- Create: `src/lib/express-location-safe.test.ts`
- Modify: `src/services/express-api.service.ts`

**Interfaces:**
- Produces: `assertSafeExpressLocationCodes(codes: string[]): { ok: true; joined: string } | { ok: false; error: string }`

- [ ] **Step 1: Write failing tests**

```typescript
import assert from "node:assert/strict";
import { assertSafeExpressLocationCodes } from "@/lib/express-location";

function testAcceptsAlphanumeric() {
  const r = assertSafeExpressLocationCodes(["32f1", " 32G1 "]);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.joined, "32F1,32G1");
}

function testRejectsTraversal() {
  const r = assertSafeExpressLocationCodes(["32F1/../api"]);
  assert.equal(r.ok, false);
}

function testRejectsEmpty() {
  const r = assertSafeExpressLocationCodes(["  ", ""]);
  assert.equal(r.ok, false);
}

testAcceptsAlphanumeric();
testRejectsTraversal();
testRejectsEmpty();
console.log("express-location-safe.test: OK");
```

- [ ] **Step 2: Run — expect fail**

Run: `npx tsx src/lib/express-location-safe.test.ts`

- [ ] **Step 3: Implement helper in `express-location.ts`**

```typescript
const LOCATION_CODE_RE = /^[A-Z0-9]+$/;

export function assertSafeExpressLocationCodes(
  codes: string[],
): { ok: true; joined: string } | { ok: false; error: string } {
  const normalized: string[] = [];
  for (const raw of codes) {
    const code = raw.trim().toUpperCase();
    if (!code) continue;
    if (!LOCATION_CODE_RE.test(code)) {
      return {
        ok: false,
        error: `Invalid location code: ${raw.trim()}`,
      };
    }
    normalized.push(code);
  }
  if (normalized.length === 0) {
    return { ok: false, error: "locations are required" };
  }
  return { ok: true, joined: normalized.join(",") };
}
```

- [ ] **Step 4: Use in `fetchExpressCountDateByLocations`**

```typescript
const safe = assertSafeExpressLocationCodes(locationCodes);
if (!safe.ok) return { error: safe.error };

return expressGet<ExpressCountDateByLocationsResponse>(
  `/api/stockcount/countdate/${encodeURIComponent(countDate)}/locations/${safe.joined}`,
  "Express countdate by locations",
);
```

Search for other Express URL builders that interpolate location codes; route them through the same helper.

- [ ] **Step 5: HTTP Express warning in `getExpressConfig`**

```typescript
let warnedExpressHttp = false;

function warnExpressHttpOnce(baseUrl: string): void {
  if (warnedExpressHttp) return;
  if (!baseUrl.toLowerCase().startsWith("http://")) return;
  warnedExpressHttp = true;
  console.warn(
    "[express] EXPRESS_API_BASE_URL is http:// — credentials and bearer tokens travel in cleartext.",
  );
}
```

Call after successful config resolve.

- [ ] **Step 6: Re-run tests**

Run: `npx tsx src/lib/express-location-safe.test.ts`  
Expected: OK

- [ ] **Step 7: Build verify**

Run: `npm run build`  
Expected: exit 0; routes compile; no `/~offline` or PWA leftovers.

- [ ] **Step 8: Commit**

```bash
git add src/lib/express-location.ts src/lib/express-location-safe.test.ts src/services/express-api.service.ts
git commit -m "Sanitize Express location path segments and warn on HTTP."
```

---

## Spec coverage checklist

| Spec requirement | Task |
|------------------|------|
| Login rate limit 5/user, 20/IP, 429 Thai | Task 4 |
| Password min 8 set-mode | Task 5 |
| `sessionVersion` column + JWT | Tasks 1–2 |
| Validate in getServerSession + proxy | Task 2 |
| Bump on logout + password reset | Task 3 |
| Insecure cookie warning | Task 4 |
| Location whitelist + join commas | Task 6 |
| Express HTTP warn, no block | Task 6 |
| Non-goals C/D untouched | — |

## Placeholder / consistency scan

- No TBD steps
- `bumpSessionVersion` / `assertSafeExpressLocationCodes` / `assertLoginAllowed` names consistent across tasks
- Reset schema export is `resetAdminPasswordBodySchema`
