import type { User } from "@/types/user";
import { UserRole } from "@/types/user";

/**
 * Local seed user roster for `prisma db seed` only.
 * Passwords come from env via `src/lib/auth/bootstrap-config.ts` — not from this file.
 * Production should use `npm run db:bootstrap-admin` instead of wiping seed.
 */
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
