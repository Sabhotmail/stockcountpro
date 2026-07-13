import { NextResponse } from "next/server";
import { listCountDocumentsForAdmin } from "@/services/admin.service";
import { getServerSession } from "@/services/mock-session.service";

export async function GET(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const result = await listCountDocumentsForAdmin(session, {
    q: searchParams.get("q"),
    documentDate: searchParams.get("documentDate"),
    status: searchParams.get("status"),
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 403 });
  }

  return NextResponse.json({ documents: result });
}
