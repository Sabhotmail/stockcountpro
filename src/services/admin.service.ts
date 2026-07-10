import { mapBranch } from "@/lib/db/mappers";
import {
  normalizeExpressLocationCodes,
  validateExpressLocationCode,
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
  expressLocationCodes: string[];
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

  if (!Array.isArray(input.expressLocationCodes)) {
    return { error: "expressLocationCodes must be an array" };
  }

  const expressLocationCodes = normalizeExpressLocationCodes(
    input.expressLocationCodes,
  );

  for (const code of expressLocationCodes) {
    const formatError = validateExpressLocationCode(code);
    if (formatError) return { error: formatError };
  }

  const existingBranch = await prisma.branch.findUnique({
    where: { id: branchId },
    select: { id: true },
  });
  if (!existingBranch) return { error: "Branch not found" };

  if (expressLocationCodes.length > 0) {
    const conflicts = await prisma.branchExpressLocation.findMany({
      where: {
        locationCode: { in: expressLocationCodes },
        branchId: { not: branchId },
      },
      select: { locationCode: true },
    });

    if (conflicts.length > 0) {
      return {
        error: `Express location code "${conflicts[0].locationCode}" is already used by another branch`,
      };
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.branchExpressLocation.deleteMany({ where: { branchId } });

      if (expressLocationCodes.length > 0) {
        await tx.branchExpressLocation.createMany({
          data: expressLocationCodes.map((locationCode) => ({
            branchId,
            locationCode,
          })),
        });
      }
    });

    const branch = await prisma.branch.findUniqueOrThrow({
      where: { id: branchId },
    });

    return mapBranch(branch);
  } catch (error) {
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
