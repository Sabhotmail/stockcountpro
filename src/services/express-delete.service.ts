import { mapBranch, mapCountDocument, mapHub } from "@/lib/db/mappers";
import { dateKeyToUtcDateOnly } from "@/lib/datetime";
import {
  assertSafeExpressLocationCodes,
  classifyLocationForBranch,
  extractLocationPrefix,
} from "@/lib/express-location";
import {
  canAccessBranch,
  canAccessCentralDocuments,
  canAccessDocument,
  canAccessHub,
  canDeleteExpressStockCount,
} from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  deleteCountDocumentForExpressDelete,
  expressDeleteBlockedReason,
  isExpressDeleteAllowedStatus,
} from "@/services/count-document.service";
import { deleteExpressCountByLocation } from "@/services/express-api.service";
import { logDeleteExpressStockCount } from "@/services/audit-log.service";
import { DocumentStatus } from "@/types/count";
import type { MockSession } from "@/types/user";

export type ExpressDeleteDocumentPreview = {
  id: string;
  documentNo: string;
  status: DocumentStatus;
  locationCode: string | null;
  locationName: string | null;
  branchCode: string;
  branchName: string;
  hubCode: string | null;
  hubName: string | null;
  countedLines: number;
  totalLines: number;
  deletable: boolean;
  blockedReason: string | null;
};

export type ExpressDeletePreviewResult = {
  countDate: string;
  locationCode: string;
  deletableDocuments: ExpressDeleteDocumentPreview[];
  blockedDocuments: ExpressDeleteDocumentPreview[];
};

export type ExpressDeleteSuccessResult = {
  success: true;
  countDate: string;
  locationCode: string;
  appDeleted: true;
  expressDeleted: true;
};

export type ExpressDeletePartialResult = {
  partial: true;
  countDate: string;
  locationCode: string;
  appDeleted: true;
  expressError: string;
  canRetryExpress: true;
};

function normalizeInputs(
  countDate: string,
  locationCode: string,
):
  | { ok: true; countDate: string; locationCode: string; documentDate: Date }
  | { ok: false; error: string } {
  const documentDate = dateKeyToUtcDateOnly(countDate);
  if (!documentDate) {
    return { ok: false, error: "countDate must be yyyy-MM-dd" };
  }

  const safe = assertSafeExpressLocationCodes([locationCode]);
  if (!safe.ok) {
    return { ok: false, error: safe.error };
  }

  const code = locationCode.trim().toUpperCase();
  return { ok: true, countDate, locationCode: code, documentDate };
}

function expectedConfirmPhrase(countDate: string, locationCode: string): string {
  return `DELETE ${countDate} ${locationCode.trim().toUpperCase()}`;
}

/**
 * Verify the session may act on an Express location by resolving its prefix to a
 * branch (and hub/central) the user can access. Used when no local document is
 * available to authorize against (e.g. Express-only retry).
 */
async function canAccessExpressLocation(
  session: MockSession,
  locationCode: string,
): Promise<boolean> {
  const prefix = extractLocationPrefix(locationCode);
  if (!prefix) return false;

  const branchRow = await prisma.branch.findFirst({
    where: { expressLocationPrefix: prefix, isActive: true },
  });
  if (!branchRow) return false;

  const branch = mapBranch(branchRow);
  if (!canAccessBranch(session.role, session.branchIds, branch.id)) {
    return false;
  }

  const hubRows = await prisma.hub.findMany({ where: { branchId: branch.id } });
  const classification = classifyLocationForBranch(
    locationCode,
    branch.id,
    branch.expressLocationPrefix,
    hubRows.map(mapHub),
  );

  if (classification.kind === "central") {
    return canAccessCentralDocuments(session.role);
  }
  if (classification.kind === "hub") {
    return canAccessHub(session.role, session.hubIds, classification.hub.id);
  }
  return false;
}

async function mapDocumentPreview(
  doc: ReturnType<typeof mapCountDocument>,
): Promise<ExpressDeleteDocumentPreview> {
  const branch = await prisma.branch.findUnique({ where: { id: doc.branchId } });
  const hub = doc.hubId
    ? await prisma.hub.findUnique({ where: { id: doc.hubId } })
    : null;

  const blockedReason = expressDeleteBlockedReason(doc.status);
  return {
    id: doc.id,
    documentNo: doc.documentNo,
    status: doc.status,
    locationCode: doc.locationCode,
    locationName: doc.locationName,
    branchCode: branch ? mapBranch(branch).code : "",
    branchName: branch ? mapBranch(branch).name : "",
    hubCode: hub ? mapHub(hub).code : null,
    hubName: hub ? mapHub(hub).name : null,
    countedLines: doc.countedLines,
    totalLines: doc.totalLines,
    deletable: blockedReason === null,
    blockedReason,
  };
}

