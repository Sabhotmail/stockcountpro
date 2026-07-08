import { NextResponse } from "next/server";
import { buildSessionClearCookieHeaders } from "@/services/mock-session.service";

async function logout() {
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
