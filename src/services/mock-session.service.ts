import {
  buildSessionCookieSetOptions,
  clearLegacySessionCookie,
  clearSessionCookieHeaders,
  createSessionToken,
  serializeSessionCookie,
  shouldRefreshSession,
  shouldUseSecureCookies,
  verifySessionTokenMeta,
} from "@/lib/auth/session";
import { getSessionCookieNameFromHost } from "@/lib/app-env";
import { getSessionAuthState } from "@/lib/auth/session-user";
import type { MockSession } from "@/types/user";
import { getUserById } from "@/services/user.service";
import { cookies, headers } from "next/headers";

async function resolveRequestHost(): Promise<string | undefined> {
  try {
    const h = await headers();
    return h.get("x-forwarded-host") ?? h.get("host") ?? undefined;
  } catch {
    return undefined;
  }
}

async function resolveSessionCookieName(): Promise<string> {
  return getSessionCookieNameFromHost(await resolveRequestHost());
}

async function resolveSecureCookieFlag(): Promise<boolean> {
  try {
    const h = await headers();
    const proto =
      h.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
      (h.get("x-forwarded-ssl") === "on" ? "https" : "http");
    const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost";
    return shouldUseSecureCookies(
      new Request(`${proto}://${host}/`, {
        headers: { "x-forwarded-proto": proto },
      }),
    );
  } catch {
    return shouldUseSecureCookies();
  }
}

export async function getServerSession(options?: {
  refreshCookie?: boolean;
}): Promise<MockSession | null> {
  const refreshCookie = options?.refreshCookie !== false;
  const cookieStore = await cookies();
  const sessionCookie = await resolveSessionCookieName();
  const token = cookieStore.get(sessionCookie)?.value;
  if (!token) return null;

  const verified = await verifySessionTokenMeta(token);
  if (!verified) return null;

  const authState = await getSessionAuthState(
    verified.session.userId,
    verified.session.sessionVersion,
  );
  if (authState !== "ok") return null;

  const user = await getUserById(verified.session.userId);
  if (!user || !user.isActive) return null;

  const session: MockSession = {
    ...verified.session,
    userName: user.name,
    role: user.role,
    branchIds: user.branchIds,
    hubIds: user.hubIds,
    sessionVersion: user.sessionVersion,
  };

  if (refreshCookie && shouldRefreshSession(verified.exp)) {
    try {
      const nextToken = await createSessionToken(session);
      const secure = await resolveSecureCookieFlag();
      cookieStore.set(
        sessionCookie,
        nextToken,
        buildSessionCookieSetOptions(secure),
      );
    } catch {
      // Cookie mutation is unavailable in some server contexts; session still valid.
    }
  }

  return session;
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
  const host = requestHost(request);
  return serializeSessionCookie(
    token,
    shouldUseSecureCookies(request),
    Date.now(),
    getSessionCookieNameFromHost(host),
  );
}

export function buildSessionClearCookieHeaders(request?: Request): string[] {
  const host = requestHost(request);
  return [
    ...clearSessionCookieHeaders(getSessionCookieNameFromHost(host)),
    clearLegacySessionCookie(),
  ];
}

function requestHost(request?: Request): string | undefined {
  if (!request) return undefined;
  try {
    return new URL(request.url).host;
  } catch {
    return undefined;
  }
}
