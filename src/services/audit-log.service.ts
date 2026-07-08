import { getDocumentForSession } from "@/lib/document-access";
import { getMockDb } from "@/mock/mock-db";
import { AuditAction } from "@/types/audit";
import type { AuditLog } from "@/types/audit";
import type { MockSession } from "@/types/user";

function nextAuditId(): string {
  const db = getMockDb();
  let max = 0;

  for (const log of db.auditLogs) {
    const match = /^audit_(\d+)$/.exec(log.id);
    if (match) {
      max = Math.max(max, Number.parseInt(match[1], 10));
    }
  }

  return `audit_${String(max + 1).padStart(4, "0")}`;
}

export function createAuditLog(
  input: Omit<AuditLog, "id" | "createdAt">,
): AuditLog {
  const db = getMockDb();
  const log: AuditLog = {
    ...input,
    id: nextAuditId(),
    createdAt: new Date().toISOString(),
  };
  db.auditLogs.push(log);
  return log;
}

export function getAuditLogsByDocument(documentId: string): AuditLog[] {
  const seen = new Set<string>();

  return getMockDb()
    .auditLogs.filter((log) => {
      if (log.documentId !== documentId) return false;
      if (seen.has(log.id)) return false;
      seen.add(log.id);
      return true;
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getAuditLogsForDocumentSession(
  session: MockSession,
  documentId: string,
): AuditLog[] | { error: string } {
  const access = getDocumentForSession(session, documentId);
  if (!access.ok) return { error: access.error };
  return getAuditLogsByDocument(documentId);
}

export function logLogin(userId: string, userName: string): AuditLog {
  return createAuditLog({
    action: AuditAction.LOGIN,
    userId,
    userName,
    detail: "Mock login",
  });
}

export function logOpenDocument(
  userId: string,
  userName: string,
  branchId: string,
  documentId: string,
): AuditLog {
  return createAuditLog({
    action: AuditAction.OPEN_DOCUMENT,
    userId,
    userName,
    branchId,
    documentId,
  });
}

export function logStartCount(
  userId: string,
  userName: string,
  branchId: string,
  documentId: string,
  versionId: string,
): AuditLog {
  return createAuditLog({
    action: AuditAction.START_COUNT,
    userId,
    userName,
    branchId,
    documentId,
    versionId,
  });
}

export function logAutoSave(
  userId: string,
  userName: string,
  branchId: string,
  documentId: string,
  versionId: string,
  lineId: string,
): AuditLog {
  return createAuditLog({
    action: AuditAction.AUTO_SAVE_COUNT,
    userId,
    userName,
    branchId,
    documentId,
    versionId,
    lineId,
  });
}

export function logSubmit(
  userId: string,
  userName: string,
  branchId: string,
  documentId: string,
  versionId: string,
): AuditLog {
  return createAuditLog({
    action: AuditAction.SUBMIT_TO_SUPERVISOR,
    userId,
    userName,
    branchId,
    documentId,
    versionId,
  });
}

export function logCreateVersion(
  userId: string,
  userName: string,
  branchId: string,
  documentId: string,
  versionId: string,
  detail?: string,
): AuditLog {
  return createAuditLog({
    action: AuditAction.CREATE_VERSION,
    userId,
    userName,
    branchId,
    documentId,
    versionId,
    detail,
  });
}

export function logRequestRecount(
  userId: string,
  userName: string,
  branchId: string,
  documentId: string,
  versionId: string,
  detail?: string,
): AuditLog {
  return createAuditLog({
    action: AuditAction.REQUEST_RECOUNT,
    userId,
    userName,
    branchId,
    documentId,
    versionId,
    detail,
  });
}

export function logApproveVersion(
  userId: string,
  userName: string,
  branchId: string,
  documentId: string,
  versionId: string,
): AuditLog {
  return createAuditLog({
    action: AuditAction.APPROVE_VERSION,
    userId,
    userName,
    branchId,
    documentId,
    versionId,
  });
}

export function logCompleteDocument(
  userId: string,
  userName: string,
  branchId: string,
  documentId: string,
): AuditLog {
  return createAuditLog({
    action: AuditAction.COMPLETE_DOCUMENT,
    userId,
    userName,
    branchId,
    documentId,
  });
}
