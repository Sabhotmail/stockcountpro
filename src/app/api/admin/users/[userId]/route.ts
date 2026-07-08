import { NextRequest, NextResponse } from "next/server";
import { updateUserForAdmin, type UpdateAdminUserInput } from "@/services/admin-user.service";
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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const result = await updateUserForAdmin(session, userId, body as UpdateAdminUserInput);
  if ("error" in result) {
    const status = result.error === "Access denied" ? 403 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json(result);
}
