import { NextResponse } from "next/server";
import { parseRequestBody } from "@/lib/api/parse-body";
import { loginBodySchema } from "@/lib/api/schemas";
import { logLogin } from "@/services/audit-log.service";
import { authenticateUser } from "@/services/auth.service";
import {
  buildSessionClearCookieHeaders,
  buildSessionSetCookieHeader,
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

  const session = await authenticateUser(
    parsed.data.username,
    parsed.data.password,
  );
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

  for (const cookie of buildSessionClearCookieHeaders()) {
    response.headers.append("Set-Cookie", cookie);
  }
  response.headers.append(
    "Set-Cookie",
    buildSessionSetCookieHeader(token, request),
  );

  return response;
}

export async function DELETE() {
  const { bumpSessionVersion } = await import("@/lib/auth/session-user");
  const { getServerSession } = await import("@/services/mock-session.service");

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
