import { NextResponse } from "next/server";
import { approveDocument } from "@/services/review.service";
import { getServerSession } from "@/services/mock-session.service";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ documentId: string }> },
) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { documentId } = await params;
  const result = await approveDocument(session, documentId);

  if ("error" in result) {
    const status =
      result.error === "Access denied"
        ? 403
        : result.error === "Document not found"
          ? 404
          : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ success: true });
}
