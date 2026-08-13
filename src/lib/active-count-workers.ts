import type { LineLockInfo } from "@/types/count";

export type ActiveCountWorker = {
  userId: string;
  name: string;
  lineCount: number;
  isCurrentUser: boolean;
};

export function listActiveCountWorkers(
  locks: Iterable<LineLockInfo>,
  currentUserId: string | null,
  nowMs = Date.now(),
): ActiveCountWorker[] {
  const byUser = new Map<string, ActiveCountWorker>();

  for (const lock of locks) {
    if (Date.parse(lock.expiresAt) <= nowMs) continue;
    const existing = byUser.get(lock.lockedByUserId);
    if (existing) {
      existing.lineCount += 1;
      continue;
    }
    byUser.set(lock.lockedByUserId, {
      userId: lock.lockedByUserId,
      name: lock.lockedByUserName,
      lineCount: 1,
      isCurrentUser: currentUserId !== null && lock.lockedByUserId === currentUserId,
    });
  }

  return [...byUser.values()].sort((a, b) => {
    if (a.isCurrentUser !== b.isCurrentUser) return a.isCurrentUser ? -1 : 1;
    return a.name.localeCompare(b.name, "th");
  });
}
