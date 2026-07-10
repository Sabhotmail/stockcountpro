import type { Branch } from "@/types/user";

export const mockBranches: Branch[] = [
  {
    id: "branch_bkk3",
    code: "BKK3",
    name: "กรุงเทพ 3",
    expressLocationPrefix: "24",
    isActive: true,
  },
  {
    id: "branch_bkk1",
    code: "BKK1",
    name: "กรุงเทพ 1",
    expressLocationPrefix: "32",
    isActive: false,
  },
  {
    id: "branch_bkk2",
    code: "BKK2",
    name: "กรุงเทพ 2",
    expressLocationPrefix: null,
    isActive: false,
  },
  {
    id: "branch_chm",
    code: "CHM",
    name: "เชียงใหม่",
    expressLocationPrefix: null,
    isActive: false,
  },
  {
    id: "branch_srb",
    code: "SRB",
    name: "สระบุรี",
    expressLocationPrefix: null,
    isActive: false,
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

export function getBranchById(id: string): Branch | undefined {
  return mockBranches.find((b) => b.id === id);
}

export function getBranchByCode(code: string): Branch | undefined {
  return mockBranches.find((b) => b.code === code);
}
