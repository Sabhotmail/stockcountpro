import { NextResponse } from "next/server";
import { canAccessAdmin } from "@/lib/permissions";
import { fetchExpressCountDateByLocations } from "@/services/express-api.service";
import { getServerSession } from "@/services/mock-session.service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ date: string; locations: string }> },
) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessAdmin(session.role)) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const { date, locations } = await params;
  const codes = locations
    .split(",")
    .map((code) => code.trim())
    .filter(Boolean);

  const result = await fetchExpressCountDateByLocations(date, codes);
  if ("error" in result) {
    const status = result.error.includes("not configured") ? 503 : 502;
    return NextResponse.json({ error: result.error }, { status });
  }

  if (!result.success) {
    return NextResponse.json(
      { error: result.message ?? "Express API returned failure" },
      { status: 502 },
    );
  }

  return NextResponse.json(result);
}
