import { NextResponse } from "next/server";
import { listDocumentsForUser } from "@/services/count-document.service";
import { getServerSession } from "@/services/mock-session.service";

export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const documents = await listDocumentsForUser(session);
  return NextResponse.json({ documents });
}
