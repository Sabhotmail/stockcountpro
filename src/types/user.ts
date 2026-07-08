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
}

export interface User {
  id: string;
  name: string;
  role: UserRole;
  branchIds: string[];
}

export interface MockSession {
  userId: string;
  userName: string;
  role: UserRole;
  branchIds: string[];
}
