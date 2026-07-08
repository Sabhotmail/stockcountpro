import { getMockDb } from "@/mock/mock-db";
import { canAccessBranch, canSupervise } from "@/lib/permissions";
import { getEntriesForVersion } from "@/lib/entry-snapshot";
import { getDocumentDetail } from "@/services/count-document.service";
import type {
  CountVersion,
  VersionCompareLine,
  VersionCompareResult,
} from "@/types/count";
import type { MockSession } from "@/types/user";
import { UserRole } from "@/types/user";

export function listDocumentVersions(
  session: MockSession,
  documentId: string,
): CountVersion[] | { error: string } {
  const detail = getDocumentDetail(session, documentId);
  if (!detail) return { error: "Document not found" };

  const db = getMockDb();
  return db.versions
    .filter((version) => version.documentId === documentId)
    .sort((a, b) => a.versionNo - b.versionNo);
}

export function compareDocumentVersions(
  session: MockSession,
  documentId: string,
  fromVersionNo: number,
  toVersionNo: number,
): VersionCompareResult | { error: string } {
  const canReview = canSupervise(session.role);
  const detail = getDocumentDetail(session, documentId);
  if (!detail) return { error: "Document not found" };

  if (canReview && !canAccessBranch(session.role, session.branchIds, detail.branchId)) {
    return { error: "Access denied" };
  }

  if (!canReview && !canAccessBranch(session.role, session.branchIds, detail.branchId)) {
    return { error: "Access denied" };
  }

  const db = getMockDb();
  const versions = db.versions.filter((version) => version.documentId === documentId);
  const fromVersion = versions.find((version) => version.versionNo === fromVersionNo);
  const toVersion = versions.find((version) => version.versionNo === toVersionNo);

  if (!fromVersion || !toVersion) {
    return { error: "Version not found" };
  }

  const lines = db.productLines[documentId] ?? [];
  const fromEntries = getEntriesForVersion(documentId, fromVersion.id);
  const toEntries = getEntriesForVersion(documentId, toVersion.id);

  const compareLines: VersionCompareLine[] = lines.map((line) => {
    const fromEntry = fromEntries.find((entry) => entry.lineId === line.lineId);
    const toEntry = toEntries.find((entry) => entry.lineId === line.lineId);
    const fromQty = fromEntry?.totalBaseQty ?? null;
    const toQty = toEntry?.totalBaseQty ?? null;

    return {
      lineId: line.lineId,
      lineNo: line.lineNo,
      productCode: line.productCode,
      productName: line.productName,
      fromQty,
      toQty,
      difference:
        fromQty !== null && toQty !== null ? toQty - fromQty : null,
    };
  });

  return {
    documentId,
    fromVersion,
    toVersion,
    lines: compareLines,
  };
}

export function listAllAuditLogs(session: MockSession) {
  if (session.role !== UserRole.ADMIN && session.role !== UserRole.HQ) {
    return { error: "Access denied" as const };
  }

  return getMockDb().auditLogs.sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
}
