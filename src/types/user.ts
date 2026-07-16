export enum UserRole {
  ADMIN = "ADMIN",
  HQ = "HQ",
  SUPERVISOR = "SUPERVISOR",
  BRANCH_MANAGER = "BRANCH_MANAGER",
  STAFF = "STAFF",
  COUNTER = "COUNTER",
  VIEWER = "VIEWER",
}

export interface Branch {
  id: string;
  code: string;
  name: string;
  expressLocationPrefix: string | null;
  isActive: boolean;
}

export interface Hub {
  id: string;
  branchId: string;
  code: string;
  name: string;
  shortName: string | null;
  suffixLetter: string | null;
  isActive: boolean;
}

export interface User {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  sessionVersion: number;
  branchIds: string[];
  hubIds: string[];
}

export interface MockSession {
  userId: string;
  userName: string;
  role: UserRole;
  branchIds: string[];
  hubIds: string[];
  sessionVersion: number;
}
