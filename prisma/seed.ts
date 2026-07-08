import { PrismaClient, type AuditAction as PrismaAuditAction } from "@prisma/client";
import { hashPassword } from "../src/lib/auth/password";
import { initialAuditLogs } from "../src/mock/audit-logs";
import { mockBranches } from "../src/mock/branches";
import { initialCountDocuments } from "../src/mock/count-documents";
import { documentProductLines, initialCountEntries } from "../src/mock/count-entries";
import { initialCountVersions } from "../src/mock/count-versions";
import { initialRecountRequests } from "../src/mock/recount-requests";
import { DEFAULT_SEED_PASSWORD, mockUsers } from "../src/mock/users";
import type { CountEntry } from "../src/types/count";

const prisma = new PrismaClient();

function parseDate(value: string): Date {
  return new Date(value);
}

function entryRow(entry: CountEntry) {
  return {
    lineId: entry.lineId,
    qtyCase: entry.qtyCase,
    qtyPack: entry.qtyPack,
    qtyPiece: entry.qtyPiece,
    totalBaseQty: entry.totalBaseQty,
    note: entry.note,
    revision: entry.revision,
    updatedAt: parseDate(entry.updatedAt),
    updatedBy: entry.updatedBy,
  };
}

function snapshotRows(versionId: string, entries: CountEntry[]) {
  return entries.map((entry) => ({
    versionId,
    ...entryRow(entry),
  }));
}

