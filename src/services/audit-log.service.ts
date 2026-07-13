import { getDocumentForSession } from "@/lib/document-access";
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

export async function getAuditLogsByDocument(
  documentId: string,
): Promise<AuditLog[]> {
  const logs = await prisma.auditLog.findMany({
    where: { documentId },
    orderBy: { createdAt: "desc" },
  });

  return logs.map(mapAuditLog);
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

  return logs.map(mapAuditLog);
}

export async function logLogin(
  userId: string,
  userName: string,
): Promise<AuditLog> {
  return createAuditLog({
    action: AppAuditAction.LOGIN,
    userId,
    userName,
    detail: "Mock login",
  });
}

export async function logStartCount(
  userId: string,
  userName: string,
  branchId: string,
  documentId: string,
  versionId: string,
): Promise<AuditLog> {
  return createAuditLog({
    action: AppAuditAction.START_COUNT,
    userId,
    userName,
    branchId,
    documentId,
    versionId,
  });
}

export async function logAutoSave(
  userId: string,
  userName: string,
  branchId: string,
  documentId: string,
  versionId: string,
  lineId: string,
): Promise<AuditLog> {
  return createAuditLog({
    action: AppAuditAction.AUTO_SAVE_COUNT,
    userId,
    userName,
    branchId,
    documentId,
    versionId,
    lineId,
  });
}

export async function logSubmit(
  userId: string,
  userName: string,
  branchId: string,
  documentId: string,
  versionId: string,
): Promise<AuditLog> {
  return createAuditLog({
    action: AppAuditAction.SUBMIT_TO_SUPERVISOR,
    userId,
    userName,
    branchId,
    documentId,
    versionId,
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
): Promise<AuditLog> {
  return createAuditLog({
    action: AppAuditAction.APPROVE_VERSION,
    userId,
    userName,
    branchId,
    documentId,
    versionId,
  });
}

export async function logCompleteDocument(
  userId: string,
  userName: string,
  branchId: string,
  documentId: string,
): Promise<AuditLog> {
  return createAuditLog({
    action: AppAuditAction.COMPLETE_DOCUMENT,
    userId,
    userName,
    branchId,
    documentId,
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
