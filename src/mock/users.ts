import type { User } from "@/types/user";
import { UserRole } from "@/types/user";

/** Seed passwords for `prisma db seed` / set-admin-password — not shown in the UI. */
export const DEFAULT_SEED_PASSWORD = "StockCount1!";
export const ADMIN_SEED_PASSWORD = "12345678";

/** Dev seed users for `prisma db seed` — runtime auth reads from Prisma. */
export const mockUsers: Array<User & { username: string }> = [
  {
    id: "user_admin",
    username: "admin",
    name: "Admin",
    role: UserRole.ADMIN,
    isActive: true,
    branchIds: ["branch_bkk3"],
    hubIds: [],
  },
  {
    id: "user_hq",
    username: "hq",
    name: "HQ Accounting",
    role: UserRole.HQ,
    isActive: true,
    branchIds: ["branch_bkk3"],
    hubIds: [],
  },
  {
    id: "user_chm_staff",
    username: "chm.staff",
    name: "CHM Staff",
    role: UserRole.STAFF,
    isActive: true,
    branchIds: ["branch_bkk3"],
    hubIds: ["hub_bkk3_1"],
  },
  {
    id: "user_pnl_staff",
    username: "pnl.staff",
    name: "PNL Staff",
    role: UserRole.STAFF,
    isActive: true,
    branchIds: ["branch_bkk3"],
    hubIds: ["hub_bkk3_2"],
  },
  {
    id: "user_chm_supervisor",
    username: "chm.supervisor",
    name: "CHM Supervisor",
    role: UserRole.SUPERVISOR,
    isActive: true,
    branchIds: ["branch_bkk3"],
    hubIds: ["hub_bkk3_1"],
  },
];
