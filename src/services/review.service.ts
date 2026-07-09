import {
  mapBranch,
  mapCountDocument,
  mapCountEntry,
  mapCountVersion,
  mapProductLine,
  mapRecountRequest,
} from "@/lib/db/mappers";
import { getDocumentForSession } from "@/lib/document-access";
import {
  resolveEffectiveEntries,
  snapshotDocumentEntries,
  snapshotFinalCountEntries,
} from "@/lib/entry-snapshot";
import {
  canAccessBranch,
  canSupervise,
  filterDocumentsForSupervisor,
} from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { isEntryCounted } from "@/lib/unit-converter";
import {
  getAuditLogsByDocument,
  logApproveVersion,
  logCompleteDocument,
  logCreateVersion,
  logRequestRecount,
} from "@/services/audit-log.service";
import { countCountedLines } from "@/services/count-document.service";
import { getUserById } from "@/services/user.service";
import {
  DocumentStatus,
  VersionStatus,
  type CountDocument,
  type CountDocumentDetail,
  type RecountRequestPayload,
  type ReviewDetail,
  type ReviewLineItem,
  type SupervisorDocumentListItem,
} from "@/types/count";
import type { MockSession } from "@/types/user";

async function getBranch(branchId: string) {
  const branch = await prisma.branch.findUnique({
    where: { id: branchId },
    include: { expressLocations: { orderBy: { locationCode: "asc" } } },
  });
  return branch ? mapBranch(branch) : null;
}

async function enrichSupervisorDocument(
  doc: CountDocument,
): Promise<SupervisorDocumentListItem> {
  const branch = await getBranch(doc.branchId);
  const version = doc.currentVersionId
    ? await prisma.countVersion.findUnique({ where: { id: doc.currentVersionId } })
    : null;
  const submitter = version?.submittedBy
    ? await getUserById(version.submittedBy)
    : undefined;

  return {
    ...doc,
    branchCode: branch?.code ?? "",
    branchName: branch?.name ?? "",
    branchExpressLocationCodes: branch?.expressLocationCodes ?? [],
    countedLines: await countCountedLines(doc.id, doc.currentVersionId),
    submittedBy: version?.submittedBy ?? null,
    submittedByName: submitter?.name ?? null,
    submittedAt: version?.submittedAt?.toISOString() ?? null,
    hasDocumentNote: Boolean(doc.note?.trim()),
  };
}

export async function listSupervisorDocuments(
  session: MockSession,
): Promise<SupervisorDocumentListItem[] | { error: string }> {
  if (!canSupervise(session.role)) {
    return { error: "Access denied" };
  }

  const documents = await prisma.countDocument.findMany();
  const filtered = documents
    .map(mapCountDocument)
    .filter((doc) => {
      if (!filterDocumentsForSupervisor(doc.status)) return false;
      return canAccessBranch(session.role, session.branchIds, doc.branchId);
    });

  const result: SupervisorDocumentListItem[] = [];
  for (const doc of filtered) {
    result.push(await enrichSupervisorDocument(doc));
  }

  return result.sort((a, b) => {
    const aTime = a.submittedAt ?? a.updatedAt;
    const bTime = b.submittedAt ?? b.updatedAt;
    return bTime.localeCompare(aTime);
  });
}

export async function getReviewDetail(
  session: MockSession,
  documentId: string,
): Promise<ReviewDetail | { error: string }> {
  if (!canSupervise(session.role)) {
    return { error: "Access denied" };
  }

  const access = await getDocumentForSession(session, documentId);
  if (!access.ok) return { error: access.error };

  const doc = access.document;
  if (!filterDocumentsForSupervisor(doc.status)) {
    return { error: "Document is not available for review" };
  }

  const branch = await getBranch(doc.branchId);
  const versionRow = doc.currentVersionId
    ? await prisma.countVersion.findUnique({ where: { id: doc.currentVersionId } })
    : null;

  const lines = (
    await prisma.productLine.findMany({
      where: { documentId },
      orderBy: { lineNo: "asc" },
    })
  ).map(mapProductLine);

  const entries = doc.currentVersionId
    ? await resolveEffectiveEntries(documentId, doc.currentVersionId)
    : [];

  const reviewLines: ReviewLineItem[] = lines.map((line) => {
    const entry = entries.find((item) => item.lineId === line.lineId);
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
      versionNo: versionRow?.versionNo ?? doc.currentVersionNo,
      isCounted,
    };
  });

  const document: CountDocumentDetail = {
    ...doc,
    branchCode: branch?.code ?? "",
    branchName: branch?.name ?? "",
    branchExpressLocationCodes: branch?.expressLocationCodes ?? [],
    version: versionRow ? mapCountVersion(versionRow) : null,
    lines,
    entries,
    countedLines: await countCountedLines(documentId, doc.currentVersionId),
  };

  const versions = (
    await prisma.countVersion.findMany({
      where: { documentId },
      orderBy: { versionNo: "asc" },
    })
  ).map(mapCountVersion);

  const recountRequests = (
    await prisma.recountRequest.findMany({
      where: { documentId },
      include: { items: true },
    })
  ).map(mapRecountRequest);

  return {
    document,
    reviewLines,
    versions,
    auditLogs: await getAuditLogsByDocument(documentId),
    recountRequests,
  };
}

