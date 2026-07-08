import type { MockSession } from "@/types/user";

export const MOCK_SESSION_COOKIE = "stockcount_mock_session";
export const MOCK_SESSION_STORAGE_KEY = "stockcount_mock_session";

// TODO: Replace with Auth.js / Microsoft Entra ID
export function parseSessionCookie(
  cookieHeader: string | null,
): MockSession | null {
  if (!cookieHeader) return null;

  const match = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${MOCK_SESSION_COOKIE}=`));

  if (!match) return null;

  try {
    const value = decodeURIComponent(match.split("=")[1]);
    return JSON.parse(value) as MockSession;
  } catch {
    return null;
  }
}

export function serializeSessionCookie(session: MockSession): string {
  const value = encodeURIComponent(JSON.stringify(session));
  return `${MOCK_SESSION_COOKIE}=${value}; Path=/; SameSite=Lax`;
}
