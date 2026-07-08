import { mockBranches } from "@/mock/branches";
import { getMockDb } from "@/mock/mock-db";
import { mockUsers } from "@/mock/users";
import { getAuditLogsByDocument, listAllAuditLogs } from "@/services/audit-log.service";
import type { AuditLog } from "@/types/audit";
import type { MockSession } from "@/types/user";
import { UserRole } from "@/types/user";

export function canAccessAdmin(session: MockSession): boolean {
  return session.role === UserRole.ADMIN || session.role === UserRole.HQ;
}

export function listUsersForAdmin(session: MockSession) {
  if (!canAccessAdmin(session)) return { error: "Access denied" as const };
  return mockUsers;
}

export function listBranchesForAdmin(session: MockSession) {
  if (!canAccessAdmin(session)) return { error: "Access denied" as const };
  return mockBranches;
}

export function listAuditLogsForAdmin(
  session: MockSession,
  documentId?: string | null,
): AuditLog[] | { error: string } {
  if (!canAccessAdmin(session)) return { error: "Access denied" };

  if (documentId) {
    return getAuditLogsByDocument(documentId);
  }

  const result = listAllAuditLogs(session);
  if ("error" in result) return result;
  return result;
}

export function getAdminDashboardCounts(session: MockSession) {
  if (!canAccessAdmin(session)) return { error: "Access denied" as const };

  const db = getMockDb();
  return {
    users: mockUsers.length,
    branches: mockBranches.length,
    documents: db.documents.length,
    auditLogs: db.auditLogs.length,
  };
}
