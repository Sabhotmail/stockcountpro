import type { Branch } from "@/types/user";

export const mockBranches: Branch[] = [
  { id: "branch_bkk1", code: "BKK1", name: "กรุงเทพ 1" },
  { id: "branch_bkk2", code: "BKK2", name: "กรุงเทพ 2" },
  { id: "branch_chm", code: "CHM", name: "เชียงใหม่" },
  { id: "branch_srb", code: "SRB", name: "สระบุรี" },
];

export function getBranchById(id: string): Branch | undefined {
  return mockBranches.find((b) => b.id === id);
}

export function getBranchByCode(code: string): Branch | undefined {
  return mockBranches.find((b) => b.code === code);
}
