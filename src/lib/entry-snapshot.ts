import { prisma } from "@/lib/prisma";
import {
  mapCountDocument,
  mapCountVersion,
  mapFinalEntry,
  mapSnapshotEntry,
} from "@/lib/db/mappers";
import type { CountEntry, CountVersion } from "@/types/count";
import type { CountDocument } from "@/types/count";

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

async function getRawEntriesForVersion(
  document: CountDocument,
  versionId: string,
): Promise<CountEntry[]> {
  const snapshots = await prisma.entrySnapshot.findMany({
    where: { versionId },
  });

  if (snapshots.length > 0) {
    return snapshots.map(mapSnapshotEntry);
  }

  if (document.currentVersionId === versionId) {
    const lines = await prisma.productLine.findMany({
      where: { documentId: document.id },
      include: { entry: true },
    });

    return lines
      .map((line) => line.entry)
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
      .map((entry) => ({
        lineId: entry.lineId,
        qtyCase: entry.qtyCase,
        qtyPack: entry.qtyPack,
        qtyPiece: entry.qtyPiece,
        totalBaseQty: entry.totalBaseQty,
        note: entry.note,
        revision: entry.revision,
        updatedAt: entry.updatedAt.toISOString(),
        updatedBy: entry.updatedBy,
      }));
  }

  return [];
}

export async function resolveEffectiveEntries(
  documentId: string,
  versionId: string,
): Promise<CountEntry[]> {
  const documentRow = await prisma.countDocument.findUnique({
    where: { id: documentId },
  });
  if (!documentRow) return [];

  const document = mapCountDocument(documentRow);
  const versions = (
    await prisma.countVersion.findMany({
      where: { documentId },
      orderBy: { versionNo: "asc" },
    })
  ).map(mapCountVersion);

  const chain = getVersionChain(versions, versionId);
  const effective = new Map<string, CountEntry>();

  for (const version of chain) {
    const entries = await getRawEntriesForVersion(document, version.id);
    for (const entry of entries) {
      effective.set(entry.lineId, entry);
    }
  }

  return Array.from(effective.values());
}

export async function snapshotDocumentEntries(
  documentId: string,
  versionId: string,
): Promise<CountEntry[]> {
  const entries = await resolveEffectiveEntries(documentId, versionId);

  await prisma.entrySnapshot.deleteMany({ where: { versionId } });
  if (entries.length > 0) {
    await prisma.entrySnapshot.createMany({
      data: entries.map((entry) => ({
        versionId,
        lineId: entry.lineId,
        qtyCase: entry.qtyCase,
        qtyPack: entry.qtyPack,
        qtyPiece: entry.qtyPiece,
        totalBaseQty: entry.totalBaseQty,
        note: entry.note,
        revision: entry.revision,
        updatedAt: new Date(entry.updatedAt),
        updatedBy: entry.updatedBy,
      })),
    });
  }

  return entries;
}

export async function snapshotFinalCountEntries(
  documentId: string,
  versionId: string,
): Promise<CountEntry[]> {
  const entries = await snapshotDocumentEntries(documentId, versionId);

  await prisma.finalCountEntry.deleteMany({ where: { documentId } });
  if (entries.length > 0) {
    await prisma.finalCountEntry.createMany({
      data: entries.map((entry) => ({
        documentId,
        lineId: entry.lineId,
        qtyCase: entry.qtyCase,
        qtyPack: entry.qtyPack,
        qtyPiece: entry.qtyPiece,
        totalBaseQty: entry.totalBaseQty,
        note: entry.note,
        revision: entry.revision,
        updatedAt: new Date(entry.updatedAt),
        updatedBy: entry.updatedBy,
      })),
    });
  }

  return entries;
}

export async function getEntriesForVersion(
  documentId: string,
  versionId: string,
): Promise<CountEntry[]> {
  return resolveEffectiveEntries(documentId, versionId);
}

export async function getFinalCountEntries(
  documentId: string,
): Promise<CountEntry[]> {
  const entries = await prisma.finalCountEntry.findMany({
    where: { documentId },
  });

  return entries.map(mapFinalEntry);
}
