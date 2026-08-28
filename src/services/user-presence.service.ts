import {
  composePresenceDetail,
  describePresencePath,
  USER_PRESENCE_TTL_MS,
} from "@/lib/user-presence";
import { prisma } from "@/lib/prisma";
import type { MockSession, UserRole } from "@/types/user";

export type ActiveUserPresence = {
  userId: string;
  userName: string;
  role: UserRole;
  lastSeenAt: string;
  activity: string;
};

export async function touchUserPresence(
  session: MockSession,
  path: string,
): Promise<void> {
  const pathname = path.split("?")[0] ?? path;
  if (!pathname.startsWith("/") || pathname === "/login") return;

  const now = new Date();
  const expiresAt = new Date(now.getTime() + USER_PRESENCE_TTL_MS);

  await prisma.userPresence.upsert({
    where: { userId: session.userId },
    create: {
      userId: session.userId,
      userName: session.userName,
      role: session.role,
      path: pathname,
      expiresAt,
      updatedAt: now,
    },
    update: {
      userName: session.userName,
      role: session.role,
      path: pathname,
      expiresAt,
      updatedAt: now,
    },
  });
}

export async function clearUserPresence(userId: string): Promise<void> {
  await prisma.userPresence.deleteMany({ where: { userId } });
}

export async function listActiveUserPresences(
  now: Date = new Date(),
): Promise<ActiveUserPresence[]> {
  await prisma.userPresence.deleteMany({
    where: { expiresAt: { lte: now } },
  });

  const rows = await prisma.userPresence.findMany({
    where: { expiresAt: { gt: now } },
    orderBy: { updatedAt: "desc" },
  });

  const documentIds = [
    ...new Set(
      rows
        .map((row) => describePresencePath(row.path).documentId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const documents =
    documentIds.length === 0
      ? []
      : await prisma.countDocument.findMany({
          where: { id: { in: documentIds } },
          select: {
            id: true,
            documentNo: true,
            locationCode: true,
            locationName: true,
          },
        });
  const documentById = new Map(documents.map((doc) => [doc.id, doc]));

  return rows.map((row) => {
    const described = describePresencePath(row.path);
    const document = described.documentId
      ? (documentById.get(described.documentId) ?? null)
      : null;
    return {
      userId: row.userId,
      userName: row.userName,
      role: row.role,
      lastSeenAt: row.updatedAt.toISOString(),
      activity: composePresenceDetail(
        described.pageLabel,
        document
          ? {
              locationCode: document.locationCode,
              locationName: document.locationName,
              documentNo: document.documentNo,
            }
          : null,
      ),
    };
  });
}
