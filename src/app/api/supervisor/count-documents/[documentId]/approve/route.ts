import { NextResponse } from "next/server";
import { readJsonBody, parseWithSchema, validationErrorResponse } from "@/lib/api/parse-body";
import { approveBodySchema } from "@/lib/api/schemas";
import { approveDocument } from "@/services/review.service";
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

  let pushToExpress = false;
  const raw = await readJsonBody(request);
  if (raw.ok) {
    const parsed = parseWithSchema(approveBodySchema, raw.data);
    if (!parsed.ok) return validationErrorResponse(parsed.error);
    pushToExpress = parsed.data.pushToExpress === true;
  }
  // empty / non-JSON body → approve only (legacy behavior)

  const result = await approveDocument(session, documentId, { pushToExpress });

  if ("error" in result) {
    const status =
      result.error === "Access denied"
        ? 403
        : result.error === "Document not found"
          ? 404
          : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json(result);
}
