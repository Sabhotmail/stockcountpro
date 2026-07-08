import { DocumentStatus } from "@/types/count";
import { UserRole } from "@/types/user";

export function canAccessBranch(
  role: UserRole,
  userBranchIds: string[],
  branchId: string,
): boolean {
  if (role === UserRole.ADMIN || role === UserRole.HQ) return true;
  return userBranchIds.includes(branchId);
}

export function canViewExpectedQty(role: UserRole): boolean {
  return (
    role === UserRole.ADMIN ||
    role === UserRole.HQ ||
    role === UserRole.SUPERVISOR ||
    role === UserRole.BRANCH_MANAGER
  );
}

export function isReadOnlyRole(role: UserRole): boolean {
  return role === UserRole.VIEWER;
}

export function filterDocumentsForStaff(status: DocumentStatus): boolean {
  return status !== DocumentStatus.COMPLETED;
}

export function filterDocumentsForSupervisor(status: DocumentStatus): boolean {
  return (
    status === DocumentStatus.SUBMITTED ||
    status === DocumentStatus.RECOUNT_REQUESTED ||
    status === DocumentStatus.REVIEWING
  );
}

export function canSupervise(role: UserRole): boolean {
  return (
    role === UserRole.ADMIN ||
    role === UserRole.HQ ||
    role === UserRole.SUPERVISOR ||
    role === UserRole.BRANCH_MANAGER
  );
}

export function getHomePathForRole(role: UserRole): string {
  if (role === UserRole.ADMIN || role === UserRole.HQ) return "/admin/users";
  if (canSupervise(role)) return "/supervisor/documents";
  return "/tablet/documents";
}

export function canAccessAdmin(role: UserRole): boolean {
  return role === UserRole.ADMIN || role === UserRole.HQ;
}

export function canMutateCount(role: UserRole): boolean {
  if (isReadOnlyRole(role)) return false;
  return (
    role === UserRole.STAFF ||
    role === UserRole.COUNTER ||
    role === UserRole.ADMIN ||
    role === UserRole.HQ
  );
}
