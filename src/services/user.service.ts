import { prisma } from "@/lib/prisma";
import { mapUser } from "@/lib/db/mappers";
import type { User } from "@/types/user";

export async function getUserById(id: string): Promise<User | undefined> {
  const user = await prisma.user.findUnique({
    where: { id },
    include: { branches: true },
  });

  return user ? mapUser(user) : undefined;
}

export async function listUsers(): Promise<User[]> {
  const users = await prisma.user.findMany({
    include: { branches: true },
    orderBy: { name: "asc" },
  });

  return users.map(mapUser);
}
