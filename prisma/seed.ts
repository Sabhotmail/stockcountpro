import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/auth/password";
import { mockBranches } from "../src/mock/branches";
import { DEFAULT_SEED_PASSWORD, ADMIN_SEED_PASSWORD, mockUsers } from "../src/mock/users";

const prisma = new PrismaClient();

async function main() {
  await prisma.recountRequestItem.deleteMany();
  await prisma.recountRequest.deleteMany();
  await prisma.finalCountEntry.deleteMany();
  await prisma.entrySnapshot.deleteMany();
  await prisma.countEntry.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.countVersion.deleteMany();
  await prisma.productLine.deleteMany();
  await prisma.countDocument.deleteMany();
  await prisma.userBranch.deleteMany();
  await prisma.user.deleteMany();
  await prisma.branchExpressLocation.deleteMany();
  await prisma.branch.deleteMany();
  await prisma.countLineLock.deleteMany();
  await prisma.appSetting.deleteMany();

  for (const branch of mockBranches) {
    await prisma.branch.create({
      data: {
        id: branch.id,
        code: branch.code,
        name: branch.name,
        expressLocations: {
          create: branch.expressLocationCodes.map((locationCode) => ({
            locationCode,
          })),
        },
      },
    });
  }

  const defaultPasswordHash = await hashPassword(DEFAULT_SEED_PASSWORD);
  const adminPasswordHash = await hashPassword(ADMIN_SEED_PASSWORD);

  for (const user of mockUsers) {
    await prisma.user.create({
      data: {
        id: user.id,
        username: user.username,
        name: user.name,
        passwordHash:
          user.id === "user_admin" ? adminPasswordHash : defaultPasswordHash,
        role: user.role,
        isActive: true,
        branches: {
          create: user.branchIds.map((branchId) => ({ branchId })),
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
