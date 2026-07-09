import { mapBranch } from "@/lib/db/mappers";
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
  expressLocationCode: string | null;
};

function normalizeExpressLocationCode(value: string | null): string | null {
  if (value === null) return null;
  const trimmed = value.trim().toUpperCase();
  return trimmed.length > 0 ? trimmed : null;
}

function validateExpressLocationCode(value: string | null): string | null {
  if (value === null) return null;
  if (!/^[A-Z0-9]{1,16}$/.test(value)) {
    return "Express location code must be 1–16 alphanumeric characters";
  }
  return null;
}

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

  if (input.expressLocationCode === undefined) {
    return { error: "expressLocationCode is required" };
  }

  const expressLocationCode = normalizeExpressLocationCode(
    input.expressLocationCode,
  );
  const formatError = validateExpressLocationCode(expressLocationCode);
  if (formatError) return { error: formatError };

  try {
    const branch = await prisma.branch.update({
      where: { id: branchId },
      data: { expressLocationCode },
    });
    return mapBranch(branch);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return { error: "Branch not found" };
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { error: "Express location code is already used by another branch" };
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
