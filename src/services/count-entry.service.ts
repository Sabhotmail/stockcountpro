import { mapCountEntry } from "@/lib/db/mappers";
import { getDocumentForSession } from "@/lib/document-access";
import { canMutateCount } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  findProcessedMutation,
  replayIfPresent,
  storeProcessedMutation,
} from "@/lib/processed-mutation";
import {
  calculateTotalBaseQty,
  convertPieceOverflowToCase,
  isEntryCounted,
  validateQuantities,
} from "@/lib/unit-converter";
import { acquireOrRenewLineLock } from "@/services/count-line-lock.service";
import { logAutoSave } from "@/services/audit-log.service";
import { buildAutoSaveDetail } from "@/lib/audit-log-detail";
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
import { Prisma } from "@prisma/client";

async function enrichEntryWithUserName(
  entry: NonNullable<
    Awaited<ReturnType<typeof prisma.countEntry.findUnique>>
  >,
): Promise<CountEntry> {
  const mapped = mapCountEntry(entry);
  const user = await getUserById(entry.updatedBy);
  return { ...mapped, updatedByName: user?.name ?? entry.updatedBy };
}

/**
 * Thrown inside the save transaction when the row changed underneath us
 * (revision mismatch, concurrent create, or version no longer editable).
 * Carries enough state for the caller to build the proper response.
 */
class EntrySaveConflictError extends Error {
  constructor(
    readonly reason: "CONFLICT" | "VERSION_NOT_EDITABLE",
    readonly conflictLineId?: string,
  ) {
    super(reason);
    this.name = "EntrySaveConflictError";
  }
}

async function countCountedLinesInTx(
  tx: Prisma.TransactionClient,
  documentId: string,
): Promise<number> {
  const lines = await tx.productLine.findMany({
    where: { documentId },
    include: { entry: true },
  });

  return lines.filter((line) => {
    const entry = line.entry;
    if (!entry) return false;
    return isEntryCounted(entry.qtyCase, entry.qtyPack, entry.qtyPiece);
  }).length;
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

  const mutationId = payload.clientMutationId?.trim();
  if (mutationId) {
    const existingMutation = await findProcessedMutation(
      session.userId,
      mutationId,
    );
    const replayed = replayIfPresent(existingMutation);
    if (replayed) return replayed;
  }

  const line = await prisma.productLine.findFirst({
    where: { documentId, lineId },
  });
  if (!line) return { error: "Line not found" };

  // Claim/renew for this saver. Do not require a pre-held lock: with short TTL
  // the client may expire between ensureLock and PATCH. Only block if another
  // user currently holds an active lock.
  const lockClaim = await acquireOrRenewLineLock(session, documentId, lineId);
  if ("error" in lockClaim) {
    return lockClaim;
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

  let saved: NonNullable<
    Awaited<ReturnType<typeof prisma.countEntry.findUnique>>
  >;

  try {
    saved = await prisma.$transaction(async (tx) => {
      // Re-verify the version is still editable *inside* the transaction so a
      // concurrent submit/approve cannot land an entry into a sealed version.
      const freshVersion = await tx.countVersion.findUnique({
        where: { id: versionId },
      });
      if (!freshVersion || freshVersion.status !== VersionStatus.DRAFT) {
        throw new EntrySaveConflictError("VERSION_NOT_EDITABLE");
      }

      let upserted: NonNullable<
        Awaited<ReturnType<typeof prisma.countEntry.findUnique>>
      >;

      if (existing) {
        // Guard the write on the revision we validated against. Under READ
        // COMMITTED a competing save that already bumped the revision leaves
        // count === 0 here, which we surface as a conflict (no lost update).
        const updated = await tx.countEntry.updateMany({
          where: { lineId, revision: payload.baseRevision },
          data: {
            qtyCase,
            qtyPack,
            qtyPiece,
            totalBaseQty,
            note: null,
            revision: existing.revision + 1,
            updatedAt: now,
            updatedBy: session.userId,
          },
        });
        if (updated.count === 0) {
          throw new EntrySaveConflictError("CONFLICT", lineId);
        }
        upserted = await tx.countEntry.findUniqueOrThrow({ where: { lineId } });
      } else {
        // No row yet: create atomically. A concurrent create hits the unique
        // constraint on lineId (P2002) which we translate into a conflict.
        try {
          upserted = await tx.countEntry.create({
            data: {
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
          });
        } catch (createError) {
          if (
            createError instanceof Prisma.PrismaClientKnownRequestError &&
            createError.code === "P2002"
          ) {
            throw new EntrySaveConflictError("CONFLICT", lineId);
          }
          throw createError;
        }
      }

      const countedLines = await countCountedLinesInTx(tx, documentId);
      await tx.countDocument.update({
        where: { id: documentId },
        data: {
          countedLines,
          updatedAt: now,
        },
      });

      if (mutationId) {
        const entry = await enrichEntryWithUserName(upserted);
        const saveResponse: SaveEntryResponse = { status: "SAVED", entry };
        await storeProcessedMutation(
          {
            userId: session.userId,
            clientMutationId: mutationId,
            documentId,
            lineId,
            response: saveResponse,
          },
          tx,
        );
      }

      return upserted;
    });
  } catch (error) {
    if (error instanceof EntrySaveConflictError) {
      if (error.reason === "VERSION_NOT_EDITABLE") {
        return { error: "Version is not editable" };
      }
      const latest = await prisma.countEntry.findUnique({
        where: { lineId },
      });
      if (latest) {
        const entry = await enrichEntryWithUserName(latest);
        const name = entry.updatedByName ?? latest.updatedBy;
        return {
          error: "CONFLICT",
          message: `รายการนี้ถูกแก้ไขโดย ${name} แล้ว`,
          entry,
        };
      }
      return {
        error: "CONFLICT",
        message: "รายการนี้ถูกแก้ไขโดยผู้อื่นแล้ว",
      };
    }
    if (
      mutationId &&
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const existingMutation = await findProcessedMutation(
        session.userId,
        mutationId,
      );
      const replayed = replayIfPresent(existingMutation);
      if (replayed) return replayed;
    }
    throw error;
  }

  await logAutoSave(
    session.userId,
    session.userName,
    doc.branchId,
    documentId,
    versionId,
    lineId,
    buildAutoSaveDetail(
      {
        productCode: line.productCode,
        productName: line.productName,
        allowCase: line.allowCase,
        allowPack: line.allowPack,
        allowPiece: line.allowPiece,
        unitCaseName: line.unitCaseName,
        unitPackName: line.unitPackName,
        unitPieceName: line.unitPieceName,
      },
      {
        qtyCase: saved.qtyCase,
        qtyPack: saved.qtyPack,
        qtyPiece: saved.qtyPiece,
      },
    ),
  );

  // Do not renew the line lock here — lifetime is managed by tablet
  // acquire / heartbeat / release so a finished save cannot block others.

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
