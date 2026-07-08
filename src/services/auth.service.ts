import { verifyPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/prisma";
import { UserRole, type MockSession } from "@/types/user";

export async function authenticateUser(
  username: string,
  password: string,
): Promise<MockSession | null> {
  const normalizedUsername = username.trim().toLowerCase();
  if (!normalizedUsername || !password) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { username: normalizedUsername },
    include: { branches: true },
  });

  if (!user || !user.isActive) {
    return null;
  }

  const passwordOk = await verifyPassword(password, user.passwordHash);
  if (!passwordOk) {
    return null;
  }

  return {
    userId: user.id,
    userName: user.name,
    role: user.role as UserRole,
    branchIds: user.branches.map((branch) => branch.branchId),
  };
}
