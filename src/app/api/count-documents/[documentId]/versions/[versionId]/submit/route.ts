import { NextResponse } from "next/server";
import { httpStatusForServiceError } from "@/lib/api/error-status";
import { submitVersion } from "@/services/count-document.service";
import { getServerSession } from "@/services/mock-session.service";

export async function POST(
  _request: Request,
  {
    params,
  }: { params: Promise<{ documentId: string; versionId: string }> },
) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { documentId, versionId } = await params;
  const result = await submitVersion(session, documentId, versionId);

  if ("error" in result) {
    return NextResponse.json(
      { error: result.error },
      { status: httpStatusForServiceError(result.error) },
    );
  }

  return NextResponse.json({ success: true });
}
