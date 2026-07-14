import { NextResponse } from "next/server";
import { pushDocumentsToExpressBulk } from "@/services/express-push.service";
import { getServerSession } from "@/services/mock-session.service";

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { documentIds?: unknown };
  try {
    body = (await request.json()) as { documentIds?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const documentIds = Array.isArray(body.documentIds)
    ? body.documentIds.filter((id): id is string => typeof id === "string")
    : [];

  const result = await pushDocumentsToExpressBulk(session, documentIds);

  if ("error" in result) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status },
    );
  }

  return NextResponse.json(result);
}
