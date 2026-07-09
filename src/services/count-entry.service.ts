import { mapCountEntry } from "@/lib/db/mappers";
import { getDocumentForSession } from "@/lib/document-access";
import { canMutateCount } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  calculateTotalBaseQty,
  convertPieceOverflowToCase,
  isEntryCounted,
  validateQuantities,
} from "@/lib/unit-converter";
import { countCountedLines } from "@/services/count-document.service";
import {
  acquireOrRenewLineLock,
  assertCallerHoldsActiveLock,
} from "@/services/count-line-lock.service";
import { logAutoSave } from "@/services/audit-log.service";
import { getUserById } from "@/services/user.service";
import {
  DocumentStatus,
  VersionStatus,
  type BatchSaveEntryItem,
  type BatchSaveEntryResponse,
  type CountEntry,
  type SaveEntryErrorResponse,
  type SaveEntryPayload,
  type SaveEntryResponse,
} from "@/types/count";
import type { MockSession } from "@/types/user";

async function enrichEntryWithUserName(
  entry: NonNullable<
    Awaited<ReturnType<typeof prisma.countEntry.findUnique>>
  >,
): Promise<CountEntry> {
  const mapped = mapCountEntry(entry);
  const user = await getUserById(entry.updatedBy);
  return { ...mapped, updatedByName: user?.name ?? entry.updatedBy };
}

async function applyEntrySave(
  session: MockSession,
  documentId: string,
  versionId: string,
  lineId: string,
  payload: SaveEntryPayload,
): Promise<SaveEntryResponse | SaveEntryErrorResponse | { error: string }> {
  const access = await getDocumentForSession(session, documentId);
  if (!access.ok) return { error: access.error };

  const doc = access.document;
  if (doc.status === DocumentStatus.COMPLETED) {
    return { error: "Document is completed" };
  }

  const version = await prisma.countVersion.findUnique({ where: { id: versionId } });
  if (!version || version.documentId !== documentId) {
    return { error: "Version not found" };
  }

  if (version.status !== VersionStatus.DRAFT) {
    return { error: "Version is not editable" };
  }

  const line = await prisma.productLine.findFirst({
    where: { documentId, lineId },
  });
  if (!line) return { error: "Line not found" };

  const lockCheck = await assertCallerHoldsActiveLock(
    session,
    documentId,
    lineId,
  );
  if ("error" in lockCheck) {
    return lockCheck;
  }

  const validationError = validateQuantities(
    {
      allowCase: line.allowCase,
      allowPack: line.allowPack,
      allowPiece: line.allowPiece,
    },
    payload.qtyCase,
    payload.qtyPack,
    payload.qtyPiece,
  );
  if (validationError) return { error: validationError };

  const existing = await prisma.countEntry.findUnique({ where: { lineId } });

  if (existing) {
    if (
      payload.baseRevision === undefined ||
      existing.revision !== payload.baseRevision
    ) {
      const entry = await enrichEntryWithUserName(existing);
      const name = entry.updatedByName ?? existing.updatedBy;
      return {
        error: "CONFLICT",
        message: `รายการนี้ถูกแก้ไขโดย ${name} แล้ว`,
        entry,
      };
    }
  }

  let qtyCase =
    payload.qtyCase !== undefined ? payload.qtyCase : (existing?.qtyCase ?? null);
  const qtyPack =
    payload.qtyPack !== undefined ? payload.qtyPack : (existing?.qtyPack ?? null);
  let qtyPiece =
    payload.qtyPiece !== undefined
      ? payload.qtyPiece
      : (existing?.qtyPiece ?? null);

  const converted = convertPieceOverflowToCase(
    { allowCase: line.allowCase, caseRatio: line.caseRatio },
    qtyCase,
    qtyPiece,
  );
  qtyCase = converted.qtyCase;
  qtyPiece = converted.qtyPiece;

  const totalBaseQty = calculateTotalBaseQty(
    { caseRatio: line.caseRatio, packRatio: line.packRatio },
    qtyCase,
    qtyPack,
    qtyPiece,
  );
  const now = new Date();

  const saved = await prisma.countEntry.upsert({
    where: { lineId },
    create: {
      lineId,
      qtyCase,
      qtyPack,
      qtyPiece,
      totalBaseQty,
      note: null,
      revision: 1,
      updatedAt: now,
      updatedBy: session.userId,
    },
    update: {
      qtyCase,
      qtyPack,
      qtyPiece,
      totalBaseQty,
      note: null,
      revision: (existing?.revision ?? 0) + 1,
      updatedAt: now,
      updatedBy: session.userId,
    },
  });

  const countedLines = await countCountedLines(documentId, versionId);
  await prisma.countDocument.update({
    where: { id: documentId },
    data: {
      countedLines,
      updatedAt: now,
    },
  });

  await logAutoSave(
    session.userId,
    session.userName,
    doc.branchId,
    documentId,
    versionId,
    lineId,
  );

  await acquireOrRenewLineLock(session, documentId, lineId);

  const entry = await enrichEntryWithUserName(saved);
  return { status: "SAVED", entry };
}

export async function saveEntry(
  session: MockSession,
  documentId: string,
  versionId: string,
  lineId: string,
  payload: SaveEntryPayload,
): Promise<SaveEntryResponse | SaveEntryErrorResponse | { error: string }> {
  if (!canMutateCount(session.role)) {
    return { error: "Access denied" };
  }

  return applyEntrySave(session, documentId, versionId, lineId, payload);
}

export async function saveEntriesBatch(
  session: MockSession,
  documentId: string,
  versionId: string,
  items: BatchSaveEntryItem[],
): Promise<
  BatchSaveEntryResponse | SaveEntryErrorResponse | { error: string }
> {
  if (!canMutateCount(session.role)) {
    return { error: "Access denied" };
  }

  if (!items.length) {
    return { error: "At least one entry is required" };
  }

  const savedEntries: CountEntry[] = [];

  for (const item of items) {
    const { lineId, ...payload } = item;
    const result = await applyEntrySave(
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
