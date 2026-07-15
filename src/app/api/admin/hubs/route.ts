import { getServerSession } from "@/services/mock-session.service";
import {
  createHubForAdmin,
  listHubsForAdmin,
} from "@/services/admin.service";
import { NextResponse } from "next/server";
import { parseRequestBody } from "@/lib/api/parse-body";
import { createHubBodySchema } from "@/lib/api/schemas";

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

  const parsed = await parseRequestBody(request, createHubBodySchema);
  if (!parsed.ok) return parsed.response;

  const result = await createHubForAdmin(session, {
    branchId: parsed.data.branchId,
    code: parsed.data.code,
    name: parsed.data.name,
    shortName: parsed.data.shortName,
    suffixLetter: parsed.data.suffixLetter,
  });

  if ("error" in result) {
    const status = result.error === "Access denied" ? 403 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ hub: result }, { status: 201 });
}
