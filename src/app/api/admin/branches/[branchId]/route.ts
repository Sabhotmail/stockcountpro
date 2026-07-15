import { NextRequest, NextResponse } from "next/server";
import { parseRequestBody } from "@/lib/api/parse-body";
import { updateBranchBodySchema } from "@/lib/api/schemas";
import { updateBranchForAdmin } from "@/services/admin.service";
import { getServerSession } from "@/services/mock-session.service";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ branchId: string }> },
) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { branchId } = await params;
  const parsed = await parseRequestBody(req, updateBranchBodySchema);
  if (!parsed.ok) return parsed.response;

  const { name, expressLocationPrefix, isActive } = parsed.data;

  const result = await updateBranchForAdmin(session, branchId, {
    ...(name !== undefined ? { name } : {}),
    ...(expressLocationPrefix !== undefined
      ? { expressLocationPrefix }
      : {}),
    ...(isActive !== undefined ? { isActive } : {}),
  });

  if ("error" in result) {
    const status =
      result.error === "Access denied"
        ? 403
        : result.error === "Branch not found"
          ? 404
          : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ branch: result });
}
