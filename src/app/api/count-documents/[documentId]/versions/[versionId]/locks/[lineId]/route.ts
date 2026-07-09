import { NextResponse } from "next/server";
import {
  acquireOrRenewLineLock,
  releaseLineLock,
} from "@/services/count-line-lock.service";
import { getServerSession } from "@/services/mock-session.service";

export async function POST(
  _request: Request,
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

  const { documentId, lineId } = await params;
  const result = await acquireOrRenewLineLock(session, documentId, lineId);

  if ("error" in result) {
    return NextResponse.json(result, { status: 409 });
  }

  return NextResponse.json({ lock: result });
}

export async function DELETE(
  _request: Request,
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

  const { documentId, lineId } = await params;
  await releaseLineLock(session, documentId, lineId);
  return NextResponse.json({ status: "RELEASED" });
}
