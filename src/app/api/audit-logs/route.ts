import { NextResponse } from "next/server";
import { getAuditLogsForDocumentSession } from "@/services/audit-log.service";
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

  const result = getAuditLogsForDocumentSession(session, documentId);
  if ("error" in result) {
    const status = result.error === "Access denied" ? 403 : 404;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ logs: result });
}
