import { PrismaClient } from "@prisma/client";
import {
  resolveAdminBootstrapConfig,
  resolveSeedUserPassword,
} from "../src/lib/auth/bootstrap-config";
import { hashPassword } from "../src/lib/auth/password";
import { mockBranches, mockHubs } from "../src/mock/branches";
import { mockUsers } from "../src/mock/users";

/**
 * Local / staging wipe-and-seed. Do not use as the production bootstrap path.
 * Production: migrate deploy + `npm run db:bootstrap-admin` with secrets.
 */
const prisma = new PrismaClient();

async function main() {
  const adminConfig = resolveAdminBootstrapConfig({
    requirePassword: process.env.NODE_ENV === "production",
  });
  const seedUserPassword = resolveSeedUserPassword();

  await prisma.recountRequestItem.deleteMany();
  await prisma.recountRequest.deleteMany();
  await prisma.finalCountEntry.deleteMany();
  await prisma.entrySnapshot.deleteMany();
  await prisma.countEntry.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.countVersion.deleteMany();
  await prisma.productLine.deleteMany();
  await prisma.countDocument.deleteMany();
  await prisma.userHub.deleteMany();
  await prisma.userBranch.deleteMany();
  await prisma.user.deleteMany();
  await prisma.hub.deleteMany();
  await prisma.branch.deleteMany();
  await prisma.countLineLock.deleteMany();
  await prisma.appSetting.deleteMany();

  for (const branch of mockBranches) {
    await prisma.branch.create({
      data: {
        id: branch.id,
        code: branch.code,
        name: branch.name,
        expressLocationPrefix: branch.expressLocationPrefix,
        isActive: branch.isActive,
      },
    });
  }

  for (const hub of mockHubs) {
    await prisma.hub.create({
      data: {
        id: hub.id,
        branchId: hub.branchId,
        code: hub.code,
        name: hub.name,
        shortName: hub.shortName,
        suffixLetter: hub.suffixLetter,
        isActive: hub.isActive,
      },
    });
  }

  const defaultPasswordHash = await hashPassword(seedUserPassword);
  const adminPasswordHash = await hashPassword(adminConfig.password);

  for (const user of mockUsers) {
    const isAdmin = user.username === "admin" || user.id === "user_admin";
    await prisma.user.create({
      data: {
        id: isAdmin ? `user_${adminConfig.username}` : user.id,
        username: isAdmin ? adminConfig.username : user.username,
        name: isAdmin ? adminConfig.name : user.name,
        passwordHash: isAdmin ? adminPasswordHash : defaultPasswordHash,
        role: user.role,
        isActive: true,
        branches: {
          create: user.branchIds.map((branchId) => ({ branchId })),
        },
        hubs: {
          create: user.hubIds.map((hubId) => ({ hubId })),
        },
      },
    });
  }

  await prisma.appSetting.create({
    data: {
      id: "default",
      lineLockTtlSeconds: 30,
      updatedAt: new Date(),
    },
  });

  console.log(
    `Seeded users. Admin username: "${adminConfig.username}" (password from ADMIN_BOOTSTRAP_PASSWORD or local fallback).`,
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
