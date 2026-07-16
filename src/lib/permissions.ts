import { DocumentStatus, VersionStatus } from "@/types/count";
import { UserRole } from "@/types/user";

export function canAccessBranch(
  role: UserRole,
  userBranchIds: string[],
  branchId: string,
): boolean {
  if (role === UserRole.ADMIN || role === UserRole.HQ) return true;
  return userBranchIds.includes(branchId);
}

export function canAccessCentralDocuments(role: UserRole): boolean {
  return role === UserRole.ADMIN || role === UserRole.HQ;
}

export function canAccessHub(
  role: UserRole,
  userHubIds: string[],
  hubId: string,
): boolean {
  if (role === UserRole.ADMIN || role === UserRole.HQ) return true;
  return userHubIds.includes(hubId);
}

export function canAccessDocument(
  role: UserRole,
  userBranchIds: string[],
  userHubIds: string[],
  document: {
    branchId: string;
    hubId: string | null;
    isCentral: boolean;
  },
): boolean {
  if (!canAccessBranch(role, userBranchIds, document.branchId)) {
    return false;
  }

  if (document.isCentral) {
    return canAccessCentralDocuments(role);
  }

  if (document.hubId) {
    return canAccessHub(role, userHubIds, document.hubId);
  }

  return true;
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

/** Document can be edited on tablet when counting or after recount was requested. */
export function isCountDocumentEditable(
  status: DocumentStatus,
  versionStatus: VersionStatus | string | null | undefined,
): boolean {
  return (
    (status === DocumentStatus.COUNTING ||
      status === DocumentStatus.RECOUNT_REQUESTED) &&
    versionStatus === VersionStatus.DRAFT
  );
}

export function filterDocumentsForSupervisor(status: DocumentStatus): boolean {
  return (
    status === DocumentStatus.SUBMITTED ||
    status === DocumentStatus.RECOUNT_REQUESTED ||
    status === DocumentStatus.REVIEWING
  );
}

/** Completed docs supervisors/HQ can open for printing. */
export function filterDocumentsForSupervisorPrint(
  status: DocumentStatus,
): boolean {
  return status === DocumentStatus.COMPLETED;
}

/** Supervisor may request full-document recount (incl. after Express push). */
export function canRequestRecount(status: DocumentStatus): boolean {
  return (
    status === DocumentStatus.SUBMITTED ||
    status === DocumentStatus.REVIEWING ||
    status === DocumentStatus.COMPLETED
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
  if (role === UserRole.ADMIN || role === UserRole.HQ) return "/admin/documents";
  if (canSupervise(role)) return "/supervisor/documents";
  return "/tablet/documents";
}

export function canAccessAdmin(role: UserRole): boolean {
  return role === UserRole.ADMIN || role === UserRole.HQ;
}

/** System config: users, branches, hubs, app settings — Admin only (not HQ). */
export function canManageSystem(role: UserRole): boolean {
  return role === UserRole.ADMIN;
}

export function canMutateCount(role: UserRole): boolean {
  if (isReadOnlyRole(role)) return false;
  return (
    role === UserRole.STAFF ||
    role === UserRole.COUNTER ||
    role === UserRole.SUPERVISOR ||
    role === UserRole.BRANCH_MANAGER ||
    role === UserRole.ADMIN ||
    role === UserRole.HQ
  );
}

export function canSyncExpress(role: UserRole): boolean {
  if (isReadOnlyRole(role)) return false;
  return (
    role === UserRole.STAFF ||
    role === UserRole.COUNTER ||
    role === UserRole.SUPERVISOR ||
    role === UserRole.BRANCH_MANAGER ||
    role === UserRole.ADMIN ||
    role === UserRole.HQ
  );
}

export function canDeleteImportedDocument(role: UserRole): boolean {
  return canSyncExpress(role);
}

/** Delete stock count from Express + app (Admin/HQ/Supervisor only). */
export function canDeleteExpressStockCount(role: UserRole): boolean {
  return (
    role === UserRole.ADMIN ||
    role === UserRole.HQ ||
    role === UserRole.SUPERVISOR
  );
}

/** Push completed counts back to Express (manual button). */
export function canPushToExpress(role: UserRole): boolean {
  return canSupervise(role);
}
