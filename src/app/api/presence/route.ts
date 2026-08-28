import { NextResponse } from "next/server";
import { parseRequestBody } from "@/lib/api/parse-body";
import { userPresenceHeartbeatBodySchema } from "@/lib/api/schemas";
import { getServerSession } from "@/services/mock-session.service";
import { touchUserPresence } from "@/services/user-presence.service";

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = await parseRequestBody(request, userPresenceHeartbeatBodySchema);
  if (!parsed.ok) return parsed.response;

  await touchUserPresence(session, parsed.data.path);
  return NextResponse.json({ ok: true });
}
