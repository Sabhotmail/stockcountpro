import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/auth/password";
import { ADMIN_SEED_PASSWORD } from "../src/mock/users";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await hashPassword(ADMIN_SEED_PASSWORD);
  const result = await prisma.user.updateMany({
    where: { username: "admin" },
    data: { passwordHash },
  });
  console.log(`Updated admin users: ${result.count}`);
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
