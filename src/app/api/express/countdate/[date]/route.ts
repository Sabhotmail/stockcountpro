import { NextResponse } from "next/server";
import { canAccessAdmin } from "@/lib/permissions";
import {
  fetchExpressCountDate,
  summarizeExpressCountDate,
} from "@/services/express-api.service";
import { getServerSession } from "@/services/mock-session.service";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ date: string }> },
) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canAccessAdmin(session.role)) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const { date } = await params;
  const { searchParams } = new URL(request.url);
  const summaryOnly = searchParams.get("summary") === "1";

  const result = await fetchExpressCountDate(date);
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

  if (summaryOnly) {
    return NextResponse.json({
      summary: summarizeExpressCountDate(result),
    });
  }

  return NextResponse.json({
    summary: summarizeExpressCountDate(result),
    data: result.stockCountData ?? [],
  });
}
