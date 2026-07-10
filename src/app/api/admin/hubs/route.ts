import { getServerSession } from "@/services/mock-session.service";
import {
  createHubForAdmin,
  listHubsForAdmin,
  updateHubForAdmin,
} from "@/services/admin.service";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const branchId = searchParams.get("branchId");

  const result = await listHubsForAdmin(session, branchId);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 403 });
  }

  return NextResponse.json({ hubs: result });
}

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    branchId?: string;
    code?: string;
    name?: string;
    shortName?: string | null;
    suffixLetter?: string | null;
  };

  if (!body.branchId || !body.code || !body.name) {
    return NextResponse.json({ error: "branchId, code, and name are required" }, { status: 400 });
  }

  const result = await createHubForAdmin(session, {
    branchId: body.branchId,
    code: body.code,
    name: body.name,
    shortName: body.shortName,
    suffixLetter: body.suffixLetter,
  });

  if ("error" in result) {
    const status = result.error === "Access denied" ? 403 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ hub: result }, { status: 201 });
}
