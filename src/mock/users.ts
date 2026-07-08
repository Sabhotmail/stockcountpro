import type { User } from "@/types/user";
import { UserRole } from "@/types/user";

export const DEFAULT_SEED_PASSWORD = "StockCount1!";

export const mockUsers: Array<User & { username: string }> = [
  {
    id: "user_admin",
    username: "admin",
    name: "Admin",
    role: UserRole.ADMIN,
    branchIds: ["branch_bkk1", "branch_bkk2", "branch_chm", "branch_srb"],
  },
  {
    id: "user_bkk1_supervisor",
    username: "bkk1.supervisor",
    name: "BKK1 Supervisor",
    role: UserRole.SUPERVISOR,
    branchIds: ["branch_bkk1"],
  },
  {
    id: "user_bkk1_staff",
    username: "bkk1.staff",
    name: "BKK1 Staff",
    role: UserRole.STAFF,
    branchIds: ["branch_bkk1"],
  },
  {
    id: "user_bkk2_staff",
    username: "bkk2.staff",
    name: "BKK2 Staff",
    role: UserRole.STAFF,
    branchIds: ["branch_bkk2"],
  },
];
