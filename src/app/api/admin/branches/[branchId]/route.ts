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

  const record = body as Record<string, unknown>;

  if ("code" in record) {
    return NextResponse.json(
      { error: "Branch code cannot be changed" },
      { status: 400 },
    );
  }

  const { name, expressLocationPrefix, isActive } = record as {
    name?: unknown;
    expressLocationPrefix?: unknown;
    isActive?: unknown;
  };

  if (name !== undefined && typeof name !== "string") {
    return NextResponse.json(
      { error: "name must be a string" },
      { status: 400 },
    );
  }

  if (
    expressLocationPrefix !== undefined &&
    expressLocationPrefix !== null &&
    typeof expressLocationPrefix !== "string"
  ) {
    return NextResponse.json(
      { error: "expressLocationPrefix must be a string or null" },
      { status: 400 },
    );
  }

  if (isActive !== undefined && typeof isActive !== "boolean") {
    return NextResponse.json(
      { error: "isActive must be a boolean" },
      { status: 400 },
    );
  }

  if (
    name === undefined &&
    expressLocationPrefix === undefined &&
    isActive === undefined
  ) {
    return NextResponse.json(
      { error: "At least one field is required" },
      { status: 400 },
    );
  }

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
