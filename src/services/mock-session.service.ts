import {
  SESSION_COOKIE,
  clearLegacySessionCookie,
  clearSessionCookieHeaders,
  createSessionToken,
  serializeSessionCookie,
  shouldUseSecureCookies,
  verifySessionToken,
} from "@/lib/auth/session";
import type { MockSession } from "@/types/user";
import { getUserById } from "@/services/user.service";
import { cookies } from "next/headers";

export async function getServerSession(): Promise<MockSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await verifySessionToken(token);
  if (!session) return null;

  const user = await getUserById(session.userId);
  if (!user || !user.isActive) return null;

  return {
    ...session,
    userName: user.name,
    role: user.role,
    branchIds: user.branchIds,
    hubIds: user.hubIds,
  };
}

export async function buildSessionFromUserId(
  userId: string,
): Promise<MockSession | null> {
  const user = await getUserById(userId);
  if (!user) return null;

  return {
    userId: user.id,
    userName: user.name,
    role: user.role,
    branchIds: user.branchIds,
    hubIds: user.hubIds,
    sessionVersion: user.sessionVersion,
  };
}

export async function setSessionCookie(session: MockSession): Promise<string> {
  return createSessionToken(session);
}

export function buildSessionSetCookieHeader(
  token: string,
  request?: Request,
): string {
  return serializeSessionCookie(token, shouldUseSecureCookies(request));
}

export function buildSessionClearCookieHeaders(): string[] {
  return [...clearSessionCookieHeaders(), clearLegacySessionCookie()];
}
