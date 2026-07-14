import { NextResponse } from "next/server";
import { pushDocumentToExpress } from "@/services/express-push.service";
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
  const result = await pushDocumentToExpress(session, documentId);

  if ("error" in result) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status },
    );
  }

  return NextResponse.json(result);
}
