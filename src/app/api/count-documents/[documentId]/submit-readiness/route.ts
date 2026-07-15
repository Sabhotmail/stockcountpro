import { NextResponse } from "next/server";
import { getSubmitReadiness } from "@/services/count-document.service";
import { getServerSession } from "@/services/mock-session.service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ documentId: string }> },
) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { documentId } = await params;
  const result = await getSubmitReadiness(session, documentId);

  if ("error" in result && result.error) {
    const status =
      "status" in result && result.status
        ? result.status
        : result.error === "Document not found"
          ? 404
          : 403;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json(result);
}
