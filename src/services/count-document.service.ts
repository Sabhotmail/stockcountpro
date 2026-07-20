import {
  mapBranch,
  mapCountDocument,
  mapCountEntry,
  mapCountVersion,
  mapHub,
  mapProductLine,
} from "@/lib/db/mappers";
import { getDocumentForSession } from "@/lib/document-access";
import { snapshotDocumentEntries } from "@/lib/entry-snapshot";
import {
  canAccessDocument,
  canDeleteImportedDocument,
  canMutateCount,
  filterDocumentsForStaff,
} from "@/lib/permissions";
import { filterLinesForRole } from "@/lib/product-line-filter";
import { prisma } from "@/lib/prisma";
import { repairOffByOneDocumentDates } from "@/lib/repair-document-dates";
import { isEntryCounted } from "@/lib/unit-converter";
import { logDeleteDocument, logStartCount, logSubmit } from "@/services/audit-log.service";
import { listActiveLocks } from "@/services/count-line-lock.service";
import { getUserById } from "@/services/user.service";
import {
  DocumentStatus,
  VersionStatus,
  type CountDocument,
  type CountDocumentDetail,
  type CountDocumentListItem,
  type CountEntry,
  type CountSummary,
  type CountSummaryLine,
} from "@/types/count";
import type { Branch, Hub, MockSession } from "@/types/user";
import { UserRole } from "@/types/user";
import { Prisma } from "@prisma/client";

async function getBranch(branchId: string) {
  const branch = await prisma.branch.findUnique({
    where: { id: branchId },
  });
  return branch ? mapBranch(branch) : null;
}

async function getHub(hubId: string | null): Promise<Hub | null> {
  if (!hubId) return null;
  const hub = await prisma.hub.findUnique({ where: { id: hubId } });
  return hub ? mapHub(hub) : null;
}

async function enrichDocument(doc: CountDocument): Promise<CountDocumentListItem> {
  const branch = await getBranch(doc.branchId);
  const hub = await getHub(doc.hubId);
  return {
    ...doc,
    branchCode: branch?.code ?? "",
    branchName: branch?.name ?? "",
    branchExpressLocationPrefix: branch?.expressLocationPrefix ?? null,
    hubCode: hub?.code ?? null,
    hubName: hub?.name ?? null,
    hubShortName: hub?.shortName ?? null,
  };
}

