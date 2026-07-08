import { getMockDb } from "@/mock/mock-db";
import type { CountEntry, CountVersion } from "@/types/count";

function clone<T>(value: T): T {
  return structuredClone(value);
}

function getVersionChain(
  versions: CountVersion[],
  targetVersionId: string,
): CountVersion[] {
  const byId = new Map(versions.map((version) => [version.id, version]));
  const chain: CountVersion[] = [];
  let current = byId.get(targetVersionId);

  while (current) {
    chain.unshift(current);
    current = current.baseVersionId
      ? byId.get(current.baseVersionId)
      : undefined;
  }

  return chain;
}

function getRawEntriesForVersion(
  documentId: string,
  versionId: string,
): CountEntry[] {
  const db = getMockDb();
  const doc = db.documents.find((item) => item.id === documentId);
  const lines = db.productLines[documentId] ?? [];
  const lineIds = new Set(lines.map((line) => line.lineId));

  if (db.entrySnapshots[versionId]) {
    return clone(db.entrySnapshots[versionId]);
  }

  if (doc?.currentVersionId === versionId) {
    return clone(db.entries.filter((entry) => lineIds.has(entry.lineId)));
  }

  return [];
}

export function resolveEffectiveEntries(
  documentId: string,
  versionId: string,
): CountEntry[] {
  const db = getMockDb();
  const versions = db.versions
    .filter((version) => version.documentId === documentId)
    .sort((a, b) => a.versionNo - b.versionNo);

  const chain = getVersionChain(versions, versionId);
  if (chain.length === 0) return [];

  const effective = new Map<string, CountEntry>();

  for (const version of chain) {
    const entries = getRawEntriesForVersion(documentId, version.id);
    for (const entry of entries) {
      effective.set(entry.lineId, clone(entry));
    }
  }

  return Array.from(effective.values());
}

export function snapshotDocumentEntries(
  documentId: string,
  versionId: string,
): CountEntry[] {
  const snapshot = resolveEffectiveEntries(documentId, versionId);
  const db = getMockDb();
  db.entrySnapshots[versionId] = snapshot;
  return clone(snapshot);
}

export function snapshotFinalCountEntries(
  documentId: string,
  versionId: string,
): CountEntry[] {
  const db = getMockDb();
  const snapshot = snapshotDocumentEntries(documentId, versionId);
  db.finalCountEntries[documentId] = clone(snapshot);
  return snapshot;
}

export function getEntriesForVersion(
  documentId: string,
  versionId: string,
): CountEntry[] {
  return resolveEffectiveEntries(documentId, versionId);
}

export function getFinalCountEntries(documentId: string): CountEntry[] {
  const db = getMockDb();
  if (db.finalCountEntries[documentId]) {
    return clone(db.finalCountEntries[documentId]);
  }
  return [];
}
