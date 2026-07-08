import type { Branch } from "@/types/user";

export const mockBranches: Branch[] = [
  {
    id: "branch_bkk1",
    code: "BKK1",
    name: "กรุงเทพ 1",
    expressLocationCode: "32D1",
  },
  {
    id: "branch_bkk2",
    code: "BKK2",
    name: "กรุงเทพ 2",
    expressLocationCode: "32F1",
  },
  {
    id: "branch_chm",
    code: "CHM",
    name: "เชียงใหม่",
    expressLocationCode: "32G1",
  },
  { id: "branch_srb", code: "SRB", name: "สระบุรี" },
];

export function getBranchById(id: string): Branch | undefined {
  return mockBranches.find((b) => b.id === id);
}

export function getBranchByCode(code: string): Branch | undefined {
  return mockBranches.find((b) => b.code === code);
}
