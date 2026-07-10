import { NextResponse } from "next/server";
import {
  createBranchForAdmin,
  listBranchesForAdmin,
} from "@/services/admin.service";
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

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { code, name, expressLocationPrefix } = body as {
    code?: unknown;
    name?: unknown;
    expressLocationPrefix?: unknown;
  };

  if (typeof code !== "string" || typeof name !== "string") {
    return NextResponse.json(
      { error: "code and name are required strings" },
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

  const result = await createBranchForAdmin(session, {
    code,
    name,
    expressLocationPrefix:
      expressLocationPrefix === undefined ? null : expressLocationPrefix,
  });

  if ("error" in result) {
    const status =
      result.error === "Access denied"
        ? 403
        : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ branch: result }, { status: 201 });
}
