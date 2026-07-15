import { NextRequest, NextResponse } from "next/server";
import { parseRequestBody } from "@/lib/api/parse-body";
import { resetAdminPasswordBodySchema } from "@/lib/api/schemas";
import { resetPasswordForAdmin } from "@/services/admin-user.service";
import { getServerSession } from "@/services/mock-session.service";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId } = await params;
  const parsed = await parseRequestBody(req, resetAdminPasswordBodySchema);
  if (!parsed.ok) return parsed.response;

  const result = await resetPasswordForAdmin(session, userId, parsed.data);
  if ("error" in result) {
    const status = result.error === "Access denied" ? 403 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json(result);
}
