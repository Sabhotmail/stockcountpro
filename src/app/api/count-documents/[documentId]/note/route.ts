import { NextResponse } from "next/server";
import { parseRequestBody } from "@/lib/api/parse-body";
import { saveDocumentNoteBodySchema } from "@/lib/api/schemas";
import { saveDocumentNote } from "@/services/count-document.service";
import { getServerSession } from "@/services/mock-session.service";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ documentId: string }> },
) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { documentId } = await params;
  const parsed = await parseRequestBody(request, saveDocumentNoteBodySchema);
  if (!parsed.ok) return parsed.response;

  const result = await saveDocumentNote(
    session,
    documentId,
    parsed.data.note ?? null,
  );

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ note: result.note });
}
