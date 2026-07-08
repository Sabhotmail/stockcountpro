import { NextResponse } from "next/server";
import { listBranchesForAdmin } from "@/services/admin.service";
import { getServerSession } from "@/services/mock-session.service";

export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await listBranchesForAdmin(session);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 403 });
  }

  return NextResponse.json({ branches: result });
}