export async function countCountedLines(
  documentId: string,
  _versionId: string | null,
  db: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<number> {
  const lines = await db.productLine.findMany({
    where: { documentId },
    include: { entry: true },
  });

  return lines.filter((line) => {
    const entry = line.entry;
    if (!entry) return false;
    return isEntryCounted(entry.qtyCase, entry.qtyPack, entry.qtyPiece);
  }).length;
}

export async function listDocumentsForUser(
  session: MockSession,
): Promise<CountDocumentListItem[]> {
  await repairOffByOneDocumentDates();

  const documents = await prisma.countDocument.findMany({
    orderBy: { documentDate: "desc" },
  });

  const filtered = documents
    .map(mapCountDocument)
    .filter((doc) => {
      if (
        !canAccessDocument(
          session.role,
          session.branchIds,
          session.hubIds,
          doc,
        )
      ) {
        return false;
      }

      if (session.role === UserRole.ADMIN) return true;

      if (
        session.role === UserRole.STAFF ||
        session.role === UserRole.COUNTER
      ) {
        return filterDocumentsForStaff(doc.status);
      }

      if (
        session.role === UserRole.SUPERVISOR ||
        session.role === UserRole.BRANCH_MANAGER
      ) {
        return filterDocumentsForStaff(doc.status);
      }

      return true;
    });

  const result: CountDocumentListItem[] = [];
  for (const doc of filtered) {
    const enriched = await enrichDocument(doc);
    enriched.countedLines = await countCountedLines(doc.id, doc.currentVersionId);
    result.push(enriched);
  }

  return result;
}

export async function getDocumentDetail(
  session: MockSession,
  documentId: string,
): Promise<CountDocumentDetail | null> {
  const access = await getDocumentForSession(session, documentId);
  if (!access.ok) return null;

  const doc = access.document;
  const branch = await getBranch(doc.branchId);
  const hub = await getHub(doc.hubId);
  const versionRow = doc.currentVersionId
    ? await prisma.countVersion.findUnique({ where: { id: doc.currentVersionId } })
    : null;

  const lines = filterLinesForRole(
    (
      await prisma.productLine.findMany({
        where: { documentId },
        orderBy: { lineNo: "asc" },
      })
    ).map(mapProductLine),
    session.role,
  );

  const lineIds = lines.map((line) => line.lineId);
  const entries = (
    await prisma.countEntry.findMany({
      where: { lineId: { in: lineIds } },
    })
  ).map(mapCountEntry);

  const userIds = [...new Set(entries.map((e) => e.updatedBy))];
  const users = await Promise.all(userIds.map((id) => getUserById(id)));
  const nameById = new Map(users.filter(Boolean).map((u) => [u!.id, u!.name]));

  const enrichedEntries = entries.map((entry) => ({
    ...entry,
    updatedByName: nameById.get(entry.updatedBy) ?? entry.updatedBy,
  }));

  return {
    ...doc,
    branchCode: branch?.code ?? "",
    branchName: branch?.name ?? "",
    branchExpressLocationPrefix: branch?.expressLocationPrefix ?? null,
    hubCode: hub?.code ?? null,
    hubName: hub?.name ?? null,
    hubShortName: hub?.shortName ?? null,
    version: versionRow ? mapCountVersion(versionRow) : null,
    lines,
    entries: enrichedEntries,
    countedLines: await countCountedLines(documentId, doc.currentVersionId),
  };
}

export async function getDocumentDetailWithLocks(
  session: MockSession,
  documentId: string,
) {
  const document = await getDocumentDetail(session, documentId);
  if (!document) return null;
  const locks = await listActiveLocks(documentId);
  return { document, locks };
}

export async function startCount(
  session: MockSession,
  documentId: string,
): Promise<CountDocumentDetail | { error: string }> {
  if (!canMutateCount(session.role)) {
    return { error: "Access denied" };
  }

  const access = await getDocumentForSession(session, documentId);
  if (!access.ok) return { error: access.error };

  const doc = access.document;
  if (
    doc.status === DocumentStatus.COMPLETED ||
    doc.status === DocumentStatus.SUBMITTED
  ) {
    return { error: "Document cannot be started" };
  }

  if (doc.status === DocumentStatus.RECOUNT_REQUESTED && doc.currentVersionId) {
    await prisma.countDocument.update({
      where: { id: documentId },
      data: {
        status: DocumentStatus.COUNTING,
        updatedAt: new Date(),
      },
    });

    await logStartCount(
      session.userId,
      session.userName,
      doc.branchId,
      documentId,
      doc.currentVersionId,
      `เริ่มนับ · V${doc.currentVersionNo}`,
    );

    const detail = await getDocumentDetail(session, documentId);
    return detail ?? { error: "Document not found" };
  }

  if (doc.currentVersionId) {
    const detail = await getDocumentDetail(session, documentId);
    return detail ?? { error: "Document not found" };
  }

  const versionId = `ver_${documentId}_v1`;
  const now = new Date();

  await prisma.$transaction([
    prisma.countVersion.create({
      data: {
        id: versionId,
        documentId,
        versionNo: 1,
        status: VersionStatus.DRAFT,
        createdAt: now,
        createdBy: session.userId,
      },
    }),
    prisma.countDocument.update({
      where: { id: documentId },
      data: {
        status: DocumentStatus.COUNTING,
        currentVersionId: versionId,
        currentVersionNo: 1,
        updatedAt: now,
      },
    }),
  ]);

  await logStartCount(
    session.userId,
    session.userName,
    doc.branchId,
    documentId,
    versionId,
    "เริ่มนับ · V1",
  );

  const detail = await getDocumentDetail(session, documentId);
  return detail ?? { error: "Document not found" };
}

export async function submitVersion(
  session: MockSession,
  documentId: string,
  versionId: string,
): Promise<{ success: true } | { error: string }> {
  if (!canMutateCount(session.role)) {
    return { error: "Access denied" };
  }

  const access = await getDocumentForSession(session, documentId);
  if (!access.ok) return { error: access.error };

  const doc = access.document;
  const version = await prisma.countVersion.findUnique({ where: { id: versionId } });
  if (!version || version.documentId !== documentId) {
    return { error: "Version not found" };
  }

  if (version.status !== VersionStatus.DRAFT) {
    return { error: "Version is not editable" };
  }

  const now = new Date();

  let countedLines: number;
  try {
    countedLines = await prisma.$transaction(async (tx) => {
      // Flip the version only if it is still DRAFT. A concurrent submit/approve
      // leaves count === 0, so we abort instead of double-submitting.
      const flipped = await tx.countVersion.updateMany({
        where: {
          id: versionId,
          documentId,
          status: VersionStatus.DRAFT,
        },
        data: {
          status: VersionStatus.SUBMITTED,
          submittedAt: now,
          submittedBy: session.userId,
        },
      });
      if (flipped.count === 0) {
        throw new Error("NOT_DRAFT");
      }

      const counted = await countCountedLines(documentId, versionId, tx);
      await tx.countDocument.update({
        where: { id: documentId },
        data: {
          status: DocumentStatus.SUBMITTED,
          countedLines: counted,
          updatedAt: now,
        },
      });

      // Snapshot inside the same transaction so no save can interleave between
      // sealing the version and capturing its entries.
      await snapshotDocumentEntries(documentId, versionId, tx);

      return counted;
    });
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_DRAFT") {
      return { error: "Version is not editable" };
    }
    throw error;
  }

  await logSubmit(
    session.userId,
    session.userName,
    doc.branchId,
    documentId,
    versionId,
    `ส่ง V${version.versionNo} · นับแล้ว ${countedLines}/${doc.totalLines}`,
  );

  return { success: true };
}

