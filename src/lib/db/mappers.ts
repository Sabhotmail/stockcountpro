import { toDateKeyBangkok, toIsoInstant } from "@/lib/datetime";
import type {
  AuditLog as PrismaAuditLog,
  Branch as PrismaBranch,
  Hub as PrismaHub,
  CountDocument as PrismaCountDocument,
  CountEntry as PrismaCountEntry,
  CountLineLock as PrismaCountLineLock,
  CountVersion as PrismaCountVersion,
  EntrySnapshot as PrismaEntrySnapshot,
  FinalCountEntry as PrismaFinalCountEntry,
  ProductLine as PrismaProductLine,
  RecountRequest as PrismaRecountRequest,
  RecountRequestItem as PrismaRecountRequestItem,
  User as PrismaUser,
} from "@prisma/client";
import type { AuditLog } from "@/types/audit";
import { AuditAction } from "@/types/audit";
import {
  DocumentStatus,
  VersionStatus,
  type CountDocument,
  type CountEntry,
  type CountVersion,
  type LineLockInfo,
  type ProductLine,
  type RecountRequestRecord,
} from "@/types/count";
import { type Branch, type Hub, type User, UserRole } from "@/types/user";

function toIso(value: Date): string {
  return toIsoInstant(value);
}

function toDateOnly(value: Date): string {
  return toDateKeyBangkok(value);
}

export function mapBranch(branch: PrismaBranch): Branch {
  return {
    id: branch.id,
    code: branch.code,
    name: branch.name,
    expressLocationPrefix: branch.expressLocationPrefix ?? null,
    isActive: branch.isActive,
  };
}

export function mapHub(hub: PrismaHub): Hub {
  return {
    id: hub.id,
    branchId: hub.branchId,
    code: hub.code,
    name: hub.name,
    shortName: hub.shortName ?? null,
    suffixLetter: hub.suffixLetter ?? null,
    isActive: hub.isActive,
  };
}

export function mapUser(
  user: PrismaUser & {
    branches: { branchId: string }[];
    hubs?: { hubId: string }[];
  },
): User {
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role as UserRole,
    isActive: user.isActive,
    branchIds: user.branches.map((item) => item.branchId),
    hubIds: user.hubs?.map((item) => item.hubId) ?? [],
  };
}

export function mapCountDocument(doc: PrismaCountDocument): CountDocument {
  return {
    id: doc.id,
    documentNo: doc.documentNo,
    documentDate: toDateOnly(doc.documentDate),
    branchId: doc.branchId,
    hubId: doc.hubId,
    locationCode: doc.locationCode,
    isCentral: doc.isCentral,
    status: doc.status as DocumentStatus,
    currentVersionId: doc.currentVersionId,
    currentVersionNo: doc.currentVersionNo,
    totalLines: doc.totalLines,
    countedLines: doc.countedLines,
    note: doc.note,
    createdAt: toIso(doc.createdAt),
    updatedAt: toIso(doc.updatedAt),
  };
}

export function mapProductLine(line: PrismaProductLine): ProductLine {
  return {
    lineId: line.lineId,
    lineNo: line.lineNo,
    productCode: line.productCode,
    productName: line.productName,
    productImageUrl: line.productImageUrl ?? undefined,
    barcode: line.barcode,
    unitCaseName: line.unitCaseName ?? undefined,
    unitPackName: line.unitPackName ?? undefined,
    unitPieceName: line.unitPieceName,
    caseRatio: line.caseRatio,
    packRatio: line.packRatio,
    allowCase: line.allowCase,
    allowPack: line.allowPack,
    allowPiece: line.allowPiece,
    expectedQty: line.expectedQty ?? undefined,
    expectedQtyCase: line.expectedQtyCase ?? undefined,
    expectedQtyPiece: line.expectedQtyPiece ?? undefined,
  };
}

export function mapLineLock(lock: PrismaCountLineLock): LineLockInfo {
  return {
    lineId: lock.lineId,
    lockedByUserId: lock.lockedByUserId,
    lockedByUserName: lock.lockedByUserName,
    expiresAt: toIso(lock.expiresAt),
  };
}

export function mapCountEntry(entry: PrismaCountEntry): CountEntry {
  return {
    lineId: entry.lineId,
    qtyCase: entry.qtyCase,
    qtyPack: entry.qtyPack,
    qtyPiece: entry.qtyPiece,
    totalBaseQty: entry.totalBaseQty,
    note: entry.note,
    revision: entry.revision,
    updatedAt: toIso(entry.updatedAt),
    updatedBy: entry.updatedBy,
  };
}

export function mapSnapshotEntry(entry: PrismaEntrySnapshot): CountEntry {
  return {
    lineId: entry.lineId,
    qtyCase: entry.qtyCase,
    qtyPack: entry.qtyPack,
    qtyPiece: entry.qtyPiece,
    totalBaseQty: entry.totalBaseQty,
    note: entry.note,
    revision: entry.revision,
    updatedAt: toIso(entry.updatedAt),
    updatedBy: entry.updatedBy,
  };
}

export function mapFinalEntry(entry: PrismaFinalCountEntry): CountEntry {
  return {
    lineId: entry.lineId,
    qtyCase: entry.qtyCase,
    qtyPack: entry.qtyPack,
    qtyPiece: entry.qtyPiece,
    totalBaseQty: entry.totalBaseQty,
    note: entry.note,
    revision: entry.revision,
    updatedAt: toIso(entry.updatedAt),
    updatedBy: entry.updatedBy,
  };
}

export function mapCountVersion(version: PrismaCountVersion): CountVersion {
  return {
    id: version.id,
    documentId: version.documentId,
    versionNo: version.versionNo,
    status: version.status as VersionStatus,
    baseVersionId: version.baseVersionId ?? undefined,
    createdAt: toIso(version.createdAt),
    createdBy: version.createdBy,
    submittedAt: version.submittedAt ? toIso(version.submittedAt) : undefined,
    submittedBy: version.submittedBy ?? undefined,
  };
}

export function mapAuditLog(log: PrismaAuditLog): AuditLog {
  return {
    id: log.id,
    action: log.action as AuditAction,
    userId: log.userId,
    userName: log.userName,
    branchId: log.branchId ?? undefined,
    documentId: log.documentId ?? undefined,
    versionId: log.versionId ?? undefined,
    lineId: log.lineId ?? undefined,
    detail: log.detail ?? undefined,
    createdAt: toIso(log.createdAt),
  };
}

export function mapRecountRequest(
  request: PrismaRecountRequest & { items: PrismaRecountRequestItem[] },
): RecountRequestRecord {
  return {
    id: request.id,
    documentId: request.documentId,
    baseVersionId: request.baseVersionId,
    newVersionId: request.newVersionId,
    requestedBy: request.requestedBy,
    requestedAt: toIso(request.requestedAt),
    items: request.items.map((item) => ({
      lineId: item.lineId,
      reason: item.reason,
    })),
  };
}
