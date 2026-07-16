import { NextResponse } from "next/server";
import { bumpSessionVersion } from "@/lib/auth/session-user";
import {
  buildSessionClearCookieHeaders,
  getServerSession,
} from "@/services/mock-session.service";

async function logout() {
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

export async function POST() {
  return logout();
}

export async function DELETE() {
  return logout();
}
