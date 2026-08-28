/**
 * Clear transactional / test count data so the DB is ready for real use.
 * Keeps users, branch/hub masters, user assignments, and app settings.
 *
 * Usage:
 *   npm run db:clear-operational
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function counts() {
  const [
    users,
    userBranches,
    userHubs,
    branches,
    hubs,
    appSettings,
    countDocuments,
    productLines,
    countVersions,
    countEntries,
    countLineLocks,
    entrySnapshots,
    finalCountEntries,
    recountRequests,
    recountRequestItems,
    auditLogs,
    processedMutations,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.userBranch.count(),
    prisma.userHub.count(),
    prisma.branch.count(),
    prisma.hub.count(),
    prisma.appSetting.count(),
    prisma.countDocument.count(),
    prisma.productLine.count(),
    prisma.countVersion.count(),
    prisma.countEntry.count(),
    prisma.countLineLock.count(),
    prisma.entrySnapshot.count(),
    prisma.finalCountEntry.count(),
    prisma.recountRequest.count(),
    prisma.recountRequestItem.count(),
    prisma.auditLog.count(),
    prisma.processedMutation.count(),
  ]);

  return {
    keep: { users, userBranches, userHubs, branches, hubs, appSettings },
    clear: {
      countDocuments,
      productLines,
      countVersions,
      countEntries,
      countLineLocks,
      entrySnapshots,
      finalCountEntries,
      recountRequests,
      recountRequestItems,
      auditLogs,
      processedMutations,
    },
  };
}

async function main() {
  const before = await counts();
  console.log("Before:", JSON.stringify(before, null, 2));

  await prisma.$transaction([
    prisma.recountRequestItem.deleteMany(),
    prisma.recountRequest.deleteMany(),
    prisma.finalCountEntry.deleteMany(),
    prisma.entrySnapshot.deleteMany(),
    prisma.countEntry.deleteMany(),
    prisma.countLineLock.deleteMany(),
    prisma.countDocumentPresence.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.countVersion.deleteMany(),
    prisma.productLine.deleteMany(),
    prisma.processedMutation.deleteMany(),
    prisma.countDocument.deleteMany(),
  ]);

  const after = await counts();
  console.log("After:", JSON.stringify(after, null, 2));

  const remainingUsers = await prisma.user.findMany({
    select: { username: true, name: true, role: true, isActive: true },
    orderBy: { username: "asc" },
  });
  console.log(
    `Kept ${remainingUsers.length} user(s):`,
    remainingUsers
      .map((user) => `${user.username} (${user.role}${user.isActive ? "" : ", inactive"})`)
      .join(", ") || "(none)",
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
