import { NextResponse } from "next/server";
import { getDocumentDetail } from "@/services/count-document.service";
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
  const detail = getDocumentDetail(session, documentId);

  if (!detail) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  return NextResponse.json({ document: detail });
}
