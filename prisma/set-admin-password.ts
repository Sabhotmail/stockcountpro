import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/auth/password";
import { resolveAdminBootstrapConfig } from "../src/lib/auth/bootstrap-config";

/**
 * Reset the bootstrap admin password from env (always updates).
 * Prefer `db:bootstrap-admin` for first-time create; use this when you need a forced reset
 * without setting ADMIN_BOOTSTRAP_FORCE.
 */
const prisma = new PrismaClient();

async function main() {
  const config = resolveAdminBootstrapConfig({ requirePassword: true });
  const passwordHash = await hashPassword(config.password);

  const result = await prisma.user.updateMany({
    where: { username: config.username },
    data: {
      passwordHash,
      isActive: true,
    },
  });

  if (result.count === 0) {
    console.error(
      `No user with username "${config.username}". Run: npm run db:bootstrap-admin`,
    );
    process.exit(1);
  }

  console.log(`Updated password for admin user "${config.username}".`);
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
