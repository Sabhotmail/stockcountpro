import { NextResponse } from "next/server";
import { getVersionDetail } from "@/services/count-version.service";
import { getServerSession } from "@/services/mock-session.service";

export async function GET(
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
  const result = getVersionDetail(session, documentId, versionId);

  if ("error" in result) {
    const status =
      result.error === "Access denied"
        ? 403
        : result.error === "Document not found" ||
            result.error === "Version not found"
          ? 404
          : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ versionDetail: result });
}
