import { NextResponse } from "next/server";
import { canManageSystem } from "@/lib/permissions";
import { getServerSession } from "@/services/mock-session.service";
import { listActiveUserPresences } from "@/services/user-presence.service";

export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canManageSystem(session.role)) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const users = await listActiveUserPresences();
  return NextResponse.json({ users });
}
