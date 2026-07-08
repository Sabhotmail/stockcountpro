import { getBranchById } from "@/mock/branches";
import { getMockDb } from "@/mock/mock-db";
import { getUserById } from "@/mock/users";
import {
  canAccessBranch,
  canSupervise,
  filterDocumentsForSupervisor,
} from "@/lib/permissions";
import { isEntryCounted } from "@/lib/unit-converter";
import {
  getAuditLogsByDocument,
  logApproveVersion,
  logCompleteDocument,
  logCreateVersion,
  logOpenDocument,
  logRequestRecount,
} from "@/services/audit-log.service";
import {
  resolveEffectiveEntries,
  snapshotDocumentEntries,
  snapshotFinalCountEntries,
} from "@/lib/entry-snapshot";
import { countCountedLines } from "@/services/count-document.service";
import {
  DocumentStatus,
  VersionStatus,
  type CountDocumentDetail,
  type RecountRequestPayload,
  type ReviewDetail,
  type ReviewLineItem,
  type SupervisorDocumentListItem,
} from "@/types/count";
import type { MockSession } from "@/types/user";

let recountCounter = 1;

function enrichSupervisorDocument(
  doc: ReturnType<typeof getMockDb>["documents"][0],
): SupervisorDocumentListItem {
  const db = getMockDb();
  const branch = getBranchById(doc.branchId)!;
  const version = doc.currentVersionId
    ? db.versions.find((v) => v.id === doc.currentVersionId)
    : undefined;
  const submitter = version?.submittedBy
    ? getUserById(version.submittedBy)
    : undefined;

  return {
    ...doc,
    branchCode: branch.code,
    branchName: branch.name,
    countedLines: countCountedLines(doc.id, doc.currentVersionId),
    submittedBy: version?.submittedBy ?? null,
    submittedByName: submitter?.name ?? null,
    submittedAt: version?.submittedAt ?? null,
    hasDocumentNote: Boolean(doc.note?.trim()),
  };
}

export function listSupervisorDocuments(
  session: MockSession,
): SupervisorDocumentListItem[] | { error: string } {
  if (!canSupervise(session.role)) {
    return { error: "Access denied" };
  }

  const db = getMockDb();

  return db.documents
    .filter((doc) => {
      if (!filterDocumentsForSupervisor(doc.status)) return false;
      return canAccessBranch(session.role, session.branchIds, doc.branchId);
    })
    .map(enrichSupervisorDocument)
    .sort((a, b) => {
      const aTime = a.submittedAt ?? a.updatedAt;
      const bTime = b.submittedAt ?? b.updatedAt;
      return bTime.localeCompare(aTime);
    });
}

export function getReviewDetail(
  session: MockSession,
  documentId: string,
): ReviewDetail | { error: string } {
  if (!canSupervise(session.role)) {
    return { error: "Access denied" };
  }

  const db = getMockDb();
  const doc = db.documents.find((d) => d.id === documentId);
  if (!doc) return { error: "Document not found" };

  if (!canAccessBranch(session.role, session.branchIds, doc.branchId)) {
    return { error: "Access denied" };
  }

  if (!filterDocumentsForSupervisor(doc.status)) {
    return { error: "Document is not available for review" };
  }

  const branch = getBranchById(doc.branchId)!;
  const version = doc.currentVersionId
    ? db.versions.find((v) => v.id === doc.currentVersionId) ?? null
    : null;
  const lines = db.productLines[documentId] ?? [];
  const entries = doc.currentVersionId
    ? resolveEffectiveEntries(documentId, doc.currentVersionId)
    : [];

  logOpenDocument(session.userId, session.userName, doc.branchId, documentId);

  const reviewLines: ReviewLineItem[] = lines.map((line) => {
    const entry = entries.find((e) => e.lineId === line.lineId);
    const totalBaseQty = entry?.totalBaseQty ?? null;
    const expectedQty = line.expectedQty ?? 0;
    const isCounted = entry
      ? isEntryCounted(entry.qtyCase, entry.qtyPack, entry.qtyPiece)
      : false;

    return {
      lineId: line.lineId,
      lineNo: line.lineNo,
      productCode: line.productCode,
      productName: line.productName,
      expectedQty,
      totalBaseQty,
      difference:
        totalBaseQty !== null ? totalBaseQty - expectedQty : null,
      versionNo: version?.versionNo ?? doc.currentVersionNo,
      isCounted,
    };
  });

  const document: CountDocumentDetail = {
    ...doc,
    branchCode: branch.code,
    branchName: branch.name,
    version,
    lines,
    entries,
    countedLines: countCountedLines(documentId, doc.currentVersionId),
  };

  return {
    document,
    reviewLines,
    versions: db.versions
      .filter((v) => v.documentId === documentId)
      .sort((a, b) => a.versionNo - b.versionNo),
    auditLogs: getAuditLogsByDocument(documentId),
    recountRequests: db.recountRequests.filter(
      (r) => r.documentId === documentId,
    ),
  };
}

