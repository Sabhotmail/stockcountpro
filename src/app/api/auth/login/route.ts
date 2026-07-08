import { NextResponse } from "next/server";
import { clearLegacySessionCookie } from "@/lib/auth/session";
import { logLogin } from "@/services/audit-log.service";
import { authenticateUser } from "@/services/auth.service";
import {
  buildSessionClearCookieHeaders,
  buildSessionSetCookieHeader,
  setSessionCookie,
} from "@/services/mock-session.service";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    username?: string;
    password?: string;
  };

  if (!body.username?.trim() || !body.password) {
    return NextResponse.json(
      { error: "Username and password are required" },
      { status: 400 },
    );
  }

  const session = await authenticateUser(body.username, body.password);
  if (!session) {
    return NextResponse.json(
      { error: "Invalid username or password" },
      { status: 401 },
    );
  }

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

  response.headers.append("Set-Cookie", buildSessionSetCookieHeader(token));
  response.headers.append("Set-Cookie", clearLegacySessionCookie());

  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  for (const cookie of buildSessionClearCookieHeaders()) {
    response.headers.append("Set-Cookie", cookie);
  }
  return response;
}
