import { NextResponse } from "next/server";
import { saveDocumentNote } from "@/services/count-document.service";
import { getServerSession } from "@/services/mock-session.service";
import type { SaveDocumentNotePayload } from "@/types/count";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ documentId: string }> },
) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { documentId } = await params;
  const payload = (await request.json()) as SaveDocumentNotePayload;
  const result = await saveDocumentNote(session, documentId, payload.note ?? null);

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ note: result.note });
}
