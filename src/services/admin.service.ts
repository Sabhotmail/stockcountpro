import { mapBranch, mapHub } from "@/lib/db/mappers";
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
import type { Branch, Hub, MockSession } from "@/types/user";
import { UserRole } from "@/types/user";
import { Prisma } from "@prisma/client";

export type CreateAdminBranchInput = {
  code: string;
  name: string;
  expressLocationPrefix?: string | null;
};

export type UpdateAdminBranchInput = {
  name?: string;
  expressLocationPrefix?: string | null;
  isActive?: boolean;
};

export function canAccessAdmin(session: MockSession): boolean {
  return session.role === UserRole.ADMIN || session.role === UserRole.HQ;
}

function normalizeBranchCode(value: string): string | null {
  const trimmed = value.trim().toUpperCase();
  return trimmed.length > 0 ? trimmed : null;
}

function validateBranchCode(code: string): string | null {
  if (!/^[A-Z0-9]{2,16}$/.test(code)) {
    return "Branch code must be 2–16 alphanumeric characters";
  }
  return null;
}

function normalizeBranchName(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function validateBranchName(name: string): string | null {
  if (name.length > 100) {
    return "Branch name must be at most 100 characters";
  }
  return null;
}

async function assertPrefixAvailable(
  prefix: string | null,
  excludeBranchId?: string,
): Promise<string | null> {
  if (!prefix) return null;

  const conflict = await prisma.branch.findFirst({
    where: {
      expressLocationPrefix: prefix,
      ...(excludeBranchId ? { id: { not: excludeBranchId } } : {}),
    },
    select: { code: true },
  });

  if (conflict) {
    return `Prefix "${prefix}" is already used by branch ${conflict.code}`;
  }
  return null;
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

export async function createBranchForAdmin(
  session: MockSession,
  input: CreateAdminBranchInput,
): Promise<Branch | { error: string }> {
  if (!canAccessAdmin(session)) return { error: "Access denied" };

  const code = normalizeBranchCode(input.code);
  if (!code) return { error: "Branch code is required" };
  const codeError = validateBranchCode(code);
  if (codeError) return { error: codeError };

  const name = normalizeBranchName(input.name);
  if (!name) return { error: "Branch name is required" };
  const nameError = validateBranchName(name);
  if (nameError) return { error: nameError };

  const prefix =
    input.expressLocationPrefix === undefined
      ? null
      : normalizeExpressLocationPrefix(input.expressLocationPrefix);
  if (prefix) {
    const formatError = validateExpressLocationPrefix(prefix);
    if (formatError) return { error: formatError };
  }

  const id = `branch_${code.toLowerCase()}`;
  const existingId = await prisma.branch.findUnique({
    where: { id },
    select: { id: true },
  });
  if (existingId) {
    return { error: `Branch id "${id}" already exists` };
  }

  const existingCode = await prisma.branch.findUnique({
    where: { code },
    select: { id: true },
  });
  if (existingCode) {
    return { error: `Branch code "${code}" already exists` };
  }

  const prefixConflict = await assertPrefixAvailable(prefix);
  if (prefixConflict) return { error: prefixConflict };

  try {
    const branch = await prisma.branch.create({
      data: {
        id,
        code,
        name,
        expressLocationPrefix: prefix,
        isActive: true,
      },
    });
    return mapBranch(branch);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { error: "Branch code or prefix is already used" };
    }
    throw error;
  }
}

export async function updateBranchForAdmin(
  session: MockSession,
  branchId: string,
  input: UpdateAdminBranchInput,
): Promise<Branch | { error: string }> {
  if (!canAccessAdmin(session)) return { error: "Access denied" };

  const hasName = input.name !== undefined;
  const hasPrefix = input.expressLocationPrefix !== undefined;
  const hasActive = input.isActive !== undefined;

  if (!hasName && !hasPrefix && !hasActive) {
    return { error: "At least one field is required" };
  }

  const existingBranch = await prisma.branch.findUnique({
    where: { id: branchId },
  });
  if (!existingBranch) return { error: "Branch not found" };

  const data: {
    name?: string;
    expressLocationPrefix?: string | null;
    isActive?: boolean;
  } = {};

  if (hasName) {
    const name = normalizeBranchName(input.name!);
    if (!name) return { error: "Branch name is required" };
    const nameError = validateBranchName(name);
    if (nameError) return { error: nameError };
    data.name = name;
  }

  if (hasPrefix) {
    const prefix = normalizeExpressLocationPrefix(input.expressLocationPrefix);
    if (prefix) {
      const formatError = validateExpressLocationPrefix(prefix);
      if (formatError) return { error: formatError };
    }
    const prefixConflict = await assertPrefixAvailable(prefix, branchId);
    if (prefixConflict) return { error: prefixConflict };
    data.expressLocationPrefix = prefix;
  }

  if (hasActive) {
    if (typeof input.isActive !== "boolean") {
      return { error: "isActive must be a boolean" };
    }
    data.isActive = input.isActive;
  }

  try {
    const branch = await prisma.branch.update({
      where: { id: branchId },
      data,
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

export type CreateAdminHubInput = {
  branchId: string;
  code: string;
  name: string;
  shortName?: string | null;
  suffixLetter?: string | null;
};

export type UpdateAdminHubInput = {
  name?: string;
  shortName?: string | null;
  suffixLetter?: string | null;
  isActive?: boolean;
};

export async function listHubsForAdmin(
  session: MockSession,
  branchId?: string | null,
): Promise<Hub[] | { error: string }> {
  if (!canAccessAdmin(session)) return { error: "Access denied" };

  const hubs = await prisma.hub.findMany({
    where: branchId ? { branchId } : undefined,
    orderBy: [{ branchId: "asc" }, { code: "asc" }],
  });

  return hubs.map(mapHub);
}

export async function createHubForAdmin(
  session: MockSession,
  input: CreateAdminHubInput,
): Promise<Hub | { error: string }> {
  if (!canAccessAdmin(session)) return { error: "Access denied" };

  const branch = await prisma.branch.findUnique({
    where: { id: input.branchId },
    select: { id: true },
  });
  if (!branch) return { error: "Branch not found" };

  const code = input.code.trim();
  if (!/^[1-9]$/.test(code)) {
    return { error: "Hub code must be a single digit 1-9" };
  }

  const name = input.name.trim();
  if (!name) return { error: "Hub name is required" };

  const shortName = input.shortName?.trim() || null;
  const suffixLetter = input.suffixLetter?.trim().toUpperCase() || null;
  if (suffixLetter && !/^[A-Z]$/.test(suffixLetter)) {
    return { error: "Suffix letter must be a single A-Z character" };
  }

  const id = `hub_${input.branchId}_${code}`;

  try {
    const hub = await prisma.hub.create({
      data: {
        id,
        branchId: input.branchId,
        code,
        name,
        shortName,
        suffixLetter,
        isActive: true,
      },
    });
    return mapHub(hub);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { error: "Hub code already exists for this branch" };
    }
    throw error;
  }
}

export async function updateHubForAdmin(
  session: MockSession,
  hubId: string,
  input: UpdateAdminHubInput,
): Promise<Hub | { error: string }> {
  if (!canAccessAdmin(session)) return { error: "Access denied" };

  const existing = await prisma.hub.findUnique({ where: { id: hubId } });
  if (!existing) return { error: "Hub not found" };

  const data: {
    name?: string;
    shortName?: string | null;
    suffixLetter?: string | null;
    isActive?: boolean;
  } = {};

  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) return { error: "Hub name is required" };
    data.name = name;
  }

  if (input.shortName !== undefined) {
    data.shortName = input.shortName?.trim() || null;
  }

  if (input.suffixLetter !== undefined) {
    const suffixLetter = input.suffixLetter?.trim().toUpperCase() || null;
    if (suffixLetter && !/^[A-Z]$/.test(suffixLetter)) {
      return { error: "Suffix letter must be a single A-Z character" };
    }
    data.suffixLetter = suffixLetter;
  }

  if (input.isActive !== undefined) {
    if (typeof input.isActive !== "boolean") {
      return { error: "isActive must be a boolean" };
    }
    data.isActive = input.isActive;
  }

  if (Object.keys(data).length === 0) {
    return { error: "At least one field is required" };
  }

  const hub = await prisma.hub.update({
    where: { id: hubId },
    data,
  });

  return mapHub(hub);
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
