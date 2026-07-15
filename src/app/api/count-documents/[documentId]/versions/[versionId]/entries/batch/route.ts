import { NextResponse } from "next/server";
import { parseRequestBody } from "@/lib/api/parse-body";
import { batchSaveEntriesBodySchema } from "@/lib/api/schemas";
import { saveEntriesBatch } from "@/services/count-entry.service";
import { getServerSession } from "@/services/mock-session.service";

export async function POST(
  request: Request,
  {
    params,
  }: { params: Promise<{ documentId: string; versionId: string }> },
) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { documentId, versionId } = await params;
  const parsed = await parseRequestBody(request, batchSaveEntriesBodySchema);
  if (!parsed.ok) return parsed.response;

  const result = await saveEntriesBatch(
    session,
    documentId,
    versionId,
    parsed.data.items,
  );

  if ("error" in result) {
    const status =
      result.error === "Access denied"
        ? 403
        : result.error === "Document not found" ||
            result.error === "Version not found" ||
            result.error === "Line not found"
          ? 404
          : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json(result);
}
