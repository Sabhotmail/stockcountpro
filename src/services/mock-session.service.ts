import {
  SESSION_COOKIE,
  clearLegacySessionCookie,
  clearSessionCookie,
  createSessionToken,
  serializeSessionCookie,
  verifySessionToken,
} from "@/lib/auth/session";
import type { MockSession } from "@/types/user";
import { getUserById } from "@/services/user.service";
import { cookies } from "next/headers";

export async function getServerSession(): Promise<MockSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  return verifySessionToken(token);
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
  };
}

export async function setSessionCookie(session: MockSession): Promise<string> {
  return createSessionToken(session);
}

export function buildSessionSetCookieHeader(token: string): string {
  return serializeSessionCookie(token);
}

export function buildSessionClearCookieHeaders(): string[] {
  return [clearSessionCookie(), clearLegacySessionCookie()];
}
