import { NextResponse } from "next/server";
import { saveEntry } from "@/services/count-entry.service";
import { getServerSession } from "@/services/mock-session.service";
import type { SaveEntryPayload } from "@/types/count";

export async function PATCH(
  request: Request,
  {
    params,
  }: {
    params: Promise<{ documentId: string; versionId: string; lineId: string }>;
  },
) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { documentId, versionId, lineId } = await params;
  const payload = (await request.json()) as SaveEntryPayload;
  const result = saveEntry(session, documentId, versionId, lineId, payload);

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json(result);
}
