import { getMockDb } from "@/mock/mock-db";
import { getDocumentForSession } from "@/lib/document-access";
import { canMutateCount } from "@/lib/permissions";
import {
  calculateTotalBaseQty,
  isEntryCounted,
  validateQuantities,
} from "@/lib/unit-converter";
import { logAutoSave } from "@/services/audit-log.service";
import {
  DocumentStatus,
  VersionStatus,
  type BatchSaveEntryItem,
  type BatchSaveEntryResponse,
  type CountEntry,
  type SaveEntryPayload,
  type SaveEntryResponse,
} from "@/types/count";
import type { MockSession } from "@/types/user";

function countLinesForDocument(documentId: string): number {
  const db = getMockDb();
  const lines = db.productLines[documentId] ?? [];
  const entries = db.entries.filter((entry) =>
    lines.some((line) => line.lineId === entry.lineId),
  );

  return lines.filter((line) => {
    const entry = entries.find((item) => item.lineId === line.lineId);
    if (!entry) return false;
    return isEntryCounted(entry.qtyCase, entry.qtyPack, entry.qtyPiece);
  }).length;
}

function applyEntrySave(
  session: MockSession,
  documentId: string,
  versionId: string,
  lineId: string,
  payload: SaveEntryPayload,
): SaveEntryResponse | { error: string } {
  const db = getMockDb();
  const access = getDocumentForSession(session, documentId);
  if (!access.ok) return { error: access.error };

  const doc = access.document;
  if (doc.status === DocumentStatus.COMPLETED) {
    return { error: "Document is completed" };
  }

  const version = db.versions.find((item) => item.id === versionId);
  if (!version || version.documentId !== documentId) {
    return { error: "Version not found" };
  }

  if (version.status !== VersionStatus.DRAFT) {
    return { error: "Version is not editable" };
  }

  const line = db.productLines[documentId]?.find((item) => item.lineId === lineId);
  if (!line) return { error: "Line not found" };

  const validationError = validateQuantities(
    line,
    payload.qtyCase,
    payload.qtyPack,
    payload.qtyPiece,
  );
  if (validationError) return { error: validationError };

  const existing = db.entries.find((entry) => entry.lineId === lineId);
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

  doc.countedLines = countLinesForDocument(documentId);
  doc.updatedAt = now;

  logAutoSave(
    session.userId,
    session.userName,
    doc.branchId,
    documentId,
    versionId,
    lineId,
  );

  return { status: "SAVED", entry };
}

export function saveEntry(
  session: MockSession,
  documentId: string,
  versionId: string,
  lineId: string,
  payload: SaveEntryPayload,
): SaveEntryResponse | { error: string } {
  if (!canMutateCount(session.role)) {
    return { error: "Access denied" };
  }

  return applyEntrySave(session, documentId, versionId, lineId, payload);
}

export function saveEntriesBatch(
  session: MockSession,
  documentId: string,
  versionId: string,
  items: BatchSaveEntryItem[],
): BatchSaveEntryResponse | { error: string } {
  if (!canMutateCount(session.role)) {
    return { error: "Access denied" };
  }

  if (!items.length) {
    return { error: "At least one entry is required" };
  }

  const savedEntries: CountEntry[] = [];

  for (const item of items) {
    const { lineId, ...payload } = item;
    const result = applyEntrySave(
      session,
      documentId,
      versionId,
      lineId,
      payload,
    );
    if ("error" in result) return result;
    savedEntries.push(result.entry);
  }

  return { status: "SAVED", entries: savedEntries };
}
