import { mapBranch, mapHub, mapProductLine } from "@/lib/db/mappers";
import { getDocumentForSession } from "@/lib/document-access";
import {
  getFinalCountEntries,
  resolveEffectiveEntries,
} from "@/lib/entry-snapshot";
import { canAccessAdmin, canSupervise } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { DocumentStatus, type PrintDocumentPayload } from "@/types/count";
import type { MockSession } from "@/types/user";

export type { PrintDocumentPayload };

export async function getPrintDocument(
  session: MockSession,
  documentId: string,
): Promise<PrintDocumentPayload | { error: string; status: 403 | 404 | 400 }> {
  if (!canSupervise(session.role) && !canAccessAdmin(session.role)) {
    return { error: "Access denied", status: 403 };
  }

  const access = await getDocumentForSession(session, documentId);
  if (!access.ok) {
    return { error: access.error, status: access.status };
  }

  const doc = access.document;
  if (doc.status !== DocumentStatus.COMPLETED) {
    return {
      error: "Only completed documents can be printed",
      status: 400,
    };
  }

  const branch = await prisma.branch.findUnique({ where: { id: doc.branchId } });
  const hub = doc.hubId
    ? await prisma.hub.findUnique({ where: { id: doc.hubId } })
    : null;

  const productLines = (
    await prisma.productLine.findMany({
      where: { documentId },
      orderBy: { lineNo: "asc" },
    })
  ).map(mapProductLine);

  let entries = await getFinalCountEntries(documentId);
  if (entries.length === 0 && doc.currentVersionId) {
    entries = await resolveEffectiveEntries(documentId, doc.currentVersionId);
  }

  const entryByLine = new Map(entries.map((e) => [e.lineId, e]));

  return {
    documentId: doc.id,
    documentNo: doc.documentNo,
    documentDate: doc.documentDate,
    locationCode: doc.locationCode,
    locationName: doc.locationName,
    branchCode: branch ? mapBranch(branch).code : "",
    branchName: branch ? mapBranch(branch).name : "",
    hubShortName: hub ? mapHub(hub).shortName : null,
    isCentral: doc.isCentral,
    currentVersionNo: doc.currentVersionNo,
    status: doc.status,
    lines: productLines.map((line) => ({
      lineNo: line.lineNo,
      productCode: line.productCode,
      productName: line.productName,
      totalBaseQty: entryByLine.get(line.lineId)?.totalBaseQty ?? null,
    })),
  };
}
