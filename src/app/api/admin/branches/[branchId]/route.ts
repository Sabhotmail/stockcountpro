import { NextRequest, NextResponse } from "next/server";
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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { expressLocationCodes } = body as { expressLocationCodes?: unknown };
  if (!Array.isArray(expressLocationCodes)) {
    return NextResponse.json(
      { error: "expressLocationCodes must be an array of strings" },
      { status: 400 },
    );
  }

  if (
    !expressLocationCodes.every(
      (item) => typeof item === "string",
    )
  ) {
    return NextResponse.json(
      { error: "expressLocationCodes must be an array of strings" },
      { status: 400 },
    );
  }

  const result = await updateBranchForAdmin(session, branchId, {
    expressLocationCodes,
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
