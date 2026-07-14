import { NextRequest, NextResponse } from "next/server";
import { parseRequestBody } from "@/lib/api/parse-body";
import { createAdminUserBodySchema } from "@/lib/api/schemas";
import { listUsersForAdmin } from "@/services/admin.service";
import { createUserForAdmin } from "@/services/admin-user.service";
import { getServerSession } from "@/services/mock-session.service";

export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await listUsersForAdmin(session);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 403 });
  }

  return NextResponse.json({ users: result });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = await parseRequestBody(req, createAdminUserBodySchema);
  if (!parsed.ok) return parsed.response;

  const result = await createUserForAdmin(session, parsed.data);
  if ("error" in result) {
    const status = result.error === "Access denied" ? 403 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json(result, { status: 201 });
}
