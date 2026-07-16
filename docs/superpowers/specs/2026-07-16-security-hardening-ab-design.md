# Security Hardening A+B Design

Date: 2026-07-16
Status: Approved for planning
Scope: Auth hardening (rate limit, password policy, session version revoke, HTTP cookie warning) and Express location path sanitization with HTTP transport warning.

## Goal

Close the High/Medium security findings in sets **A** and **B** without breaking internal LAN HTTP usage or existing Express HTTP deployments.

Success means:

- Brute-force login attempts receive `429` after a clear threshold.
- Admin-created / reset passwords must be at least 8 characters.
- Logout and password reset invalidate existing JWTs immediately via `sessionVersion`.
- Location codes cannot alter Express API paths (`../` or other traversal characters rejected).
- Operators can still log in over `http://LAN-IP` when needed; the app warns when session cookies are not `Secure`.
- Express sync still works when `EXPRESS_API_BASE_URL` is `http:`; the app warns once that credentials travel in cleartext.

## Non-Goals

- Count integrity races (set C): atomic line locks, save-vs-submit transaction, audit ID sequences.
- Defense-in-depth (set D): CSRF tokens, security headers, JSON body size caps, narrowing STAFF sync/delete roles.
- Forcing HTTPS for StockCount or Express.
- Moving secrets out of `.env.local` to a secret manager.
- Multi-instance shared rate-limit store (Redis).
- Replacing JWT with a full server-side session store.

## Approach

Targeted hardening (Approach 1): fix reported A+B issues with minimal architectural change. Keep current cookie Secure autodetection for LAN HTTP. Keep Express HTTP allowed with a startup/login warning.

## Auth Hardening

### Login rate limit

Add an in-process rate limiter used only by `POST /api/auth/login`.

Suggested defaults:

| Bucket | Limit | Window |
|--------|-------|--------|
| Per normalized username | 5 failures | 60 seconds |
| Per client IP | 20 failures | 60 seconds |

Behavior:

- Failed authentication increments both buckets.
- Successful login clears the username failure bucket.
- When either bucket is exceeded, respond `429` with a Thai message (e.g. ลองเข้าสู่ระบบใหม่ในอีกสักครู่) and do not run bcrypt for that request when already limited.
- Implementation lives in something like `src/lib/auth/login-rate-limit.ts` (Map + timestamps). Acceptable for single-node deploy; document that limits reset on process restart and are not shared across multiple Node processes.

IP extraction: use the leftmost `x-forwarded-for` hop when present, else a stable fallback such as `unknown` (do not invent spoof-sensitive trust without documenting that reverse proxies must set the header).

### Password policy

- Zod schemas for create/reset user (`passwordMode: "set"`) require `password` min length 8 when provided.
- `admin-user.service` enforces the same rule server-side (defense in depth).
- Generated passwords already meet length; leave generate path unchanged if it already produces ≥8 chars.
- Bootstrap admin password rules remain as today (≥8, required in production).

### Session version revoke

Schema change on `User`:

```prisma
sessionVersion Int @default(0)
```

JWT payload gains `sessionVersion` (number). `createSessionToken` / `parseSessionPayload` include and validate it.

Revoke triggers (increment `sessionVersion` by 1):

- Logout (`DELETE` auth logout / login logout path)
- Admin password reset

Deactivating a user remains out of scope for this change; inactive users are already rejected when `getServerSession` / proxy reload `isActive`.

Validation:

- `getServerSession` already reloads the user from DB. After JWT verify, compare `session.sessionVersion` to `user.sessionVersion`. Mismatch → treat as logged out.
- `proxy.ts` currently verifies JWT only. Update it so revoked sessions cannot keep browsing `/tablet`, `/supervisor`, `/admin`: either a lightweight user `sessionVersion` + `isActive` lookup, or shared helper used by both proxy and `getServerSession`.

Logout today only clears cookies. After this change, logout must:

1. Resolve current session user (if any)
2. Increment `sessionVersion`
3. Clear cookies

Unauthenticated logout remains a no-op clear-cookie response.

### Cookie / HTTP LAN warning

Keep `shouldUseSecureCookies` behavior unchanged (request protocol / `AUTH_COOKIE_SECURE` override / production fallback).

When a session cookie is set **without** `Secure`, emit a one-line warning (rate-limited to once per process or once per login burst) stating that the session may be intercepted on the network. Do not block login.

## Express Integration

### Location code sanitization

Before building Express URLs that embed location codes:

1. Trim and uppercase each code.
2. Reject any code that does not match a strict whitelist, e.g. `^[A-Z0-9]+$` (adjust only if production codes legitimately need another character — default is alphanumeric only).
3. Reject empty lists.
4. Join validated codes with `,` (Express expects literal commas — do not encode the commas).
5. Keep `countDate` passed through `encodeURIComponent`.

Primary call site: `fetchExpressCountDateByLocations` in `express-api.service.ts`. Any other path that interpolates client/sync-supplied location codes into URLs must use the same helper (e.g. `assertSafeExpressLocationCodes` in `src/lib/express-location.ts` or adjacent module).

Failed validation returns a clear error to the caller; do not call Express with unsafe input.

### Express HTTP transport warning

When resolving Express config, if `baseUrl` starts with `http:` (not `https:`), log a one-time process warning that Express credentials and bearer tokens will travel in cleartext. Do not fail sync.

Do not modify or commit `.env.local`.

## Testing

Manual / automated where cheap:

- Login: 6th failed attempt for same username within a minute → `429`.
- Create/reset user with 7-char password → validation error; 8-char succeeds.
- Login → copy cookie → logout → replay cookie on API → `401`.
- Reset password → previous session cookie → `401`.
- Location code containing `../` or `/` → sync/fetch path errors before upstream call.
- Normal alphanumeric location list still fetches Express successfully.
- HTTP LAN login still works; warning appears in server log when cookie is not Secure.
- `npm run build` succeeds after Prisma migrate.

## Rollout

1. Prisma migrate adding `sessionVersion` (default `0` — existing sessions in old JWTs without the claim fail parse and must re-login once after deploy; acceptable).
2. Deploy app code with rate limit, password rule, sanitize, warnings.
3. Operators re-login once after deploy if their JWT lacks `sessionVersion`.

## Open Notes

- Rate limits are per process; multiple `next start` instances do not share counters.
- Proxy DB lookup adds a small cost on every protected page navigation; keep the query minimal (`select: { sessionVersion, isActive }`).
