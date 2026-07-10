import { mapBranch } from "@/lib/db/mappers";
import {
  normalizeExpressLocationPrefix,
  validateExpressLocationPrefix,
} from "@/lib/express-location";
import { prisma } from "@/lib/prisma";
import {
  getAuditLogsByDocument,
  listAllAuditLogs,
} from "@/services/audit-log.service";
import { listUsers } from "@/services/user.service";
import type { AuditLog } from "@/types/audit";
import type { Branch, MockSession } from "@/types/user";
import { UserRole } from "@/types/user";
import { Prisma } from "@prisma/client";

export type UpdateAdminBranchInput = {
  expressLocationPrefix: string | null;
};

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

export async function updateBranchForAdmin(
  session: MockSession,
  branchId: string,
  input: UpdateAdminBranchInput,
): Promise<Branch | { error: string }> {
  if (!canAccessAdmin(session)) return { error: "Access denied" };

  const prefix = normalizeExpressLocationPrefix(input.expressLocationPrefix);
  if (prefix) {
    const formatError = validateExpressLocationPrefix(prefix);
    if (formatError) return { error: formatError };
  }

  const existingBranch = await prisma.branch.findUnique({
    where: { id: branchId },
    select: { id: true },
  });
  if (!existingBranch) return { error: "Branch not found" };

  if (prefix) {
    const conflict = await prisma.branch.findFirst({
      where: {
        expressLocationPrefix: prefix,
        id: { not: branchId },
      },
      select: { code: true },
    });
    if (conflict) {
      return {
        error: `Prefix "${prefix}" is already used by branch ${conflict.code}`,
      };
    }
  }

  try {
    const branch = await prisma.branch.update({
      where: { id: branchId },
      data: { expressLocationPrefix: prefix },
    });
    return mapBranch(branch);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { error: "Express location prefix is already used by another branch" };
    }
    throw error;
  }
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
