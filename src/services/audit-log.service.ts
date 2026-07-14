import { getDocumentForSession } from "@/lib/document-access";
import {
  type AuditLogEnrichment,
  formatAuditLogDetail,
} from "@/lib/audit-log-detail";
import { mapAuditLog } from "@/lib/db/mappers";
import { prisma } from "@/lib/prisma";
import { AuditAction as AppAuditAction } from "@/types/audit";
import type { AuditLog } from "@/types/audit";
import type { MockSession } from "@/types/user";
import { UserRole } from "@/types/user";
import { AuditAction as PrismaAuditAction } from "@prisma/client";

async function nextAuditId(): Promise<string> {
  const logs = await prisma.auditLog.findMany({
    select: { id: true },
  });

  let max = 0;
  for (const log of logs) {
    const match = /^audit_(\d+)$/.exec(log.id);
    if (match) {
      max = Math.max(max, Number.parseInt(match[1], 10));
    }
  }

  return `audit_${String(max + 1).padStart(4, "0")}`;
}

export async function createAuditLog(
  input: Omit<AuditLog, "id" | "createdAt">,
): Promise<AuditLog> {
  const log = await prisma.auditLog.create({
    data: {
      id: await nextAuditId(),
      action: input.action as PrismaAuditAction,
      userId: input.userId,
      userName: input.userName,
      branchId: input.branchId ?? null,
      documentId: input.documentId ?? null,
      versionId: input.versionId ?? null,
      lineId: input.lineId ?? null,
      detail: input.detail ?? null,
      createdAt: new Date(),
    },
  });

  return mapAuditLog(log);
}

async function buildAuditLogEnrichment(
  logs: AuditLog[],
): Promise<AuditLogEnrichment> {
  const lineIds = [
    ...new Set(logs.map((log) => log.lineId).filter(Boolean)),
  ] as string[];
  const versionIds = [
    ...new Set(logs.map((log) => log.versionId).filter(Boolean)),
  ] as string[];
  const documentIds = [
    ...new Set(logs.map((log) => log.documentId).filter(Boolean)),
  ] as string[];

  const [productLines, versions, entries, documents] = await Promise.all([
    lineIds.length
      ? prisma.productLine.findMany({
          where: { lineId: { in: lineIds } },
          select: {
            lineId: true,
            productCode: true,
            productName: true,
            allowCase: true,
            allowPack: true,
            allowPiece: true,
            unitCaseName: true,
            unitPackName: true,
            unitPieceName: true,
          },
        })
      : Promise.resolve([]),
    versionIds.length
      ? prisma.countVersion.findMany({
          where: { id: { in: versionIds } },
          select: { id: true, versionNo: true },
        })
      : Promise.resolve([]),
    lineIds.length
      ? prisma.countEntry.findMany({
          where: { lineId: { in: lineIds } },
          select: {
            lineId: true,
            qtyCase: true,
            qtyPack: true,
            qtyPiece: true,
          },
        })
      : Promise.resolve([]),
    documentIds.length
      ? prisma.countDocument.findMany({
          where: { id: { in: documentIds } },
          select: { id: true, documentNo: true, totalLines: true },
        })
      : Promise.resolve([]),
  ]);

  const lineById: AuditLogEnrichment["lineById"] = {};
  for (const line of productLines) {
    lineById[line.lineId] = line;
  }

  const versionNoById: AuditLogEnrichment["versionNoById"] = {};
  for (const version of versions) {
    versionNoById[version.id] = version.versionNo;
  }

  const entryByLineId: AuditLogEnrichment["entryByLineId"] = {};
  for (const entry of entries) {
    entryByLineId[entry.lineId] = entry;
  }

  const documentNoById: AuditLogEnrichment["documentNoById"] = {};
  const totalLinesByDocumentId: AuditLogEnrichment["totalLinesByDocumentId"] =
    {};
  for (const document of documents) {
    documentNoById[document.id] = document.documentNo;
    totalLinesByDocumentId[document.id] = document.totalLines;
  }

  return {
    lineById,
    versionNoById,
    entryByLineId,
    documentNoById,
    totalLinesByDocumentId,
  };
}

export async function enrichAuditLogs(logs: AuditLog[]): Promise<AuditLog[]> {
  if (logs.length === 0) return logs;
  const enrichment = await buildAuditLogEnrichment(logs);
  return logs.map((log) => ({
    ...log,
    detail: formatAuditLogDetail(log, enrichment),
  }));
}

export async function getAuditLogsByDocument(
  documentId: string,
): Promise<AuditLog[]> {
  const logs = await prisma.auditLog.findMany({
    where: { documentId },
    orderBy: { createdAt: "desc" },
  });

  return enrichAuditLogs(logs.map(mapAuditLog));
}

