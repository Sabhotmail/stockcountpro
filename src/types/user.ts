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
  expressLocationCodes: string[];
}

export interface User {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  branchIds: string[];
}

export interface MockSession {
  userId: string;
  userName: string;
  role: UserRole;
  branchIds: string[];
}
