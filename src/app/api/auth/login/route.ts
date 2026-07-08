import { NextResponse } from "next/server";
import { serializeSessionCookie } from "@/lib/mock-session";
import { logLogin } from "@/services/audit-log.service";
import { buildSessionFromUserId } from "@/services/mock-session.service";

export async function POST(request: Request) {
  const body = (await request.json()) as { userId?: string };
  if (!body.userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  const session = await buildSessionFromUserId(body.userId);
  if (!session) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  await logLogin(session.userId, session.userName);

  const response = NextResponse.json({ session });
  response.headers.set("Set-Cookie", serializeSessionCookie(session));
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.headers.set(
    "Set-Cookie",
    "stockcount_mock_session=; Path=/; Max-Age=0; SameSite=Lax",
  );
  return response;
}