async function main() {
  await prisma.recountRequestItem.deleteMany();
  await prisma.recountRequest.deleteMany();
  await prisma.finalCountEntry.deleteMany();
  await prisma.entrySnapshot.deleteMany();
  await prisma.countEntry.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.countVersion.deleteMany();
  await prisma.productLine.deleteMany();
  await prisma.countDocument.deleteMany();
  await prisma.userBranch.deleteMany();
  await prisma.user.deleteMany();
  await prisma.branch.deleteMany();

  await prisma.branch.createMany({
    data: mockBranches.map((branch) => ({
      id: branch.id,
      code: branch.code,
      name: branch.name,
      expressLocationCode: branch.expressLocationCode ?? null,
    })),
  });

  const defaultPasswordHash = await hashPassword(DEFAULT_SEED_PASSWORD);

  for (const user of mockUsers) {
    await prisma.user.create({
      data: {
        id: user.id,
        username: user.username,
        name: user.name,
        passwordHash: defaultPasswordHash,
        role: user.role,
        isActive: true,
        branches: {
          create: user.branchIds.map((branchId) => ({ branchId })),
        },
      },
    });
  }

  for (const doc of initialCountDocuments) {
    await prisma.countDocument.create({
      data: {
        id: doc.id,
        documentNo: doc.documentNo,
        documentDate: parseDate(doc.documentDate),
        branchId: doc.branchId,
        status: doc.status,
        currentVersionId: doc.currentVersionId,
        currentVersionNo: doc.currentVersionNo,
        totalLines: doc.totalLines,
        countedLines: doc.countedLines,
        note: doc.note,
        createdAt: parseDate(doc.createdAt),
        updatedAt: parseDate(doc.updatedAt),
      },
    });
  }

  for (const [documentId, lines] of Object.entries(documentProductLines)) {
    await prisma.productLine.createMany({
      data: lines.map((line) => ({
        lineId: line.lineId,
        documentId,
        lineNo: line.lineNo,
        productCode: line.productCode,
        productName: line.productName,
        productImageUrl: line.productImageUrl ?? null,
        barcode: line.barcode,
        unitCaseName: line.unitCaseName ?? null,
        unitPackName: line.unitPackName ?? null,
        unitPieceName: line.unitPieceName,
        caseRatio: line.caseRatio,
        packRatio: line.packRatio,
        allowCase: line.allowCase,
        allowPack: line.allowPack,
        allowPiece: line.allowPiece,
        expectedQty: line.expectedQty ?? null,
      })),
    });
  }

  for (const version of initialCountVersions) {
    await prisma.countVersion.create({
      data: {
        id: version.id,
        documentId: version.documentId,
        versionNo: version.versionNo,
        status: version.status,
        baseVersionId: version.baseVersionId ?? null,
        createdAt: parseDate(version.createdAt),
        createdBy: version.createdBy,
        submittedAt: version.submittedAt ? parseDate(version.submittedAt) : null,
        submittedBy: version.submittedBy ?? null,
      },
    });
  }

  const bkk1004Lines = documentProductLines.doc_bkk1_004 ?? [];
  const bkk1004LineIds = new Set(bkk1004Lines.map((line) => line.lineId));
  const seedEntries = initialCountEntries.filter(
    (entry) => !bkk1004LineIds.has(entry.lineId),
  );

  for (const entry of seedEntries) {
    await prisma.countEntry.create({ data: entryRow(entry) });
  }

  const snapshotForDocument = (documentId: string, versionId: string) => {
    const lineIds = new Set(
      (documentProductLines[documentId] ?? []).map((line) => line.lineId),
    );
    const entries = initialCountEntries.filter((entry) => lineIds.has(entry.lineId));
    return snapshotRows(versionId, entries);
  };

  await prisma.entrySnapshot.createMany({
    data: [
      ...snapshotForDocument("doc_bkk1_003", "ver_bkk1_003_v1"),
      ...snapshotForDocument("doc_chm_001", "ver_chm_001_v1"),
      ...snapshotForDocument("doc_bkk1_004", "ver_bkk1_004_v1"),
    ],
  });

  const v2Entries: CountEntry[] = [
    {
      lineId: bkk1004Lines[1].lineId,
      qtyCase: null,
      qtyPack: 1,
      qtyPiece: 8,
      totalBaseQty: 1 * bkk1004Lines[1].packRatio + 8,
      note: null,
      revision: 1,
      updatedAt: "2026-07-08T11:40:00.000Z",
      updatedBy: "user_bkk1_staff",
    },
    {
      lineId: bkk1004Lines[4].lineId,
      qtyCase: null,
      qtyPack: null,
      qtyPiece: 15,
      totalBaseQty: 15,
      note: null,
      revision: 1,
      updatedAt: "2026-07-08T11:42:00.000Z",
      updatedBy: "user_bkk1_staff",
    },
  ];

  for (const entry of v2Entries) {
    await prisma.countEntry.create({ data: entryRow(entry) });
  }

  const chmSnapshot = await prisma.entrySnapshot.findMany({
    where: { versionId: "ver_chm_001_v1" },
  });

  await prisma.finalCountEntry.createMany({
    data: chmSnapshot.map((entry) => ({
      documentId: "doc_chm_001",
      lineId: entry.lineId,
      qtyCase: entry.qtyCase,
      qtyPack: entry.qtyPack,
      qtyPiece: entry.qtyPiece,
      totalBaseQty: entry.totalBaseQty,
      note: entry.note,
      revision: entry.revision,
      updatedAt: entry.updatedAt,
      updatedBy: entry.updatedBy,
    })),
  });

  for (const request of initialRecountRequests) {
    await prisma.recountRequest.create({
      data: {
        id: request.id,
        documentId: request.documentId,
        baseVersionId: request.baseVersionId,
        newVersionId: request.newVersionId,
        requestedBy: request.requestedBy,
        requestedAt: parseDate(request.requestedAt),
        items: {
          create: request.items.map((item) => ({
            lineId: item.lineId,
            reason: item.reason,
          })),
        },
      },
    });
  }

  if (initialAuditLogs.length > 0) {
    await prisma.auditLog.createMany({
      data: initialAuditLogs.map((log) => ({
        id: log.id,
        action: log.action as PrismaAuditAction,
        userId: log.userId,
        userName: log.userName,
        branchId: log.branchId ?? null,
        documentId: log.documentId ?? null,
        versionId: log.versionId ?? null,
        lineId: log.lineId ?? null,
        detail: log.detail ?? null,
        createdAt: parseDate(log.createdAt),
      })),
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
