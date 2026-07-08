import { getUserById } from "@/mock/users";
import { MOCK_SESSION_COOKIE } from "@/lib/mock-session";
import type { MockSession } from "@/types/user";
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

export function buildSessionFromUserId(userId: string): MockSession | null {
  const user = getUserById(userId);
  if (!user) return null;

  return {
    userId: user.id,
    userName: user.name,
    role: user.role,
    branchIds: user.branchIds,
  };
}
