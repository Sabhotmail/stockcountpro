import { mapUser } from "@/lib/db/mappers";
import { hashPassword } from "@/lib/auth/password";
import { canManageSystem } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import type { MockSession, User, UserRole } from "@/types/user";
import { randomInt, randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";

type PasswordMode = "set" | "generate";

/** Same convention as bootstrap/seed: user_admin, user_chm_staff */
function userIdFromUsername(username: string): string {
  const slug = username.replace(/[^a-z0-9_]/gi, "_");
  return `user_${slug || randomUUID()}`;
}

export type CreateAdminUserInput = {
  name: string;
  username: string;
  role: UserRole;
  branchIds: string[];
  hubIds: string[];
  passwordMode: PasswordMode;
  password?: string;
};

export type UpdateAdminUserInput = {
  name?: string;
  role?: UserRole;
  branchIds?: string[];
  hubIds?: string[];
  isActive?: boolean;
};

export type ResetAdminUserPasswordInput = {
  passwordMode: PasswordMode;
  password?: string;
};

function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

function isRoleAdminOrHq(role: UserRole): boolean {
  return role === "ADMIN" || role === "HQ";
}

function enforceAdminAccess(session: MockSession): { error: string } | undefined {
  if (!canManageSystem(session.role)) return { error: "Access denied" };
  return undefined;
}

function ensureBranchRule(role: UserRole, branchIds: string[]): { error: string } | undefined {
  if (isRoleAdminOrHq(role)) return undefined;
  if (!branchIds.length) return { error: "At least one branch is required" };
  return undefined;
}

function generatePassword(): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const digits = "23456789";
  const symbols = "!@#$%^&*-_+=?";
  const all = upper + lower + digits + symbols;

  const pick = (set: string) => set[randomInt(0, set.length)];
  const chars: string[] = [pick(upper), pick(lower), pick(digits), pick(symbols)];
  for (let i = chars.length; i < 14; i++) chars.push(pick(all));

  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(0, i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join("");
}

async function setUserBranchesTx(tx: Prisma.TransactionClient, userId: string, branchIds: string[]) {
  await tx.userBranch.deleteMany({ where: { userId } });
  if (branchIds.length) {
    await tx.userBranch.createMany({
      data: branchIds.map((branchId) => ({ userId, branchId })),
      skipDuplicates: true,
    });
  }
}

function ensureHubRule(role: UserRole, hubIds: string[]): { error: string } | undefined {
  if (isRoleAdminOrHq(role)) return undefined;
  if (!hubIds.length) return { error: "At least one hub is required" };
  return undefined;
}

async function setUserHubsTx(tx: Prisma.TransactionClient, userId: string, hubIds: string[]) {
  await tx.userHub.deleteMany({ where: { userId } });
  if (hubIds.length) {
    await tx.userHub.createMany({
      data: hubIds.map((hubId) => ({ userId, hubId })),
      skipDuplicates: true,
    });
  }
}

async function getUserForAdminMutation(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    include: { branches: true, hubs: true },
  });
}

export async function createUserForAdmin(
  session: MockSession,
  input: CreateAdminUserInput,
): Promise<{ user: User; generatedPassword?: string } | { error: string }> {
  const accessError = enforceAdminAccess(session);
  if (accessError) return accessError;

  const name = input.name.trim();
  const username = normalizeUsername(input.username);
  if (!name) return { error: "Name is required" };
  if (!username) return { error: "Username is required" };

  const branchIds = Array.from(new Set(input.branchIds ?? [])).filter(Boolean);
  const hubIds = Array.from(new Set(input.hubIds ?? [])).filter(Boolean);
  const branchRuleError = ensureBranchRule(input.role, branchIds);
  if (branchRuleError) return branchRuleError;
  const hubRuleError = ensureHubRule(input.role, hubIds);
  if (hubRuleError) return hubRuleError;

  let plainPassword: string | undefined;
  if (input.passwordMode === "set") {
    if (!input.password) return { error: "Password is required" };
    if (input.password.length < 8) {
      return { error: "Password must be at least 8 characters" };
    }
    plainPassword = input.password;
  } else if (input.passwordMode === "generate") {
    plainPassword = generatePassword();
  } else {
    return { error: "Invalid passwordMode" };
  }

  const passwordHash = await hashPassword(plainPassword);
  let id = userIdFromUsername(username);
  const idTaken = await prisma.user.findUnique({
    where: { id },
    select: { id: true },
  });
  if (idTaken) {
    id = `user_${randomUUID()}`;
  }

  try {
    const user = await prisma.user.create({
      data: {
        id,
        username,
        name,
        role: input.role,
        passwordHash,
        isActive: true,
        branches: {
          create: branchIds.map((branchId) => ({ branchId })),
        },
        hubs: {
          create: hubIds.map((hubId) => ({ hubId })),
        },
      },
      include: { branches: true, hubs: true },
    });

    const mapped = mapUser(user);
    if (input.passwordMode === "generate") {
      return { user: mapped, generatedPassword: plainPassword };
    }
    return { user: mapped };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { error: "Username already exists" };
    }
    return { error: "Failed to create user" };
  }
}

