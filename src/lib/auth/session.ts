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
    !payload.branchIds.every((id) => typeof id === "string")
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
  };
}

export async function createSessionToken(session: MockSession): Promise<string> {
  return new SignJWT({
    userId: session.userId,
    userName: session.userName,
    role: session.role,
    branchIds: session.branchIds,
    hubIds: session.hubIds,
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

export function serializeSessionCookie(token: string): string {
  const secure =
    process.env.NODE_ENV === "production" ? "; Secure" : "";

  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE_SECONDS}${secure}`;
}

export function clearSessionCookie(): string {
  const secure =
    process.env.NODE_ENV === "production" ? "; Secure" : "";

  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

export function clearLegacySessionCookie(): string {
  return "stockcount_mock_session=; Path=/; Max-Age=0; SameSite=Lax";
}
