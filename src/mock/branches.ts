import type { Branch } from "@/types/user";

/** Seed data for `prisma db seed` — runtime data comes from Prisma. */
export const mockBranches: Branch[] = [
  {
    id: "branch_bkk3",
    code: "BKK3",
    name: "กรุงเทพ 3",
    expressLocationPrefix: "24",
    isActive: true,
  },
];

export const mockHubs = [
  {
    id: "hub_bkk3_1",
    branchId: "branch_bkk3",
    code: "1",
    name: "เชียงใหม่",
    shortName: "CHM",
    suffixLetter: "A",
    isActive: true,
  },
  {
    id: "hub_bkk3_2",
    branchId: "branch_bkk3",
    code: "2",
    name: "พิษณุโลก",
    shortName: "PNL",
    suffixLetter: "B",
    isActive: true,
  },
] as const;