export async function saveDocumentNote(
  session: MockSession,
  documentId: string,
  note: string | null,
): Promise<{ success: true; note: string | null } | { error: string }> {
  if (!canMutateCount(session.role)) {
    return { error: "Access denied" };
  }

  const access = await getDocumentForSession(session, documentId);
  if (!access.ok) return { error: access.error };

  const doc = access.document;
  if (doc.status === DocumentStatus.COMPLETED) {
    return { error: "Document is completed" };
  }

  const normalizedNote = note?.trim() ? note.trim() : null;
  await prisma.countDocument.update({
    where: { id: documentId },
    data: {
      note: normalizedNote,
      updatedAt: new Date(),
    },
  });

  return { success: true, note: normalizedNote };
}

export type SubmitReadiness =
  | {
      ok: true;
      countedLines: number;
      totalLines: number;
      versionStatus: string;
      versionId: string;
    }
  | {
      ok: false;
      reasons: string[];
      countedLines: number;
      totalLines: number;
      versionStatus: string | null;
    };

export async function getSubmitReadiness(
  session: MockSession,
  documentId: string,
): Promise<SubmitReadiness | { error: string; status: 403 | 404 }> {
  const access = await getDocumentForSession(session, documentId);
  if (!access.ok) {
    return { error: access.error, status: access.status };
  }

  const doc = access.document;
  const countedLines = doc.countedLines;
  const totalLines = doc.totalLines;
  const reasons: string[] = [];

  let versionStatus: string | null = null;

  if (!doc.currentVersionId) {
    reasons.push("เวอร์ชันไม่พร้อมส่ง");
  } else {
    const version = await prisma.countVersion.findUnique({
      where: { id: doc.currentVersionId },
    });
    versionStatus = version?.status ?? null;
    if (!version || version.status !== VersionStatus.DRAFT) {
      reasons.push("เวอร์ชันไม่พร้อมส่ง");
    }
  }

  if (
    doc.status !== DocumentStatus.COUNTING &&
    doc.status !== DocumentStatus.RECOUNT_REQUESTED
  ) {
    reasons.push("เอกสารไม่ได้อยู่สถานะนับ");
  }

  if (reasons.length > 0) {
    return {
      ok: false,
      reasons,
      countedLines,
      totalLines,
      versionStatus,
    };
  }

  return {
    ok: true,
    countedLines,
    totalLines,
    versionStatus: versionStatus!,
    versionId: doc.currentVersionId!,
  };
}

export async function getDocumentSummary(
  session: MockSession,
  documentId: string,
): Promise<CountSummary | { error: string }> {
  const detail = await getDocumentDetail(session, documentId);
  if (!detail) return { error: "Document not found" };

  const summaryLines: CountSummaryLine[] = detail.lines.map((line) => {
    const entry = detail.entries.find((item) => item.lineId === line.lineId);
    const isCounted = entry
      ? isEntryCounted(entry.qtyCase, entry.qtyPack, entry.qtyPiece)
      : false;
    const totalBaseQty = entry?.totalBaseQty ?? null;

    return {
      lineId: line.lineId,
      lineNo: line.lineNo,
      productCode: line.productCode,
      productName: line.productName,
      totalBaseQty,
      qtyCase: entry?.qtyCase ?? null,
      qtyPack: entry?.qtyPack ?? null,
      qtyPiece: entry?.qtyPiece ?? null,
      allowCase: line.allowCase,
      allowPack: line.allowPack,
      allowPiece: line.allowPiece,
      unitCaseName: line.unitCaseName ?? null,
      unitPackName: line.unitPackName ?? null,
      unitPieceName: line.unitPieceName ?? null,
      isCounted,
      isZeroCount: isCounted && totalBaseQty === 0,
    };
  });

  const countedLines = summaryLines.filter((line) => line.isCounted).length;
  const zeroCountLines = summaryLines.filter((line) => line.isZeroCount).length;

  return {
    document: detail,
    totalLines: summaryLines.length,
    countedLines,
    uncountedLines: summaryLines.length - countedLines,
    zeroCountLines,
    lines: summaryLines,
  };
}

