import { getMockDb } from "@/mock/mock-db";
import type { CountEntry } from "@/types/count";

function clone<T>(value: T): T {
  return structuredClone(value);
}

export function snapshotDocumentEntries(
  documentId: string,
  versionId: string,
): CountEntry[] {
  const db = getMockDb();
  const lines = db.productLines[documentId] ?? [];
  const lineIds = new Set(lines.map((line) => line.lineId));
  const snapshot = db.entries
    .filter((entry) => lineIds.has(entry.lineId))
    .map((entry) => clone(entry));

  db.entrySnapshots[versionId] = snapshot;
  return snapshot;
}

export function getEntriesForVersion(
  documentId: string,
  versionId: string,
): CountEntry[] {
  const db = getMockDb();
  const doc = db.documents.find((item) => item.id === documentId);

  if (db.entrySnapshots[versionId]) {
    return clone(db.entrySnapshots[versionId]);
  }

  if (doc?.currentVersionId === versionId) {
    const lines = db.productLines[documentId] ?? [];
    const lineIds = new Set(lines.map((line) => line.lineId));
    return clone(db.entries.filter((entry) => lineIds.has(entry.lineId)));
  }

  return [];
}
