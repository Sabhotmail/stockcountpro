import type { User } from "@/types/user";
import { UserRole } from "@/types/user";

export const mockUsers: User[] = [
  {
    id: "user_admin",
    name: "Admin",
    role: UserRole.ADMIN,
    branchIds: ["branch_bkk1", "branch_bkk2", "branch_chm", "branch_srb"],
  },
  {
    id: "user_bkk1_supervisor",
    name: "BKK1 Supervisor",
    role: UserRole.SUPERVISOR,
    branchIds: ["branch_bkk1"],
  },
  {
    id: "user_bkk1_staff",
    name: "BKK1 Staff",
    role: UserRole.STAFF,
    branchIds: ["branch_bkk1"],
  },
  {
    id: "user_bkk2_staff",
    name: "BKK2 Staff",
    role: UserRole.STAFF,
    branchIds: ["branch_bkk2"],
  },
];

export function getUserById(id: string): User | undefined {
  return mockUsers.find((u) => u.id === id);
}
