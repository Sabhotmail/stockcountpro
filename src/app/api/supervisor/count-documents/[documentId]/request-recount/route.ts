import { NextResponse } from "next/server";
import { httpStatusForServiceError } from "@/lib/api/error-status";
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
    return NextResponse.json(
      { error: result.error },
      { status: httpStatusForServiceError(result.error) },
    );
  }

  return NextResponse.json({
    success: true,
    versionId: result.versionId,
    versionNo: result.versionNo,
  });
}
