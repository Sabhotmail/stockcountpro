import { getBranchById } from "@/mock/branches";
import { getMockDb } from "@/mock/mock-db";
import {
  canAccessBranch,
  canViewExpectedQty,
  filterDocumentsForStaff,
} from "@/lib/permissions";
import { isEntryCounted } from "@/lib/unit-converter";
import {
  logOpenDocument,
  logStartCount,
  logSubmit,
} from "@/services/audit-log.service";
import { snapshotDocumentEntries } from "@/lib/entry-snapshot";
import {
  DocumentStatus,
  VersionStatus,
  type CountDocumentDetail,
  type CountDocumentListItem,
  type CountEntry,
  type CountSummary,
  type CountSummaryLine,
  type ProductLine,
} from "@/types/count";
import type { MockSession } from "@/types/user";
import { UserRole } from "@/types/user";

function enrichDocument(doc: ReturnType<typeof getMockDb>["documents"][0]): CountDocumentListItem {
  const branch = getBranchById(doc.branchId)!;
  return {
    ...doc,
    branchCode: branch.code,
    branchName: branch.name,
  };
}

export function countCountedLines(documentId: string, versionId: string | null): number {
  if (!versionId) return 0;
  const db = getMockDb();
  const lines = db.productLines[documentId] ?? [];
  const entries = db.entries.filter((e) =>
    lines.some((l) => l.lineId === e.lineId),
  );

  return lines.filter((line) => {
    const entry = entries.find((e) => e.lineId === line.lineId);
    if (!entry) return false;
    return isEntryCounted(entry.qtyCase, entry.qtyPack, entry.qtyPiece);
  }).length;
}

function stripExpectedQty(lines: ProductLine[]): ProductLine[] {
  return lines.map(({ expectedQty: _expectedQty, ...rest }) => rest);
}

function filterLinesForRole(
  lines: ProductLine[],
  role: MockSession["role"],
): ProductLine[] {
  if (canViewExpectedQty(role)) return lines;
  // STAFF should not see expectedQty - set to 0 as placeholder
  // TODO: Ensure STAFF never receives expectedQty from API at all in production
  return stripExpectedQty(lines);
}

export function listDocumentsForUser(session: MockSession): CountDocumentListItem[] {
  const db = getMockDb();

  return db.documents
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
    })
    .map((doc) => {
      const enriched = enrichDocument(doc);
      enriched.countedLines = countCountedLines(doc.id, doc.currentVersionId);
      return enriched;
    })
    .sort((a, b) => b.documentDate.localeCompare(a.documentDate));
}

export function getDocumentDetail(
  session: MockSession,
  documentId: string,
): CountDocumentDetail | null {
  const db = getMockDb();
  const doc = db.documents.find((d) => d.id === documentId);
  if (!doc) return null;

  if (!canAccessBranch(session.role, session.branchIds, doc.branchId)) {
    return null;
  }

  const branch = getBranchById(doc.branchId)!;
  const version = doc.currentVersionId
    ? db.versions.find((v) => v.id === doc.currentVersionId) ?? null
    : null;

  const lines = filterLinesForRole(
    db.productLines[documentId] ?? [],
    session.role,
  );

  const lineIds = new Set(lines.map((l) => l.lineId));
  const entries = db.entries.filter((e) => lineIds.has(e.lineId));

  logOpenDocument(session.userId, session.userName, doc.branchId, documentId);

  return {
    ...doc,
    branchCode: branch.code,
    branchName: branch.name,
    version,
    lines,
    entries,
    countedLines: countCountedLines(documentId, doc.currentVersionId),
  };
}

export function startCount(
  session: MockSession,
  documentId: string,
): CountDocumentDetail | { error: string } {
  const db = getMockDb();
  const doc = db.documents.find((d) => d.id === documentId);
  if (!doc) return { error: "Document not found" };

  if (!canAccessBranch(session.role, session.branchIds, doc.branchId)) {
    return { error: "Access denied" };
  }

  if (
    doc.status === DocumentStatus.COMPLETED ||
    doc.status === DocumentStatus.SUBMITTED
  ) {
    return { error: "Document cannot be started" };
  }

  if (doc.status === DocumentStatus.RECOUNT_REQUESTED && doc.currentVersionId) {
    const detail = getDocumentDetail(session, documentId);
    return detail ?? { error: "Document not found" };
  }

  if (doc.currentVersionId) {
    const detail = getDocumentDetail(session, documentId);
    return detail ?? { error: "Document not found" };
  }

  const versionId = `ver_${documentId}_v1`;
  const now = new Date().toISOString();

  db.versions.push({
    id: versionId,
    documentId,
    versionNo: 1,
    status: VersionStatus.DRAFT,
    createdAt: now,
    createdBy: session.userId,
  });

  doc.status = DocumentStatus.COUNTING;
  doc.currentVersionId = versionId;
  doc.currentVersionNo = 1;
  doc.updatedAt = now;

  logStartCount(
    session.userId,
    session.userName,
    doc.branchId,
    documentId,
    versionId,
  );

  const detail = getDocumentDetail(session, documentId);
  return detail ?? { error: "Document not found" };
}

export function submitVersion(
  session: MockSession,
  documentId: string,
  versionId: string,
): { success: true } | { error: string } {
  const db = getMockDb();
  const doc = db.documents.find((d) => d.id === documentId);
  if (!doc) return { error: "Document not found" };

  if (!canAccessBranch(session.role, session.branchIds, doc.branchId)) {
    return { error: "Access denied" };
  }

  const version = db.versions.find((v) => v.id === versionId);
  if (!version || version.documentId !== documentId) {
    return { error: "Version not found" };
  }

  if (version.status !== VersionStatus.DRAFT) {
    return { error: "Version is not editable" };
  }

  // TODO: Block submit if pending offline sync exists
  const now = new Date().toISOString();
  version.status = VersionStatus.SUBMITTED;
  version.submittedAt = now;
  version.submittedBy = session.userId;
  doc.status = DocumentStatus.SUBMITTED;
  doc.updatedAt = now;
  doc.countedLines = countCountedLines(documentId, versionId);

  snapshotDocumentEntries(documentId, versionId);

  logSubmit(
    session.userId,
    session.userName,
    doc.branchId,
    documentId,
    versionId,
  );

  return { success: true };
}

export function saveDocumentNote(
  session: MockSession,
  documentId: string,
  note: string | null,
): { success: true; note: string | null } | { error: string } {
  const db = getMockDb();
  const doc = db.documents.find((d) => d.id === documentId);
  if (!doc) return { error: "Document not found" };

  if (!canAccessBranch(session.role, session.branchIds, doc.branchId)) {
    return { error: "Access denied" };
  }

  if (doc.status === DocumentStatus.COMPLETED) {
    return { error: "Document is completed" };
  }

  doc.note = note?.trim() ? note.trim() : null;
  doc.updatedAt = new Date().toISOString();

  return { success: true, note: doc.note };
}

export function getDocumentSummary(
  session: MockSession,
  documentId: string,
): CountSummary | { error: string } {
  const detail = getDocumentDetail(session, documentId);
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

export function getEntriesForDocument(
  documentId: string,
  versionId: string,
): CountEntry[] {
  const db = getMockDb();
  const lines = db.productLines[documentId] ?? [];
  const lineIds = new Set(lines.map((l) => l.lineId));
  return db.entries.filter((e) => lineIds.has(e.lineId));
}
