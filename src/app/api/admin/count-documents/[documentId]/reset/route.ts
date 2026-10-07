import { NextResponse } from "next/server";
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
  let body: { reason?: string; confirmCode?: string };
  try {
    body = (await request.json()) as {
      reason?: string;
      confirmCode?: string;
    };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

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
