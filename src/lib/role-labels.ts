import { UserRole } from "@/types/user";

/** Display labels for roles (UI only — DB/API still use UserRole enum values). */
export const ROLE_LABEL: Record<UserRole, string> = {
  [UserRole.ADMIN]: "ผู้ดูแลระบบ",
  [UserRole.HQ]: "สำนักงานใหญ่",
  [UserRole.SUPERVISOR]: "หัวหน้างาน",
  [UserRole.BRANCH_MANAGER]: "ผู้จัดการสาขา",
  [UserRole.STAFF]: "พนักงาน",
  [UserRole.COUNTER]: "ผู้นับ",
  [UserRole.VIEWER]: "ดูอย่างเดียว",
};

export const ROLE_OPTIONS: UserRole[] = [
  UserRole.ADMIN,
  UserRole.HQ,
  UserRole.SUPERVISOR,
  UserRole.BRANCH_MANAGER,
  UserRole.STAFF,
  UserRole.COUNTER,
  UserRole.VIEWER,
];
