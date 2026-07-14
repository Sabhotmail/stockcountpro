import { NextResponse } from "next/server";
import { parseRequestBody } from "@/lib/api/parse-body";
import { recountRequestBodySchema } from "@/lib/api/schemas";
import { requestRecount } from "@/services/review.service";
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
  const parsed = await parseRequestBody(request, recountRequestBodySchema);
  if (!parsed.ok) return parsed.response;

  const result = await requestRecount(session, documentId, parsed.data);

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