export async function getAuditLogsForDocumentSession(
  session: MockSession,
  documentId: string,
): Promise<AuditLog[] | { error: string }> {
  const access = await getDocumentForSession(session, documentId);
  if (!access.ok) return { error: access.error };
  return getAuditLogsByDocument(documentId);
}

export async function listAllAuditLogs(
  session: MockSession,
): Promise<AuditLog[] | { error: string }> {
  if (session.role !== UserRole.ADMIN && session.role !== UserRole.HQ) {
    return { error: "Access denied" };
  }

  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
  });

  return enrichAuditLogs(logs.map(mapAuditLog));
}

export async function logLogin(
  userId: string,
  userName: string,
): Promise<AuditLog> {
  return createAuditLog({
    action: AppAuditAction.LOGIN,
    userId,
    userName,
    detail: "เข้าสู่ระบบ",
  });
}

export async function logStartCount(
  userId: string,
  userName: string,
  branchId: string,
  documentId: string,
  versionId: string,
  detail?: string,
): Promise<AuditLog> {
  return createAuditLog({
    action: AppAuditAction.START_COUNT,
    userId,
    userName,
    branchId,
    documentId,
    versionId,
    detail,
  });
}

export async function logAutoSave(
  userId: string,
  userName: string,
  branchId: string,
  documentId: string,
  versionId: string,
  lineId: string,
  detail?: string,
): Promise<AuditLog> {
  return createAuditLog({
    action: AppAuditAction.AUTO_SAVE_COUNT,
    userId,
    userName,
    branchId,
    documentId,
    versionId,
    lineId,
    detail,
  });
}

export async function logSubmit(
  userId: string,
  userName: string,
  branchId: string,
  documentId: string,
  versionId: string,
  detail?: string,
): Promise<AuditLog> {
  return createAuditLog({
    action: AppAuditAction.SUBMIT_TO_SUPERVISOR,
    userId,
    userName,
    branchId,
    documentId,
    versionId,
    detail,
  });
}

export async function logCreateVersion(
  userId: string,
  userName: string,
  branchId: string,
  documentId: string,
  versionId: string,
  detail?: string,
): Promise<AuditLog> {
  return createAuditLog({
    action: AppAuditAction.CREATE_VERSION,
    userId,
    userName,
    branchId,
    documentId,
    versionId,
    detail,
  });
}

export async function logRequestRecount(
  userId: string,
  userName: string,
  branchId: string,
  documentId: string,
  versionId: string,
  detail?: string,
): Promise<AuditLog> {
  return createAuditLog({
    action: AppAuditAction.REQUEST_RECOUNT,
    userId,
    userName,
    branchId,
    documentId,
    versionId,
    detail,
  });
}

export async function logApproveVersion(
  userId: string,
  userName: string,
  branchId: string,
  documentId: string,
  versionId: string,
  detail?: string,
): Promise<AuditLog> {
  return createAuditLog({
    action: AppAuditAction.APPROVE_VERSION,
    userId,
    userName,
    branchId,
    documentId,
    versionId,
    detail,
  });
}

export async function logCompleteDocument(
  userId: string,
  userName: string,
  branchId: string,
  documentId: string,
  detail?: string,
): Promise<AuditLog> {
  return createAuditLog({
    action: AppAuditAction.COMPLETE_DOCUMENT,
    userId,
    userName,
    branchId,
    documentId,
    detail,
  });
}

export async function logExpressSync(
  userId: string,
  userName: string,
  countDate: string,
  summary: {
    expressLineCount: number;
    created: number;
    updated: number;
    skipped: number;
    locations?: string[];
  },
): Promise<AuditLog> {
  const selectedLocations = summary.locations?.length
    ? `; locations=${summary.locations.join(",")}`
    : "";

  return createAuditLog({
    action: AppAuditAction.IMPORT_FROM_EXPRESS,
    userId,
    userName,
    detail: `date=${countDate}; lines=${summary.expressLineCount}; created=${summary.created}; updated=${summary.updated}; skipped=${summary.skipped}${selectedLocations}`,
  });
}

export async function logDeleteDocument(
  userId: string,
  userName: string,
  branchId: string,
  detail: string,
): Promise<AuditLog> {
  return createAuditLog({
    action: AppAuditAction.DELETE_DOCUMENT,
    userId,
    userName,
    branchId,
    detail,
  });
}

export async function logPushToExpress(
  userId: string,
  userName: string,
  branchId: string,
  documentId: string,
  detail: string,
): Promise<AuditLog> {
  return createAuditLog({
    action: AppAuditAction.PUSH_TO_EXPRESS,
    userId,
    userName,
    branchId,
    documentId,
    detail,
  });
}
