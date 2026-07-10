import type { Branch } from "@/types/user";

export const mockBranches: Branch[] = [
  {
    id: "branch_bkk1",
    code: "BKK1",
    name: "กรุงเทพ 1",
    expressLocationPrefix: "32",
    isActive: true,
  },
  {
    id: "branch_bkk2",
    code: "BKK2",
    name: "กรุงเทพ 2",
    expressLocationPrefix: "24",
    isActive: true,
  },
  {
    id: "branch_chm",
    code: "CHM",
    name: "เชียงใหม่",
    expressLocationPrefix: null,
    isActive: true,
  },
  {
    id: "branch_srb",
    code: "SRB",
    name: "สระบุรี",
    expressLocationPrefix: null,
    isActive: true,
  },
];

export function getBranchById(id: string): Branch | undefined {
  return mockBranches.find((b) => b.id === id);
}

export function getBranchByCode(code: string): Branch | undefined {
  return mockBranches.find((b) => b.code === code);
}
