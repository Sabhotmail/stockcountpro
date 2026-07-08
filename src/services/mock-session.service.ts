import { MOCK_SESSION_COOKIE } from "@/lib/mock-session";
import type { MockSession } from "@/types/user";
import { getUserById } from "@/services/user.service";
import { cookies } from "next/headers";

export async function getServerSession(): Promise<MockSession | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(MOCK_SESSION_COOKIE)?.value;
  if (!raw) return null;

  try {
    return JSON.parse(decodeURIComponent(raw)) as MockSession;
  } catch {
    return null;
  }
}

export async function buildSessionFromUserId(
  userId: string,
): Promise<MockSession | null> {
  const user = await getUserById(userId);
  if (!user) return null;

  return {
    userId: user.id,
    userName: user.name,
    role: user.role,
    branchIds: user.branchIds,
  };
}
