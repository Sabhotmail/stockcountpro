import { NextResponse } from "next/server";
import { getAuditLogsByDocument } from "@/services/audit-log.service";
import { getServerSession } from "@/services/mock-session.service";

export async function GET(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const documentId = searchParams.get("documentId");

  if (!documentId) {
    return NextResponse.json(
      { error: "documentId is required" },
      { status: 400 },
    );
  }

  const logs = getAuditLogsByDocument(documentId);
  return NextResponse.json({ logs });
}
