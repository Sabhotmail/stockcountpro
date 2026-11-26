import { NextResponse } from "next/server";
import { readJsonBody } from "@/lib/api/parse-body";
import { resetCountDocumentForExpressResync } from "@/services/count-document.service";
import { getServerSession } from "@/services/mock-session.service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ documentId: string }> },
) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { documentId } = await params;
  const raw = await readJsonBody(request);
  if (!raw.ok) {
    return NextResponse.json(
      { error: raw.error },
      { status: raw.status ?? 400 },
    );
  }
  const body =
    raw.data !== null && typeof raw.data === "object"
      ? (raw.data as { reason?: string; confirmCode?: string })
      : {};

  const result = await resetCountDocumentForExpressResync(session, documentId, {
    reason: body.reason ?? "",
    confirmCode: body.confirmCode ?? "",
  });

  if ("error" in result) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status },
    );
  }

  return NextResponse.json({
    success: true,
    document: result.document,
  });
}
