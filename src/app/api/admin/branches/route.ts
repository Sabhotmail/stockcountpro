import { NextResponse } from "next/server";
import { parseRequestBody } from "@/lib/api/parse-body";
import { createBranchBodySchema } from "@/lib/api/schemas";
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

  const parsed = await parseRequestBody(request, createBranchBodySchema);
  if (!parsed.ok) return parsed.response;

  const result = await createBranchForAdmin(session, {
    code: parsed.data.code,
    name: parsed.data.name,
    expressLocationPrefix: parsed.data.expressLocationPrefix ?? null,
  });

  if ("error" in result) {
    const status = result.error === "Access denied" ? 403 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ branch: result }, { status: 201 });
}
