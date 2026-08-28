import { DOCUMENT_PRESENCE_TTL_MS } from "@/lib/count-collab-constants";
import { canMutateCount } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import type { DocumentViewerInfo } from "@/types/count";
import type { MockSession } from "@/types/user";

function mapViewer(row: {
  userId: string;
  userName: string;
  expiresAt: Date;
}): DocumentViewerInfo {
  return {
    userId: row.userId,
    userName: row.userName,
    expiresAt: row.expiresAt.toISOString(),
  };
}

export async function purgeExpiredPresences(documentId: string): Promise<void> {
  await prisma.countDocumentPresence.deleteMany({
    where: { documentId, expiresAt: { lte: new Date() } },
  });
}

export async function listActivePresences(
  documentId: string,
): Promise<DocumentViewerInfo[]> {
  await purgeExpiredPresences(documentId);
  const rows = await prisma.countDocumentPresence.findMany({
    where: { documentId, expiresAt: { gt: new Date() } },
    orderBy: { userName: "asc" },
  });
  return rows.map(mapViewer);
}

export async function touchDocumentPresence(
  session: MockSession,
  documentId: string,
): Promise<DocumentViewerInfo[]> {
  if (!canMutateCount(session.role)) {
    return listActivePresences(documentId);
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + DOCUMENT_PRESENCE_TTL_MS);

  await prisma.countDocumentPresence.upsert({
    where: {
      documentId_userId: { documentId, userId: session.userId },
    },
    create: {
      documentId,
      userId: session.userId,
      userName: session.userName,
      expiresAt,
      updatedAt: now,
    },
    update: {
      userName: session.userName,
      expiresAt,
      updatedAt: now,
    },
  });

  return listActivePresences(documentId);
}
