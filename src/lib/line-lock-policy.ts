/** Line locks are only needed when someone else is also on the document. */
export function shouldEnforceLineLocks(
  activeUserIds: readonly string[],
  currentUserId: string,
): boolean {
  if (!currentUserId) return false;
  return activeUserIds.some((id) => id !== currentUserId);
}
