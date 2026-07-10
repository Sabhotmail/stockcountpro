import { NextResponse } from "next/server";
import { canAccessAdmin } from "@/lib/permissions";
import { fetchExpressLocations } from "@/services/express-api.service";
import { getServerSession } from "@/services/mock-session.service";

export async function GET() {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessAdmin(session.role)) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const result = await fetchExpressLocations();
  if ("error" in result) {
    const status = result.error.includes("not configured") ? 503 : 502;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json(result);
}
