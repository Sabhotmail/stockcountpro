import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionCookieNameFromHost } from "@/lib/app-env";
import {
  buildSessionCookieSetOptions,
  createSessionToken,
  shouldRefreshSession,
  shouldUseSecureCookies,
  verifySessionTokenMeta,
} from "@/lib/auth/session";
import { getSessionAuthState } from "@/lib/auth/session-user";

const protectedPrefixes = ["/tablet", "/supervisor", "/admin"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = getSessionCookieNameFromHost(
    request.headers.get("host"),
  );

  if (!protectedPrefixes.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  const token = request.cookies.get(sessionCookie)?.value;
  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const verified = await verifySessionTokenMeta(token);
  if (!verified) {
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.delete(sessionCookie);
    return response;
  }

  const authState = await getSessionAuthState(
    verified.session.userId,
    verified.session.sessionVersion,
  );
  if (authState !== "ok") {
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.delete(sessionCookie);
    return response;
  }

  const response = NextResponse.next();
  if (shouldRefreshSession(verified.exp)) {
    const nextToken = await createSessionToken(verified.session);
    response.cookies.set(
      sessionCookie,
      nextToken,
      buildSessionCookieSetOptions(shouldUseSecureCookies(request)),
    );
  }
  return response;
}

export const config = {
  matcher: ["/tablet/:path*", "/supervisor/:path*", "/admin/:path*"],
};
