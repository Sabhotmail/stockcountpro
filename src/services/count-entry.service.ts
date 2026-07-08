import { getMockDb } from "@/mock/mock-db";
import { canAccessBranch } from "@/lib/permissions";
import {
  calculateTotalBaseQty,
  isEntryCounted,
  validateQuantities,
} from "@/lib/unit-converter";
import { logAutoSave } from "@/services/audit-log.service";
import { countCountedLines } from "@/services/count-document.service";
import {
  DocumentStatus,
  VersionStatus,
  type CountEntry,
  type SaveEntryPayload,
  type SaveEntryResponse,
} from "@/types/count";
import type { MockSession } from "@/types/user";

function countLinesForDocument(documentId: string, versionId: string): number {
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

export function saveEntry(
  session: MockSession,
  documentId: string,
  versionId: string,
  lineId: string,
  payload: SaveEntryPayload,
): SaveEntryResponse | { error: string } {
  const db = getMockDb();
  const doc = db.documents.find((d) => d.id === documentId);
  if (!doc) return { error: "Document not found" };

  if (!canAccessBranch(session.role, session.branchIds, doc.branchId)) {
    return { error: "Access denied" };
  }

  if (doc.status === DocumentStatus.COMPLETED) {
    return { error: "Document is completed" };
  }

  const version = db.versions.find((v) => v.id === versionId);
  if (!version || version.documentId !== documentId) {
    return { error: "Version not found" };
  }

  if (version.status !== VersionStatus.DRAFT) {
    return { error: "Version is not editable" };
  }

  const line = db.productLines[documentId]?.find((l) => l.lineId === lineId);
  if (!line) return { error: "Line not found" };

  const validationError = validateQuantities(
    line,
    payload.qtyCase,
    payload.qtyPack,
    payload.qtyPiece,
  );
  if (validationError) return { error: validationError };

  const existing = db.entries.find((e) => e.lineId === lineId);
  const qtyCase =
    payload.qtyCase !== undefined ? payload.qtyCase : (existing?.qtyCase ?? null);
  const qtyPack =
    payload.qtyPack !== undefined ? payload.qtyPack : (existing?.qtyPack ?? null);
  const qtyPiece =
    payload.qtyPiece !== undefined
      ? payload.qtyPiece
      : (existing?.qtyPiece ?? null);

  const totalBaseQty = calculateTotalBaseQty(line, qtyCase, qtyPack, qtyPiece);
  const now = new Date().toISOString();

  const entry: CountEntry = {
    lineId,
    qtyCase,
    qtyPack,
    qtyPiece,
    totalBaseQty,
    note: null,
    revision: (existing?.revision ?? 0) + 1,
    updatedAt: now,
    updatedBy: session.userId,
  };

  if (existing) {
    Object.assign(existing, entry);
  } else {
    db.entries.push(entry);
  }

  doc.countedLines = countLinesForDocument(documentId, versionId);
  doc.updatedAt = now;

  logAutoSave(
    session.userId,
    session.userName,
    doc.branchId,
    documentId,
    versionId,
    lineId,
  );

  // TODO: Add clientMutationId idempotency for production
  return { status: "SAVED", entry };
}
