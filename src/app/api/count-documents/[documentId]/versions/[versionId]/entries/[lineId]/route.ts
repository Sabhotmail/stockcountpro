import { NextResponse } from "next/server";
import { httpStatusForServiceError } from "@/lib/api/error-status";
import { parseRequestBody } from "@/lib/api/parse-body";
import { saveEntryBodySchema } from "@/lib/api/schemas";
import { saveEntry } from "@/services/count-entry.service";
import { getServerSession } from "@/services/mock-session.service";

export async function PATCH(
  request: Request,
  {
    params,
  }: {
    params: Promise<{ documentId: string; versionId: string; lineId: string }>;
  },
) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { documentId, versionId, lineId } = await params;
  const parsed = await parseRequestBody(request, saveEntryBodySchema);
  if (!parsed.ok) return parsed.response;

  const result = await saveEntry(
    session,
    documentId,
    versionId,
    lineId,
    parsed.data,
  );

  if ("error" in result) {
    if (result.error === "CONFLICT" || result.error === "LOCKED") {
      return NextResponse.json(result, { status: 409 });
    }
    return NextResponse.json(
      { error: result.error },
      { status: httpStatusForServiceError(result.error) },
    );
  }

  return NextResponse.json(result);
}
