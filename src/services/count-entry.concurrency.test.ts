/**
 * Concurrency contract for entry save (Security set C):
 * - Two simultaneous saves that start from the same baseRevision must NOT both
 *   win. Exactly one commits and the other gets a CONFLICT — no lost update.
 * - After the race the revision advances by exactly one (proof that the losing
 *   write was rejected, not silently overwritten).
 *
 * Run: dotenv -e .env.local -- tsx src/services/count-entry.concurrency.test.ts
 */
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { saveEntry } from "@/services/count-entry.service";
import { releaseLineLock } from "@/services/count-line-lock.service";
import type { MockSession } from "@/types/user";

const prisma = new PrismaClient();

function toSession(user: {
  id: string;
  name: string;
  role: string;
  branches: { branchId: string }[];
  hubs: { hubId: string }[];
}): MockSession {
  return {
    userId: user.id,
    userName: user.name,
    role: user.role as MockSession["role"],
    branchIds: user.branches.map((b) => b.branchId),
    hubIds: user.hubs.map((h) => h.hubId),
    sessionVersion: 0,
  };
}

async function main() {
  const doc = await prisma.countDocument.findFirst({
    where: { status: { in: ["COUNTING", "RECOUNT_REQUESTED"] } },
    orderBy: { updatedAt: "desc" },
  });
  assert.ok(doc, "need a COUNTING document for concurrency test");
  assert.ok(doc.currentVersionId, "document needs currentVersionId");

  const line = await prisma.productLine.findFirst({
    where: { documentId: doc.id },
    orderBy: { lineNo: "asc" },
  });
  assert.ok(line, "need a product line");

  const users = await prisma.user.findMany({
    where: { role: { in: ["STAFF", "SUPERVISOR", "ADMIN"] }, isActive: true },
    include: { branches: true, hubs: true },
    take: 1,
  });
  assert.ok(users.length >= 1, "need a counting user");
  const saver = toSession(users[0]!);

  await prisma.countLineLock.deleteMany({
    where: { documentId: doc.id, lineId: line.lineId },
  });

  const qty = (base: number) => ({
    qtyCase: line.allowCase ? base : null,
    qtyPack: line.allowPack ? base : null,
    qtyPiece: line.allowPiece ? base : null,
  });

  // Baseline: ensure a row exists and capture its revision R.
  const baseline = await saveEntry(saver, doc.id, doc.currentVersionId, line.lineId, {
    ...qty(1),
    baseRevision: (
      await prisma.countEntry.findUnique({ where: { lineId: line.lineId } })
    )?.revision,
  });
  assert.ok(
    "status" in baseline && baseline.status === "SAVED",
    "baseline save should succeed",
  );

  const baseRevision = (await prisma.countEntry.findUnique({
    where: { lineId: line.lineId },
  }))!.revision;

  // Fire two concurrent saves that both start from the same baseRevision.
  const [a, b] = await Promise.all([
    saveEntry(saver, doc.id, doc.currentVersionId, line.lineId, {
      ...qty(2),
      baseRevision,
    }),
    saveEntry(saver, doc.id, doc.currentVersionId, line.lineId, {
      ...qty(3),
      baseRevision,
    }),
  ]);

  const results = [a, b];
  const saved = results.filter((r) => "status" in r && r.status === "SAVED");
  const conflicts = results.filter(
    (r) => "error" in r && r.error === "CONFLICT",
  );

  assert.equal(saved.length, 1, "exactly one concurrent save must win");
  assert.equal(conflicts.length, 1, "the other concurrent save must CONFLICT");

  const finalRevision = (await prisma.countEntry.findUnique({
    where: { lineId: line.lineId },
  }))!.revision;
  assert.equal(
    finalRevision,
    baseRevision + 1,
    "revision must advance by exactly one (no lost update)",
  );

  await releaseLineLock(saver, doc.id, line.lineId);
  console.log("count-entry.concurrency.test: OK");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