export function approveDocument(
  session: MockSession,
  documentId: string,
): { success: true } | { error: string } {
  if (!canSupervise(session.role)) {
    return { error: "Access denied" };
  }

  const db = getMockDb();
  const doc = db.documents.find((d) => d.id === documentId);
  if (!doc) return { error: "Document not found" };

  if (!canAccessBranch(session.role, session.branchIds, doc.branchId)) {
    return { error: "Access denied" };
  }

  if (doc.status !== DocumentStatus.SUBMITTED) {
    return { error: "Only submitted documents can be approved" };
  }

  const version = doc.currentVersionId
    ? db.versions.find((v) => v.id === doc.currentVersionId)
    : undefined;
  if (!version) return { error: "Version not found" };

  snapshotFinalCountEntries(documentId, version.id);

  const now = new Date().toISOString();
  version.status = VersionStatus.APPROVED;
  doc.status = DocumentStatus.COMPLETED;
  doc.updatedAt = now;

  logApproveVersion(
    session.userId,
    session.userName,
    doc.branchId,
    documentId,
    version.id,
  );
  logCompleteDocument(
    session.userId,
    session.userName,
    doc.branchId,
    documentId,
  );

  return { success: true };
}

export function requestRecount(
  session: MockSession,
  documentId: string,
  payload: RecountRequestPayload,
): { success: true; versionId: string; versionNo: number } | { error: string } {
  if (!canSupervise(session.role)) {
    return { error: "Access denied" };
  }

  const db = getMockDb();
  const doc = db.documents.find((d) => d.id === documentId);
  if (!doc) return { error: "Document not found" };

  if (!canAccessBranch(session.role, session.branchIds, doc.branchId)) {
    return { error: "Access denied" };
  }

  if (
    doc.status !== DocumentStatus.SUBMITTED &&
    doc.status !== DocumentStatus.REVIEWING
  ) {
    return { error: "Document cannot be sent for recount" };
  }

  if (!payload.items.length) {
    return { error: "Select at least one line for recount" };
  }

  const baseVersion = db.versions.find((v) => v.id === payload.baseVersionId);
  if (!baseVersion || baseVersion.documentId !== documentId) {
    return { error: "Base version not found" };
  }

  const lines = db.productLines[documentId] ?? [];
  for (const item of payload.items) {
    if (!lines.some((l) => l.lineId === item.lineId)) {
      return { error: `Line not found: ${item.lineId}` };
    }
    if (!item.reason.trim()) {
      return { error: "Recount reason is required for each selected line" };
    }
  }

  const now = new Date().toISOString();
  const newVersionNo = baseVersion.versionNo + 1;
  const newVersionId = `ver_${documentId}_v${newVersionNo}`;

  snapshotDocumentEntries(documentId, baseVersion.id);
  baseVersion.status = VersionStatus.LOCKED;

  db.versions.push({
    id: newVersionId,
    documentId,
    versionNo: newVersionNo,
    status: VersionStatus.DRAFT,
    baseVersionId: baseVersion.id,
    createdAt: now,
    createdBy: session.userId,
  });

  // Copy effective entries from base version into the new draft scope.
  const baseLineIds = new Set(lines.map((line) => line.lineId));
  const baseEntries = resolveEffectiveEntries(documentId, baseVersion.id).filter(
    (entry) => baseLineIds.has(entry.lineId),
  );
  for (const entry of baseEntries) {
    const existing = db.entries.find((e) => e.lineId === entry.lineId);
    if (existing) {
      Object.assign(existing, {
        ...entry,
        revision: 0,
        updatedAt: now,
        updatedBy: session.userId,
      });
    }
  }

  doc.status = DocumentStatus.RECOUNT_REQUESTED;
  doc.currentVersionId = newVersionId;
  doc.currentVersionNo = newVersionNo;
  doc.updatedAt = now;

  const recountRecord = {
    id: `recount_${String(recountCounter++).padStart(3, "0")}`,
    documentId,
    baseVersionId: baseVersion.id,
    newVersionId,
    items: payload.items,
    requestedBy: session.userId,
    requestedAt: now,
  };
  db.recountRequests.push(recountRecord);

  logRequestRecount(
    session.userId,
    session.userName,
    doc.branchId,
    documentId,
    newVersionId,
    `Recount ${payload.items.length} line(s)`,
  );
  logCreateVersion(
    session.userId,
    session.userName,
    doc.branchId,
    documentId,
    newVersionId,
    `Created version ${newVersionNo} from ${baseVersion.id}`,
  );

  return { success: true, versionId: newVersionId, versionNo: newVersionNo };
}