export async function updateUserForAdmin(
  session: MockSession,
  userId: string,
  input: UpdateAdminUserInput,
): Promise<{ user: User } | { error: string }> {
  const accessError = enforceAdminAccess(session);
  if (accessError) return accessError;

  const existing = await getUserForAdminMutation(userId);
  if (!existing) return { error: "User not found" };

  if (input.isActive === false && session.userId === userId) {
    return { error: "You cannot disable yourself" };
  }

  const nextRole = input.role ?? (existing.role as UserRole);
  const nextBranchIds = input.branchIds
    ? Array.from(new Set(input.branchIds)).filter(Boolean)
    : existing.branches.map((b) => b.branchId);
  const nextHubIds = input.hubIds
    ? Array.from(new Set(input.hubIds)).filter(Boolean)
    : existing.hubs.map((h) => h.hubId);

  const branchRuleError = ensureBranchRule(nextRole, nextBranchIds);
  if (branchRuleError) return branchRuleError;
  const hubRuleError = ensureHubRule(nextRole, nextHubIds);
  if (hubRuleError) return hubRuleError;

  const nextName = input.name !== undefined ? input.name.trim() : undefined;
  if (input.name !== undefined && !nextName) return { error: "Name is required" };

  try {
    const updated = await prisma.$transaction(async (tx) => {
      if (input.branchIds) {
        await setUserBranchesTx(tx, userId, nextBranchIds);
      }
      if (input.hubIds) {
        await setUserHubsTx(tx, userId, nextHubIds);
      }

      return tx.user.update({
        where: { id: userId },
        data: {
          name: nextName,
          role: input.role,
          isActive: input.isActive,
        },
        include: { branches: true, hubs: true },
      });
    });

    return { user: mapUser(updated) };
  } catch {
    return { error: "Failed to update user" };
  }
}

export async function setUserActiveForAdmin(
  session: MockSession,
  userId: string,
  isActive: boolean,
): Promise<{ user: User } | { error: string }> {
  return updateUserForAdmin(session, userId, { isActive });
}

export async function resetPasswordForAdmin(
  session: MockSession,
  userId: string,
  input: ResetAdminUserPasswordInput,
): Promise<{ success: true; generatedPassword?: string } | { error: string }> {
  const accessError = enforceAdminAccess(session);
  if (accessError) return accessError;

  const existing = await prisma.user.findUnique({ where: { id: userId } });
  if (!existing) return { error: "User not found" };

  let plainPassword: string | undefined;
  if (input.passwordMode === "set") {
    if (!input.password) return { error: "Password is required" };
    if (input.password.length < 8) {
      return { error: "Password must be at least 8 characters" };
    }
    plainPassword = input.password;
  } else if (input.passwordMode === "generate") {
    plainPassword = generatePassword();
  } else {
    return { error: "Invalid passwordMode" };
  }

  const passwordHash = await hashPassword(plainPassword);

  try {
    await prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        sessionVersion: { increment: 1 },
      },
    });

    if (input.passwordMode === "generate") {
      return { success: true, generatedPassword: plainPassword };
    }
    return { success: true };
  } catch {
    return { error: "Failed to reset password" };
  }
}
