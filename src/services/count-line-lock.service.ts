import { mapLineLock } from "@/lib/db/mappers";
import { getLineLockTtlMs } from "@/services/app-settings.service";
import { getDocumentForSession } from "@/lib/document-access";
import { canMutateCount } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import type { LineLockInfo } from "@/types/count";
import type { MockSession } from "@/types/user";

async function lockExpiresAt(from = new Date()): Promise<Date> {
  const ttlMs = await getLineLockTtlMs();
  return new Date(from.getTime() + ttlMs);
}

export async function purgeExpiredLocks(documentId: string): Promise<void> {
  await prisma.countLineLock.deleteMany({
    where: { documentId, expiresAt: { lte: new Date() } },
  });
}

export async function listActiveLocks(documentId: string): Promise<LineLockInfo[]> {
  await purgeExpiredLocks(documentId);
  const rows = await prisma.countLineLock.findMany({
    where: { documentId, expiresAt: { gt: new Date() } },
    orderBy: { lineId: "asc" },
  });
  return rows.map(mapLineLock);
}

export async function acquireOrRenewLineLock(
  session: MockSession,
  documentId: string,
  lineId: string,
): Promise<LineLockInfo | SaveLockError> {
  if (!canMutateCount(session.role)) {
    return { error: "LOCKED", message: "Access denied" };
  }

  const access = await getDocumentForSession(session, documentId);
  if (!access.ok) return { error: "LOCKED", message: access.error };

  const line = await prisma.productLine.findFirst({
    where: { documentId, lineId },
  });
  if (!line) return { error: "LOCKED", message: "Line not found" };

  await purgeExpiredLocks(documentId);

  const existing = await prisma.countLineLock.findUnique({
    where: { documentId_lineId: { documentId, lineId } },
  });

  const now = new Date();
  const expiresAt = await lockExpiresAt(now);

  if (
    existing &&
    existing.expiresAt > now &&
    existing.lockedByUserId !== session.userId
  ) {
    return {
      error: "LOCKED",
      message: `รายการนี้กำลังถูกนับโดย ${existing.lockedByUserName}`,
      lockedByUserName: existing.lockedByUserName,
    };
  }

  const saved = await prisma.countLineLock.upsert({
    where: { documentId_lineId: { documentId, lineId } },
    create: {
      documentId,
      lineId,
      lockedByUserId: session.userId,
      lockedByUserName: session.userName,
      expiresAt,
      updatedAt: now,
    },
    update: {
      lockedByUserId: session.userId,
      lockedByUserName: session.userName,
      expiresAt,
      updatedAt: now,
    },
  });

  return mapLineLock(saved);
}

export async function releaseLineLock(
  session: MockSession,
  documentId: string,
  lineId: string,
): Promise<void> {
  await prisma.countLineLock.deleteMany({
    where: {
      documentId,
      lineId,
      lockedByUserId: session.userId,
    },
  });
}

export async function assertCallerHoldsActiveLock(
  session: MockSession,
  documentId: string,
  lineId: string,
): Promise<{ ok: true } | SaveLockError> {
  await purgeExpiredLocks(documentId);

  const lock = await prisma.countLineLock.findUnique({
    where: { documentId_lineId: { documentId, lineId } },
  });

  const now = new Date();
  if (!lock || lock.expiresAt <= now) {
    return {
      error: "LOCKED",
      message: "การยึดรายการหมดอายุ กรุณาเริ่มนับรายการนี้ใหม่",
    };
  }

  if (lock.lockedByUserId !== session.userId) {
    return {
      error: "LOCKED",
      message: `รายการนี้กำลังถูกนับโดย ${lock.lockedByUserName}`,
      lockedByUserName: lock.lockedByUserName,
    };
  }

  return { ok: true };
}

export type SaveLockError = {
  error: "LOCKED";
  message: string;
  lockedByUserName?: string;
};
