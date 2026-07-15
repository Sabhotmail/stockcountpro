/**
 * Create the first ADMIN user from env secrets (idempotent).
 *
 * Usage (production deploy):
 *   ADMIN_BOOTSTRAP_PASSWORD='...' npm run db:bootstrap-admin
 *
 * Behavior:
 * - If admin username already exists and ADMIN_BOOTSTRAP_FORCE is not set → no-op
 * - If missing → create ADMIN and attach to branch by ADMIN_BOOTSTRAP_BRANCH_CODE (if present)
 * - If ADMIN_BOOTSTRAP_FORCE=1 → reset password (and reactivate) for that username
 */

import { PrismaClient, UserRole } from "@prisma/client";
import { hashPassword } from "../src/lib/auth/password";
import { resolveAdminBootstrapConfig } from "../src/lib/auth/bootstrap-config";

const prisma = new PrismaClient();

async function main() {
  const config = resolveAdminBootstrapConfig({ requirePassword: true });
  const passwordHash = await hashPassword(config.password);

  const existing = await prisma.user.findUnique({
    where: { username: config.username },
    include: { branches: true },
  });

  const branch = config.branchCode
    ? await prisma.branch.findUnique({ where: { code: config.branchCode } })
    : null;

  if (existing && !config.force) {
    console.log(
      `Admin user "${config.username}" already exists — skipping (set ADMIN_BOOTSTRAP_FORCE=1 to reset password).`,
    );
    return;
  }

  if (existing && config.force) {
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: existing.id },
        data: {
          name: config.name,
          passwordHash,
          role: UserRole.ADMIN,
          isActive: true,
        },
      });

      if (branch) {
        const hasBranch = existing.branches.some(
          (row) => row.branchId === branch.id,
        );
        if (!hasBranch) {
          await tx.userBranch.create({
            data: { userId: existing.id, branchId: branch.id },
          });
        }
      }
    });

    console.log(
      `Reset password for admin user "${config.username}" (FORCE).`,
    );
    return;
  }

  const userId = `user_${config.username}`.replace(/[^a-z0-9_]/gi, "_");

  await prisma.user.create({
    data: {
      id: userId,
      username: config.username,
      name: config.name,
      passwordHash,
      role: UserRole.ADMIN,
      isActive: true,
      branches: branch
        ? { create: [{ branchId: branch.id }] }
        : undefined,
    },
  });

  console.log(
    `Created admin user "${config.username}"${
      branch ? ` (branch ${branch.code})` : " (no branch linked — create branch first or set ADMIN_BOOTSTRAP_BRANCH_CODE)"
    }.`,
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
