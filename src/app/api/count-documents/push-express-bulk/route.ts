import { NextResponse } from "next/server";
import { parseRequestBody } from "@/lib/api/parse-body";
import { pushExpressBulkBodySchema } from "@/lib/api/schemas";
import { pushDocumentsToExpressBulk } from "@/services/express-push.service";
import { getServerSession } from "@/services/mock-session.service";

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = await parseRequestBody(request, pushExpressBulkBodySchema);
  if (!parsed.ok) return parsed.response;

  const result = await pushDocumentsToExpressBulk(
    session,
    parsed.data.documentIds,
  );

  if ("error" in result) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status },
    );
  }

  return NextResponse.json(result);
}
