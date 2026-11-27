import { NextResponse } from "next/server";
import { getExpressVarianceReportContext } from "@/services/express-variance-report.service";
import { getServerSession } from "@/services/mock-session.service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ documentId: string }> },
) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { documentId } = await params;
    const result = await getExpressVarianceReportContext(session, documentId);

    if ("error" in result) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status },
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("express-variance-report failed", error);
    return NextResponse.json(
      { error: "โหลดหน้ารายงานไม่สำเร็จ" },
      { status: 500 },
    );
  }
}
