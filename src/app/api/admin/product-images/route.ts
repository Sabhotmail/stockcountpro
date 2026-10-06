import { NextResponse } from "next/server";
import { canAccessAdmin } from "@/lib/permissions";
import { getServerSession } from "@/services/mock-session.service";
import { listMissingProductImages } from "@/services/product-image-report.service";

export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canAccessAdmin(session.role)) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const report = await listMissingProductImages();
  return NextResponse.json(report);
}
