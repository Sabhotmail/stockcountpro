import { NextResponse } from "next/server";
import { requestRecount } from "@/services/review.service";
import { getServerSession } from "@/services/mock-session.service";
import type { RecountRequestPayload } from "@/types/count";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ documentId: string }> },
) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { documentId } = await params;
  const payload = (await request.json()) as RecountRequestPayload;
  const result = await requestRecount(session, documentId, payload);

  if ("error" in result) {
    const status =
      result.error === "Access denied"
        ? 403
        : result.error === "Document not found"
          ? 404
          : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({
    success: true,
    versionId: result.versionId,
    versionNo: result.versionNo,
  });
}
