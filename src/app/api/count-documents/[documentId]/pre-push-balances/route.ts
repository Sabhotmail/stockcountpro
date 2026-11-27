import { NextResponse } from "next/server";
import { fetchPrePushBalancesForDocument } from "@/services/pre-push-variance.service";
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
    const result = await fetchPrePushBalancesForDocument(session, documentId);

    if ("error" in result) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status },
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("pre-push-balances failed", error);
    return NextResponse.json(
      { error: "โหลดคงเหลือจาก Express ไม่สำเร็จ" },
      { status: 500 },
    );
  }
}
