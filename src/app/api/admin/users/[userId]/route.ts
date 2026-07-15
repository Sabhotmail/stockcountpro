import { NextRequest, NextResponse } from "next/server";
import { parseRequestBody } from "@/lib/api/parse-body";
import { updateAdminUserBodySchema } from "@/lib/api/schemas";
import { updateUserForAdmin } from "@/services/admin-user.service";
import { getServerSession } from "@/services/mock-session.service";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId } = await params;
  const parsed = await parseRequestBody(req, updateAdminUserBodySchema);
  if (!parsed.ok) return parsed.response;

  const result = await updateUserForAdmin(session, userId, parsed.data);
  if ("error" in result) {
    const status = result.error === "Access denied" ? 403 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json(result);
}
