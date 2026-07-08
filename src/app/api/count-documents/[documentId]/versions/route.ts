import { NextResponse } from "next/server";
import { listDocumentVersions } from "@/services/count-version.service";
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
  const result = listDocumentVersions(session, documentId);

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }

  return NextResponse.json({ versions: result });
}
