import { NextResponse } from "next/server";
import { saveEntriesBatch } from "@/services/count-entry.service";
import { getServerSession } from "@/services/mock-session.service";
import type { BatchSaveEntryItem } from "@/types/count";

export async function POST(
  request: Request,
  {
    params,
  }: { params: Promise<{ documentId: string; versionId: string }> },
) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { documentId, versionId } = await params;
  const body = await request.json();
  const items = body.items as BatchSaveEntryItem[] | undefined;

  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json(
      { error: "items array is required" },
      { status: 400 },
    );
  }

  const result = saveEntriesBatch(session, documentId, versionId, items);

  if ("error" in result) {
    const status =
      result.error === "Access denied"
        ? 403
        : result.error === "Document not found" ||
            result.error === "Version not found" ||
            result.error === "Line not found"
          ? 404
          : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json(result);
}