export async function getEntriesForDocument(
  documentId: string,
  _versionId: string,
): Promise<CountEntry[]> {
  const lines = await prisma.productLine.findMany({
    where: { documentId },
    select: { lineId: true },
  });
  const lineIds = lines.map((line) => line.lineId);

  return (
    await prisma.countEntry.findMany({
      where: { lineId: { in: lineIds } },
    })
  ).map(mapCountEntry);
}

export async function deleteImportedDocument(
  session: MockSession,
  documentId: string,
): Promise<{ success: true } | { error: string; status: 403 | 404 | 400 }> {
  if (!canDeleteImportedDocument(session.role)) {
    return { error: "Access denied", status: 403 };
  }

  const access = await getDocumentForSession(session, documentId);
  if (!access.ok) {
    return {
      error: access.error,
      status: access.status,
    };
  }

  const doc = access.document;
  if (doc.status !== DocumentStatus.IMPORTED) {
    return {
      error: "ลบได้เฉพาะเอกสารที่ยังไม่เริ่มนับ",
      status: 400,
    };
  }

  return deleteCountDocumentRecord(session, doc);
}

const EXPRESS_DELETE_ALLOWED_STATUSES = new Set<DocumentStatus>([
  DocumentStatus.IMPORTED,
  DocumentStatus.COUNTING,
  DocumentStatus.RECOUNT_REQUESTED,
]);

export function isExpressDeleteAllowedStatus(status: DocumentStatus): boolean {
  return EXPRESS_DELETE_ALLOWED_STATUSES.has(status);
}

export function expressDeleteBlockedReason(
  status: DocumentStatus,
): string | null {
  if (isExpressDeleteAllowedStatus(status)) return null;
  if (
    status === DocumentStatus.SUBMITTED ||
    status === DocumentStatus.REVIEWING
  ) {
    return "เอกสารส่งให้หัวหน้างานแล้ว ไม่สามารถลบได้";
  }
  if (status === DocumentStatus.APPROVED || status === DocumentStatus.COMPLETED) {
    return "เอกสารอนุมัติหรือปิดแล้ว ไม่สามารถลบได้";
  }
  return "สถานะเอกสารไม่อนุญาตให้ลบ";
}

export async function deleteCountDocumentForExpressDelete(
  session: MockSession,
  documentId: string,
): Promise<
  | { success: true; branchId: string; detail: string }
  | { error: string; status: 403 | 404 | 400 }
> {
  const access = await getDocumentForSession(session, documentId);
  if (!access.ok) {
    return {
      error: access.error,
      status: access.status,
    };
  }

  const doc = access.document;
  const blocked = expressDeleteBlockedReason(doc.status);
  if (blocked) {
    return { error: blocked, status: 400 };
  }

  const result = await deleteCountDocumentRecord(session, doc);
  if ("error" in result) return result;
  const detail = [
    `documentNo=${doc.documentNo}`,
    doc.locationCode ? `location=${doc.locationCode}` : null,
    `status=${doc.status}`,
  ]
    .filter(Boolean)
    .join("; ");

  return { success: true, branchId: doc.branchId, detail };
}

async function deleteCountDocumentRecord(
  session: MockSession,
  doc: CountDocument,
): Promise<{ success: true } | { error: string; status: 403 | 404 | 400 }> {
  const detail = [
    `documentNo=${doc.documentNo}`,
    doc.locationCode ? `location=${doc.locationCode}` : null,
    doc.locationName ? `name=${doc.locationName}` : null,
  ]
    .filter(Boolean)
    .join("; ");

  await prisma.countDocument.delete({
    where: { id: doc.id },
  });

  try {
    await logDeleteDocument(
      session.userId,
      session.userName,
      doc.branchId,
      detail,
    );
  } catch (error) {
    console.error("Failed to write delete audit log", error);
  }

  return { success: true };
}
