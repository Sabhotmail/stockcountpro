export enum AuditAction {
  LOGIN = "LOGIN",
  OPEN_DOCUMENT = "OPEN_DOCUMENT",
  START_COUNT = "START_COUNT",
  AUTO_SAVE_COUNT = "AUTO_SAVE_COUNT",
  SUBMIT_TO_SUPERVISOR = "SUBMIT_TO_SUPERVISOR",
  CREATE_VERSION = "CREATE_VERSION",
  REQUEST_RECOUNT = "REQUEST_RECOUNT",
  APPROVE_VERSION = "APPROVE_VERSION",
  COMPLETE_DOCUMENT = "COMPLETE_DOCUMENT",
  IMPORT_FROM_EXPRESS = "IMPORT_FROM_EXPRESS",
  DELETE_DOCUMENT = "DELETE_DOCUMENT",
  DELETE_EXPRESS_STOCK_COUNT = "DELETE_EXPRESS_STOCK_COUNT",
  PUSH_TO_EXPRESS = "PUSH_TO_EXPRESS",
}

export interface AuditLog {
  id: string;
  action: AuditAction;
  userId: string;
  userName: string;
  branchId?: string;
  documentId?: string;
  versionId?: string;
  lineId?: string;
  detail?: string;
  createdAt: string;
}
