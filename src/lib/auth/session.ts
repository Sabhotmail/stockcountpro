import { SignJWT, jwtVerify } from "jose";
import type { MockSession } from "@/types/user";
import { UserRole } from "@/types/user";

export const SESSION_COOKIE = "stockcount_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;

function getAuthSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET must be set and at least 32 characters");
  }

  return new TextEncoder().encode(secret);
}

function parseSessionPayload(payload: Record<string, unknown>): MockSession | null {
  if (
    typeof payload.userId !== "string" ||
    typeof payload.userName !== "string" ||
    typeof payload.role !== "string" ||
    !Object.values(UserRole).includes(payload.role as UserRole) ||
    !Array.isArray(payload.branchIds) ||
    !payload.branchIds.every((id) => typeof id === "string") ||
    typeof payload.sessionVersion !== "number" ||
    !Number.isInteger(payload.sessionVersion) ||
    payload.sessionVersion < 0
  ) {
    return null;
  }

  const hubIds = Array.isArray(payload.hubIds)
    ? payload.hubIds.filter((id): id is string => typeof id === "string")
    : [];

  return {
    userId: payload.userId,
    userName: payload.userName,
    role: payload.role as UserRole,
    branchIds: payload.branchIds,
    hubIds,
    sessionVersion: payload.sessionVersion,
  };
}

export async function createSessionToken(session: MockSession): Promise<string> {
  return new SignJWT({
    userId: session.userId,
    userName: session.userName,
    role: session.role,
    branchIds: session.branchIds,
    hubIds: session.hubIds,
    sessionVersion: session.sessionVersion,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(getAuthSecret());
}

export async function verifySessionToken(
  token: string,
): Promise<MockSession | null> {
  try {
    const { payload } = await jwtVerify(token, getAuthSecret());
    return parseSessionPayload(payload as Record<string, unknown>);
  } catch {
    return null;
  }
}

/**
 * Decide Secure cookie flag.
 * - AUTH_COOKIE_SECURE=true|false overrides
 * - else use request https / x-forwarded-proto (LAN http://IP works with npm start)
 * - else fall back to NODE_ENV===production
 */
export function shouldUseSecureCookies(request?: Request): boolean {
  const forced = process.env.AUTH_COOKIE_SECURE?.trim().toLowerCase();
  if (forced === "true" || forced === "1") return true;
  if (forced === "false" || forced === "0") return false;

  if (request) {
    const forwarded = request.headers
      .get("x-forwarded-proto")
      ?.split(",")[0]
      ?.trim()
      .toLowerCase();
    if (forwarded === "https") return true;
    if (forwarded === "http") return false;
    try {
      return new URL(request.url).protocol === "https:";
    } catch {
      // fall through
    }
  }

  return process.env.NODE_ENV === "production";
}

export function serializeSessionCookie(
  token: string,
  secure = shouldUseSecureCookies(),
): string {
  const secureFlag = secure ? "; Secure" : "";
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE_SECONDS}${secureFlag}`;
}

/** Clear both Secure and non-Secure variants so leftover cookies cannot stick. */
export function clearSessionCookieHeaders(): string[] {
  const base = `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
  return [base, `${base}; Secure`];
}

export function clearSessionCookie(): string {
  return clearSessionCookieHeaders()[0];
}

export function clearLegacySessionCookie(): string {
  return "stockcount_mock_session=; Path=/; Max-Age=0; SameSite=Lax";
}

let warnedInsecureCookie = false;

export function warnInsecureSessionCookieOnce(): void {
  if (warnedInsecureCookie) return;
  warnedInsecureCookie = true;
  console.warn(
    "[auth] Session cookie set without Secure; JWT may be intercepted on the network.",
  );
}
