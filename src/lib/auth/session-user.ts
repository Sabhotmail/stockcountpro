import { prisma } from "@/lib/prisma";

export async function getSessionAuthState(
  userId: string,
  tokenSessionVersion: number,
): Promise<"ok" | "invalid"> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isActive: true, sessionVersion: true },
  });
  if (!user || !user.isActive) return "invalid";
  if (user.sessionVersion !== tokenSessionVersion) return "invalid";
  return "ok";
}

export async function bumpSessionVersion(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { sessionVersion: { increment: 1 } },
  });
}
