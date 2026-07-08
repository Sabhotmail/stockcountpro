import { mapBranch } from "@/lib/db/mappers";
import { prisma } from "@/lib/prisma";
import {
  getAuditLogsByDocument,
  listAllAuditLogs,
} from "@/services/audit-log.service";
import { listUsers } from "@/services/user.service";
import type { AuditLog } from "@/types/audit";
import type { MockSession } from "@/types/user";
import { UserRole } from "@/types/user";

export function canAccessAdmin(session: MockSession): boolean {
  return session.role === UserRole.ADMIN || session.role === UserRole.HQ;
}

export async function listUsersForAdmin(session: MockSession) {
  if (!canAccessAdmin(session)) return { error: "Access denied" as const };
  return listUsers();
}

export async function listBranchesForAdmin(session: MockSession) {
  if (!canAccessAdmin(session)) return { error: "Access denied" as const };

  const branches = await prisma.branch.findMany({
    orderBy: { code: "asc" },
  });

  return branches.map(mapBranch);
}

export async function listAuditLogsForAdmin(
  session: MockSession,
  documentId?: string | null,
): Promise<AuditLog[] | { error: string }> {
  if (!canAccessAdmin(session)) return { error: "Access denied" };

  if (documentId) {
    return getAuditLogsByDocument(documentId);
  }

  const result = await listAllAuditLogs(session);
  if ("error" in result) return result;
  return result;
}

export async function getAdminDashboardCounts(session: MockSession) {
  if (!canAccessAdmin(session)) return { error: "Access denied" as const };

  const [users, branches, documents, auditLogs] = await Promise.all([
    prisma.user.count(),
    prisma.branch.count(),
    prisma.countDocument.count(),
    prisma.auditLog.count(),
  ]);

  return {
    users,
    branches,
    documents,
    auditLogs,
  };
}
