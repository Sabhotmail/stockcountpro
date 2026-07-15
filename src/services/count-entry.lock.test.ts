/**
 * Regression: saving an entry must NOT renew the line lock.
 * Lock lifetime is owned by explicit acquire / heartbeat / release on the tablet.
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

async function main() {
  const doc = await prisma.countDocument.findFirst({
    where: { status: { in: ["COUNTING", "RECOUNT_REQUESTED"] } },
    orderBy: { updatedAt: "desc" },
  });
  assert.ok(doc, "need a COUNTING document for lock test");

  const line = await prisma.productLine.findFirst({
    where: { documentId: doc.id },
    orderBy: { lineNo: "asc" },
  });
  assert.ok(line, "need a product line");
  assert.ok(doc.currentVersionId, "document needs currentVersionId");

  const user = await prisma.user.findFirst({
    where: { role: { in: ["STAFF", "SUPERVISOR", "ADMIN"] }, isActive: true },
    include: { branches: true, hubs: true },
  });
  assert.ok(user, "need an active counting user");

  const session: MockSession = {
    userId: user.id,
    userName: user.name,
    role: user.role as MockSession["role"],
    branchIds: user.branches.map((b) => b.branchId),
    hubIds: user.hubs.map((h) => h.hubId),
  };

  await prisma.countLineLock.deleteMany({
    where: { documentId: doc.id, lineId: line.lineId },
  });

  const locked = await acquireOrRenewLineLock(session, doc.id, line.lineId);
  assert.ok(!("error" in locked), "acquire lock should succeed");
  const expiresBefore = new Date(locked.expiresAt).getTime();

  await new Promise((r) => setTimeout(r, 50));

  const existing = await prisma.countEntry.findUnique({
    where: { lineId: line.lineId },
  });

  const saved = await saveEntry(
    session,
    doc.id,
    doc.currentVersionId,
    line.lineId,
    {
      qtyCase: line.allowCase ? (existing?.qtyCase ?? 1) : null,
      qtyPack: line.allowPack ? (existing?.qtyPack ?? null) : null,
      qtyPiece: line.allowPiece ? (existing?.qtyPiece ?? 0) : null,
      baseRevision: existing?.revision,
    },
  );
  assert.ok("status" in saved && saved.status === "SAVED", "save should succeed");

  const after = await prisma.countLineLock.findUnique({
    where: {
      documentId_lineId: { documentId: doc.id, lineId: line.lineId },
    },
  });
  assert.ok(after, "lock should still exist after save while held");
  assert.equal(
    after.expiresAt.getTime(),
    expiresBefore,
    "save must not renew lock expiresAt",
  );

  await releaseLineLock(session, doc.id, line.lineId);
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
