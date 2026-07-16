import { NextResponse } from "next/server";
import { parseRequestBody } from "@/lib/api/parse-body";
import { loginBodySchema } from "@/lib/api/schemas";
import { bumpSessionVersion } from "@/lib/auth/session-user";
import {
  shouldUseSecureCookies,
  warnInsecureSessionCookieOnce,
} from "@/lib/auth/session";
import {
  assertLoginAllowed,
  clearLoginFailuresForUsername,
  getClientIp,
  recordLoginFailure,
} from "@/lib/auth/login-rate-limit";
import { logLogin } from "@/services/audit-log.service";
import { authenticateUser } from "@/services/auth.service";
import {
  buildSessionClearCookieHeaders,
  buildSessionSetCookieHeader,
  getServerSession,
  setSessionCookie,
} from "@/services/mock-session.service";

export async function POST(request: Request) {
  const parsed = await parseRequestBody(request, loginBodySchema);
  if (!parsed.ok) {
    return NextResponse.json(
      { error: "Username and password are required" },
      { status: 400 },
    );
  }

  const ip = getClientIp(request);
  const gate = assertLoginAllowed(ip, parsed.data.username);
  if (!gate.ok) {
    return NextResponse.json(
      { error: "ลองเข้าสู่ระบบใหม่ในอีกสักครู่" },
      { status: 429 },
    );
  }

  const session = await authenticateUser(
    parsed.data.username,
    parsed.data.password,
  );
  if (!session) {
    recordLoginFailure(ip, parsed.data.username);
    return NextResponse.json(
      { error: "Invalid username or password" },
      { status: 401 },
    );
  }

  clearLoginFailuresForUsername(parsed.data.username);
  await logLogin(session.userId, session.userName);

  const token = await setSessionCookie(session);
  const response = NextResponse.json({
    user: {
      userId: session.userId,
      userName: session.userName,
      role: session.role,
      branchIds: session.branchIds,
    },
  });

  for (const cookie of buildSessionClearCookieHeaders()) {
    response.headers.append("Set-Cookie", cookie);
  }
  response.headers.append(
    "Set-Cookie",
    buildSessionSetCookieHeader(token, request),
  );

  if (!shouldUseSecureCookies(request)) {
    warnInsecureSessionCookieOnce();
  }

  return response;
}

export async function DELETE() {
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
