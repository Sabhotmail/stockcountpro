import type { AuditLog } from "@/types/audit";

export enum DocumentStatus {
  IMPORTED = "IMPORTED",
  COUNTING = "COUNTING",
  SUBMITTED = "SUBMITTED",
  REVIEWING = "REVIEWING",
  RECOUNT_REQUESTED = "RECOUNT_REQUESTED",
  APPROVED = "APPROVED",
  COMPLETED = "COMPLETED",
}

export enum VersionStatus {
  DRAFT = "DRAFT",
  SUBMITTED = "SUBMITTED",
  RECOUNT = "RECOUNT",
  APPROVED = "APPROVED",
  LOCKED = "LOCKED",
}

export interface ProductLine {
  lineId: string;
  lineNo: number;
  productCode: string;
  productName: string;
  productImageUrl?: string;
  barcode: string;
  unitCaseName?: string;
  unitPackName?: string;
  unitPieceName: string;
  caseRatio: number;
  packRatio: number;
  allowCase: boolean;
  allowPack: boolean;
  allowPiece: boolean;
  expectedQty?: number;
}

export interface CountEntry {
  lineId: string;
  qtyCase: number | null;
  qtyPack: number | null;
  qtyPiece: number | null;
  totalBaseQty: number | null;
  note: string | null;
  revision: number;
  updatedAt: string;
  updatedBy: string;
}

export interface CountVersion {
  id: string;
  documentId: string;
  versionNo: number;
  status: VersionStatus;
  baseVersionId?: string;
  createdAt: string;
  createdBy: string;
  submittedAt?: string;
  submittedBy?: string;
}

export interface CountDocument {
  id: string;
  documentNo: string;
  documentDate: string;
  branchId: string;
  status: DocumentStatus;
  currentVersionId: string | null;
  currentVersionNo: number;
  totalLines: number;
  countedLines: number;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CountDocumentDetail extends CountDocument {
  branchCode: string;
  branchName: string;
  version: CountVersion | null;
  lines: ProductLine[];
  entries: CountEntry[];
}

export interface CountDocumentListItem extends CountDocument {
  branchCode: string;
  branchName: string;
}

export interface SaveEntryPayload {
  qtyCase?: number | null;
  qtyPack?: number | null;
  qtyPiece?: number | null;
  baseRevision?: number;
  clientMutationId?: string;
}

export interface SaveDocumentNotePayload {
  note: string | null;
}

export interface SaveEntryResponse {
  status: "SAVED";
  entry: CountEntry;
}

export interface RecountRequestItem {
  lineId: string;
  reason: string;
}

export interface RecountRequestPayload {
  baseVersionId: string;
  items: RecountRequestItem[];
}

export interface RecountRequestRecord {
  id: string;
  documentId: string;
  baseVersionId: string;
  newVersionId: string;
  items: RecountRequestItem[];
  requestedBy: string;
  requestedAt: string;
}

export interface SupervisorDocumentListItem extends CountDocumentListItem {
  submittedBy: string | null;
  submittedByName: string | null;
  submittedAt: string | null;
  hasDocumentNote: boolean;
}

export interface ReviewLineItem {
  lineId: string;
  lineNo: number;
  productCode: string;
  productName: string;
  expectedQty: number;
  totalBaseQty: number | null;
  difference: number | null;
  versionNo: number;
  isCounted: boolean;
}

export interface ReviewDetail {
  document: CountDocumentDetail;
  reviewLines: ReviewLineItem[];
  versions: CountVersion[];
  auditLogs: AuditLog[];
  recountRequests: RecountRequestRecord[];
}

export type SyncStatus = "idle" | "saving" | "saved" | "failed" | "waiting";