export async function previewExpressDelete(
  session: MockSession,
  countDate: string,
  locationCode: string,
): Promise<ExpressDeletePreviewResult | { error: string }> {
  if (!canDeleteExpressStockCount(session.role)) {
    return { error: "Access denied" };
  }

  const normalized = normalizeInputs(countDate, locationCode);
  if (!normalized.ok) return { error: normalized.error };

  const rows = await prisma.countDocument.findMany({
    where: {
      documentDate: normalized.documentDate,
      locationCode: normalized.locationCode,
    },
    orderBy: { documentNo: "asc" },
  });

  const accessible = rows
    .map(mapCountDocument)
    .filter((doc) =>
      canAccessDocument(
        session.role,
        session.branchIds,
        session.hubIds,
        doc,
      ),
    );

  const previews = await Promise.all(accessible.map(mapDocumentPreview));
  const deletableDocuments = previews.filter((doc) => doc.deletable);
  const blockedDocuments = previews.filter((doc) => !doc.deletable);

  return {
    countDate: normalized.countDate,
    locationCode: normalized.locationCode,
    deletableDocuments,
    blockedDocuments,
  };
}

async function writeExpressDeleteAudit(
  session: MockSession,
  branchId: string | undefined,
  detail: string,
): Promise<void> {
  try {
    await logDeleteExpressStockCount(
      session.userId,
      session.userName,
      branchId,
      detail,
    );
  } catch (error) {
    console.error("Failed to write express delete audit log", error);
  }
}

export async function executeExpressDelete(
  session: MockSession,
  countDate: string,
  locationCode: string,
  documentId: string,
  confirmPhrase: string,
): Promise<
  | ExpressDeleteSuccessResult
  | ExpressDeletePartialResult
  | { error: string; status?: 400 | 403 | 404 }
> {
  if (!canDeleteExpressStockCount(session.role)) {
    return { error: "Access denied", status: 403 };
  }

  const normalized = normalizeInputs(countDate, locationCode);
  if (!normalized.ok) return { error: normalized.error, status: 400 };

  const expectedPhrase = expectedConfirmPhrase(
    normalized.countDate,
    normalized.locationCode,
  );
  if (confirmPhrase.trim() !== expectedPhrase) {
    return {
      error: `พิมพ์ยืนยันให้ตรงกับ "${expectedPhrase}"`,
      status: 400,
    };
  }

  const preview = await previewExpressDelete(
    session,
    normalized.countDate,
    normalized.locationCode,
  );
  if ("error" in preview) {
    return { error: preview.error, status: preview.error === "Access denied" ? 403 : 400 };
  }

  const selected = preview.deletableDocuments.find((doc) => doc.id === documentId);
  if (!selected) {
    return {
      error: "ไม่พบเอกสารที่เลือกหรือไม่สามารถลบได้",
      status: 404,
    };
  }

  const appDelete = await deleteCountDocumentForExpressDelete(session, documentId);
  if ("error" in appDelete) {
    return { error: appDelete.error, status: appDelete.status };
  }

  const expressResult = await deleteExpressCountByLocation(
    normalized.countDate,
    normalized.locationCode,
  );

  if ("error" in expressResult) {
    const detail = [
      `date=${normalized.countDate}`,
      `location=${normalized.locationCode}`,
      `documentId=${documentId}`,
      "app=deleted",
      "express=failed",
      `error=${expressResult.error}`,
    ].join("; ");
    await writeExpressDeleteAudit(session, appDelete.branchId, detail);

    return {
      partial: true,
      countDate: normalized.countDate,
      locationCode: normalized.locationCode,
      appDeleted: true,
      expressError: expressResult.error,
      canRetryExpress: true,
    };
  }

  const detail = [
    `date=${normalized.countDate}`,
    `location=${normalized.locationCode}`,
    `documentId=${documentId}`,
    "app=deleted",
    "express=deleted",
    appDelete.detail,
  ].join("; ");
  await writeExpressDeleteAudit(session, appDelete.branchId, detail);

  return {
    success: true,
    countDate: normalized.countDate,
    locationCode: normalized.locationCode,
    appDeleted: true,
    expressDeleted: true,
  };
}

export async function retryExpressDelete(
  session: MockSession,
  countDate: string,
  locationCode: string,
): Promise<
  | { success: true; countDate: string; locationCode: string; expressDeleted: true }
  | { error: string; status?: 400 | 403 | 502 }
> {
  if (!canDeleteExpressStockCount(session.role)) {
    return { error: "Access denied", status: 403 };
  }

  const normalized = normalizeInputs(countDate, locationCode);
  if (!normalized.ok) return { error: normalized.error, status: 400 };

  const hasAccess = await canAccessExpressLocation(
    session,
    normalized.locationCode,
  );
  if (!hasAccess) {
    return { error: "Access denied", status: 403 };
  }

  const expressResult = await deleteExpressCountByLocation(
    normalized.countDate,
    normalized.locationCode,
  );
  if ("error" in expressResult) {
    return { error: expressResult.error, status: 502 };
  }

  await writeExpressDeleteAudit(
    session,
    undefined,
    [
      `date=${normalized.countDate}`,
      `location=${normalized.locationCode}`,
      "app=already-deleted",
      "express=deleted-retry",
    ].join("; "),
  );

  return {
    success: true,
    countDate: normalized.countDate,
    locationCode: normalized.locationCode,
    expressDeleted: true,
  };
}

export function isDeletableExpressDeleteStatus(status: DocumentStatus): boolean {
  return isExpressDeleteAllowedStatus(status);
}