export async function approveDocument(
  session: MockSession,
  documentId: string,
): Promise<{ success: true } | { error: string }> {
  if (!canSupervise(session.role)) {
    return { error: "Access denied" };
  }

  const access = await getDocumentForSession(session, documentId);
  if (!access.ok) return { error: access.error };

  const doc = access.document;
  if (doc.status !== DocumentStatus.SUBMITTED) {
    return { error: "Only submitted documents can be approved" };
  }

  const version = doc.currentVersionId
    ? await prisma.countVersion.findUnique({ where: { id: doc.currentVersionId } })
    : null;
  if (!version) return { error: "Version not found" };

  await snapshotFinalCountEntries(documentId, version.id);

  const now = new Date();
  await prisma.$transaction([
    prisma.countVersion.update({
      where: { id: version.id },
      data: { status: VersionStatus.APPROVED },
    }),
    prisma.countDocument.update({
      where: { id: documentId },
      data: {
        status: DocumentStatus.COMPLETED,
        updatedAt: now,
      },
    }),
  ]);

  await logApproveVersion(
    session.userId,
    session.userName,
    doc.branchId,
    documentId,
    version.id,
  );
  await logCompleteDocument(
    session.userId,
    session.userName,
    doc.branchId,
    documentId,
  );

  return { success: true };
}

export async function requestRecount(
  session: MockSession,
  documentId: string,
  payload: RecountRequestPayload,
): Promise<{ success: true; versionId: string; versionNo: number } | { error: string }> {
  if (!canSupervise(session.role)) {
    return { error: "Access denied" };
  }

  const access = await getDocumentForSession(session, documentId);
  if (!access.ok) return { error: access.error };

  const doc = access.document;
  if (
    doc.status !== DocumentStatus.SUBMITTED &&
    doc.status !== DocumentStatus.REVIEWING
  ) {
    return { error: "Document cannot be sent for recount" };
  }

  if (!payload.items.length) {
    return { error: "Select at least one line for recount" };
  }

  const baseVersion = await prisma.countVersion.findUnique({
    where: { id: payload.baseVersionId },
  });
  if (!baseVersion || baseVersion.documentId !== documentId) {
    return { error: "Base version not found" };
  }

  const lines = await prisma.productLine.findMany({ where: { documentId } });
  for (const item of payload.items) {
    if (!lines.some((line) => line.lineId === item.lineId)) {
      return { error: `Line not found: ${item.lineId}` };
    }
    if (!item.reason.trim()) {
      return { error: "Recount reason is required for each selected line" };
    }
  }

  const now = new Date();
  const newVersionNo = baseVersion.versionNo + 1;
  const newVersionId = `ver_${documentId}_v${newVersionNo}`;
  const recountId = `recount_${String(newVersionNo).padStart(3, "0")}`;

  await snapshotDocumentEntries(documentId, baseVersion.id);

  const baseEntries = await resolveEffectiveEntries(documentId, baseVersion.id);
  const baseLineIds = new Set(lines.map((line) => line.lineId));

  await prisma.$transaction(async (tx) => {
    await tx.countVersion.update({
      where: { id: baseVersion.id },
      data: { status: VersionStatus.LOCKED },
    });

    await tx.countVersion.create({
      data: {
        id: newVersionId,
        documentId,
        versionNo: newVersionNo,
        status: VersionStatus.DRAFT,
        baseVersionId: baseVersion.id,
        createdAt: now,
        createdBy: session.userId,
      },
    });

    for (const entry of baseEntries.filter((item) => baseLineIds.has(item.lineId))) {
      await tx.countEntry.upsert({
        where: { lineId: entry.lineId },
        create: {
          lineId: entry.lineId,
          qtyCase: entry.qtyCase,
          qtyPack: entry.qtyPack,
          qtyPiece: entry.qtyPiece,
          totalBaseQty: entry.totalBaseQty,
          note: entry.note,
          revision: 0,
          updatedAt: now,
          updatedBy: session.userId,
        },
        update: {
          qtyCase: entry.qtyCase,
          qtyPack: entry.qtyPack,
          qtyPiece: entry.qtyPiece,
          totalBaseQty: entry.totalBaseQty,
          note: entry.note,
          revision: 0,
          updatedAt: now,
          updatedBy: session.userId,
        },
      });
    }

    await tx.countDocument.update({
      where: { id: documentId },
      data: {
        status: DocumentStatus.RECOUNT_REQUESTED,
        currentVersionId: newVersionId,
        currentVersionNo: newVersionNo,
        updatedAt: now,
      },
    });

    await tx.recountRequest.create({
      data: {
        id: recountId,
        documentId,
        baseVersionId: baseVersion.id,
        newVersionId,
        requestedBy: session.userId,
        requestedAt: now,
        items: {
          create: payload.items.map((item) => ({
            lineId: item.lineId,
            reason: item.reason,
          })),
        },
      },
    });
  });

  await logRequestRecount(
    session.userId,
    session.userName,
    doc.branchId,
    documentId,
    newVersionId,
    `Recount ${payload.items.length} line(s)`,
  );
  await logCreateVersion(
    session.userId,
    session.userName,
    doc.branchId,
    documentId,
    newVersionId,
    `Created version ${newVersionNo} from ${baseVersion.id}`,
  );

  return { success: true, versionId: newVersionId, versionNo: newVersionNo };
}
