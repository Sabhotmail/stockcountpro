import {
  mapBranch,
  mapCountDocument,
  mapCountEntry,
  mapCountVersion,
  mapProductLine,
} from "@/lib/db/mappers";
import { getDocumentForSession } from "@/lib/document-access";
import { snapshotDocumentEntries } from "@/lib/entry-snapshot";
import {
  canAccessBranch,
  canMutateCount,
  filterDocumentsForStaff,
} from "@/lib/permissions";
import { filterLinesForRole } from "@/lib/product-line-filter";
import { prisma } from "@/lib/prisma";
import { isEntryCounted } from "@/lib/unit-converter";
import { logStartCount, logSubmit } from "@/services/audit-log.service";
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
import type { MockSession } from "@/types/user";
import { UserRole } from "@/types/user";

async function getBranch(branchId: string) {
  const branch = await prisma.branch.findUnique({
    where: { id: branchId },
    include: { expressLocations: { orderBy: { locationCode: "asc" } } },
  });
  return branch ? mapBranch(branch) : null;
}

async function enrichDocument(doc: CountDocument): Promise<CountDocumentListItem> {
  const branch = await getBranch(doc.branchId);
  return {
    ...doc,
    branchCode: branch?.code ?? "",
    branchName: branch?.name ?? "",
    branchExpressLocationCodes: branch?.expressLocationCodes ?? [],
  };
}

export async function countCountedLines(
  documentId: string,
  _versionId: string | null,
): Promise<number> {
  const lines = await prisma.productLine.findMany({
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
  const documents = await prisma.countDocument.findMany({
    orderBy: { documentDate: "desc" },
  });

  const filtered = documents
    .map(mapCountDocument)
    .filter((doc) => {
      if (!canAccessBranch(session.role, session.branchIds, doc.branchId)) {
        return false;
      }

      if (session.role === UserRole.ADMIN) return true;

      if (
        session.role === UserRole.STAFF ||
        session.role === UserRole.COUNTER
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
    branchExpressLocationCodes: branch?.expressLocationCodes ?? [],
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
  const countedLines = await countCountedLines(documentId, versionId);

  await prisma.$transaction([
    prisma.countVersion.update({
      where: { id: versionId },
      data: {
        status: VersionStatus.SUBMITTED,
        submittedAt: now,
        submittedBy: session.userId,
      },
    }),
    prisma.countDocument.update({
      where: { id: documentId },
      data: {
        status: DocumentStatus.SUBMITTED,
        countedLines,
        updatedAt: now,
      },
    }),
  ]);

  await snapshotDocumentEntries(documentId, versionId);
  await logSubmit(
    session.userId,
    session.userName,
    doc.branchId,
    documentId,
    versionId,
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
