import type { User } from "@/types/user";
import { UserRole } from "@/types/user";

/**
 * Local seed user roster for `prisma db seed` only.
 * Only bootstrap admin — create other users in Admin UI.
 * Password comes from ADMIN_BOOTSTRAP_PASSWORD via bootstrap-config.
 * Production should use `npm run db:bootstrap-admin` instead of wipe seed.
 */
export const mockUsers: Array<User & { username: string }> = [
  {
    id: "user_admin",
    username: "admin",
    name: "Admin",
    role: UserRole.ADMIN,
    isActive: true,
    sessionVersion: 0,
    branchIds: ["branch_bkk3"],
    hubIds: [],
  },
];
