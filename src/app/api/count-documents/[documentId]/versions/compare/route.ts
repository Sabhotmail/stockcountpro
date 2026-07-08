import { NextResponse } from "next/server";
import { compareDocumentVersions } from "@/services/count-version.service";
import { getServerSession } from "@/services/mock-session.service";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ documentId: string }> },
) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { documentId } = await params;
  const { searchParams } = new URL(request.url);
  const from = Number.parseInt(searchParams.get("from") ?? "", 10);
  const to = Number.parseInt(searchParams.get("to") ?? "", 10);

  if (Number.isNaN(from) || Number.isNaN(to)) {
    return NextResponse.json(
      { error: "from and to version numbers are required" },
      { status: 400 },
    );
  }

  const result = compareDocumentVersions(session, documentId, from, to);

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ compare: result });
}
