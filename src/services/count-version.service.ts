import {
  mapCountVersion,
  mapProductLine,
} from "@/lib/db/mappers";
import { getDocumentForSession } from "@/lib/document-access";
import { getEntriesForVersion } from "@/lib/entry-snapshot";
import { filterLinesForRole } from "@/lib/product-line-filter";
import { prisma } from "@/lib/prisma";
import { getDocumentDetail } from "@/services/count-document.service";
import type {
  CountVersion,
  VersionCompareLine,
  VersionCompareResult,
  VersionDetail,
} from "@/types/count";
import type { MockSession } from "@/types/user";

export async function listDocumentVersions(
  session: MockSession,
  documentId: string,
): Promise<CountVersion[] | { error: string }> {
  const detail = await getDocumentDetail(session, documentId);
  if (!detail) return { error: "Document not found" };

  const versions = await prisma.countVersion.findMany({
    where: { documentId },
    orderBy: { versionNo: "asc" },
  });

  return versions.map(mapCountVersion);
}

export async function getVersionDetail(
  session: MockSession,
  documentId: string,
  versionId: string,
): Promise<VersionDetail | { error: string }> {
  const access = await getDocumentForSession(session, documentId);
  if (!access.ok) return { error: access.error };

  const version = await prisma.countVersion.findFirst({
    where: { id: versionId, documentId },
  });
  if (!version) return { error: "Version not found" };

  const lines = filterLinesForRole(
    (
      await prisma.productLine.findMany({
        where: { documentId },
        orderBy: { lineNo: "asc" },
      })
    ).map(mapProductLine),
    session.role,
  );

  return {
    version: mapCountVersion(version),
    entries: await getEntriesForVersion(documentId, versionId),
    lines,
  };
}

export async function compareDocumentVersions(
  session: MockSession,
  documentId: string,
  fromVersionNo: number,
  toVersionNo: number,
): Promise<VersionCompareResult | { error: string }> {
  const access = await getDocumentForSession(session, documentId);
  if (!access.ok) return { error: access.error };

  const versions = await prisma.countVersion.findMany({ where: { documentId } });
  const fromVersion = versions.find((version) => version.versionNo === fromVersionNo);
  const toVersion = versions.find((version) => version.versionNo === toVersionNo);

  if (!fromVersion || !toVersion) {
    return { error: "Version not found" };
  }

  const lines = (
    await prisma.productLine.findMany({
      where: { documentId },
      orderBy: { lineNo: "asc" },
    })
  ).map(mapProductLine);

  const fromEntries = await getEntriesForVersion(documentId, fromVersion.id);
  const toEntries = await getEntriesForVersion(documentId, toVersion.id);

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
    fromVersion: mapCountVersion(fromVersion),
    toVersion: mapCountVersion(toVersion),
    lines: compareLines,
  };
}
