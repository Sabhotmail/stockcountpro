/**
 * Lock rules for entry save:
 * - Saver claims/renews their own lock (even if a prior hold expired).
 * - Save is blocked only when another user holds an active lock.
 */
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { saveEntry } from "@/services/count-entry.service";
import {
  acquireOrRenewLineLock,
  releaseLineLock,
} from "@/services/count-line-lock.service";
import type { MockSession } from "@/types/user";

const prisma = new PrismaClient();

function toSession(
  user: {
    id: string;
    name: string;
    role: string;
    branches: { branchId: string }[];
    hubs: { hubId: string }[];
  },
): MockSession {
  return {
    userId: user.id,
    userName: user.name,
    role: user.role as MockSession["role"],
    branchIds: user.branches.map((b) => b.branchId),
    hubIds: user.hubs.map((h) => h.hubId),
  };
}

async function main() {
  const doc = await prisma.countDocument.findFirst({
    where: { status: { in: ["COUNTING", "RECOUNT_REQUESTED"] } },
    orderBy: { updatedAt: "desc" },
  });
  assert.ok(doc, "need a COUNTING document for lock test");
  assert.ok(doc.currentVersionId, "document needs currentVersionId");

  const line = await prisma.productLine.findFirst({
    where: { documentId: doc.id },
    orderBy: { lineNo: "asc" },
  });
  assert.ok(line, "need a product line");

  const users = await prisma.user.findMany({
    where: {
      role: { in: ["STAFF", "SUPERVISOR", "ADMIN"] },
      isActive: true,
    },
    include: { branches: true, hubs: true },
    take: 2,
  });
  assert.ok(users.length >= 2, "need two counting users");

  const saver = toSession(users[0]!);
  const other = toSession(users[1]!);

  await prisma.countLineLock.deleteMany({
    where: { documentId: doc.id, lineId: line.lineId },
  });

  const existing = await prisma.countEntry.findUnique({
    where: { lineId: line.lineId },
  });

  const payload = {
    qtyCase: line.allowCase ? (existing?.qtyCase ?? 1) : null,
    qtyPack: line.allowPack ? (existing?.qtyPack ?? null) : null,
    qtyPiece: line.allowPiece ? (existing?.qtyPiece ?? 0) : null,
    baseRevision: existing?.revision,
  };

  // Expired/missing lock: saver must still be able to save (claim).
  await prisma.countLineLock.create({
    data: {
      documentId: doc.id,
      lineId: line.lineId,
      lockedByUserId: saver.userId,
      lockedByUserName: saver.userName,
      expiresAt: new Date(Date.now() - 1_000),
      updatedAt: new Date(Date.now() - 1_000),
    },
  });

  const saveAfterExpiry = await saveEntry(
    saver,
    doc.id,
    doc.currentVersionId,
    line.lineId,
    payload,
  );
  assert.ok(
    "status" in saveAfterExpiry && saveAfterExpiry.status === "SAVED",
    "save after expired own lock should succeed",
  );

  await releaseLineLock(saver, doc.id, line.lineId);
  await prisma.countLineLock.deleteMany({
    where: { documentId: doc.id, lineId: line.lineId },
  });

  // Active lock held by someone else: saver must be blocked.
  const otherLock = await acquireOrRenewLineLock(other, doc.id, line.lineId);
  assert.ok(!("error" in otherLock), "other user should acquire lock");

  const entryAfter = await prisma.countEntry.findUnique({
    where: { lineId: line.lineId },
  });
  const blocked = await saveEntry(
    saver,
    doc.id,
    doc.currentVersionId,
    line.lineId,
    {
      ...payload,
      baseRevision: entryAfter?.revision,
      qtyCase: line.allowCase ? (entryAfter?.qtyCase ?? 1) : null,
    },
  );
  assert.ok(
    "error" in blocked && blocked.error === "LOCKED",
    "save must stay blocked while another user holds the lock",
  );

  await releaseLineLock(other, doc.id, line.lineId);
  console.log("count-entry.lock.test: OK");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
