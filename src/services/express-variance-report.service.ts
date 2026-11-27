import { mapBranch, mapProductLine } from "@/lib/db/mappers";
import { getDocumentForSession } from "@/lib/document-access";
import { resolveEffectiveEntries } from "@/lib/entry-snapshot";
import { hasComparableExpectedQty } from "@/lib/express-expected-qty";
import {
  canPushToExpress,
  filterDocumentsForSupervisor,
  filterDocumentsForSupervisorPrint,
} from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { isEntryCounted } from "@/lib/unit-converter";
import type { ReviewLineItem } from "@/types/count";
import type { ExpressVarianceReportContext } from "@/types/express-variance";
import type { MockSession } from "@/types/user";

export type ExpressVarianceReportError = {
  error: string;
  status: number;
};

export async function getExpressVarianceReportContext(
  session: MockSession,
  documentId: string,
): Promise<ExpressVarianceReportContext | ExpressVarianceReportError> {
  if (!canPushToExpress(session.role)) {
    return { error: "Access denied", status: 403 };
  }

  const access = await getDocumentForSession(session, documentId);
  if (!access.ok) {
    return { error: access.error, status: access.status };
  }

  const doc = access.document;
  if (
    !filterDocumentsForSupervisor(doc.status) &&
    !filterDocumentsForSupervisorPrint(doc.status)
  ) {
    return { error: "Document is not available for this report", status: 403 };
  }

  const [branchRow, lineRows, versionRow] = await Promise.all([
    prisma.branch.findUnique({ where: { id: doc.branchId } }),
    prisma.productLine.findMany({
      where: { documentId },
      orderBy: { lineNo: "asc" },
    }),
    doc.currentVersionId
      ? prisma.countVersion.findUnique({ where: { id: doc.currentVersionId } })
      : Promise.resolve(null),
  ]);

  const branch = branchRow ? mapBranch(branchRow) : null;
  const lines = lineRows.map(mapProductLine);
  const entries = doc.currentVersionId
    ? await resolveEffectiveEntries(documentId, doc.currentVersionId)
    : [];

  const reportLines: ReviewLineItem[] = lines.map((line) => {
    const entry = entries.find((item) => item.lineId === line.lineId);
    const totalBaseQty = entry?.totalBaseQty ?? null;
    const rawExpected = line.expectedQty ?? null;
    const expectedQty = hasComparableExpectedQty(rawExpected)
      ? rawExpected
      : null;
    const isCounted = entry
      ? isEntryCounted(entry.qtyCase, entry.qtyPack, entry.qtyPiece)
      : false;

    return {
      lineId: line.lineId,
      lineNo: line.lineNo,
      productCode: line.productCode,
      productName: line.productName,
      expectedQty,
      totalBaseQty,
      qtyCase: entry?.qtyCase ?? null,
      qtyPack: entry?.qtyPack ?? null,
      qtyPiece: entry?.qtyPiece ?? null,
      allowCase: line.allowCase,
      allowPack: line.allowPack,
      allowPiece: line.allowPiece,
      unitCaseName: line.unitCaseName ?? null,
      unitPackName: line.unitPackName ?? null,
      unitPieceName: line.unitPieceName ?? null,
      difference:
        expectedQty !== null && totalBaseQty !== null
          ? totalBaseQty - expectedQty
          : null,
      versionNo: versionRow?.versionNo ?? doc.currentVersionNo,
      isCounted,
    };
  });

  return {
    success: true,
    document: {
      id: doc.id,
      documentNo: doc.documentNo,
      documentDate: doc.documentDate,
      status: doc.status,
      locationCode: doc.locationCode,
      locationName: doc.locationName,
      branchCode: branch?.code ?? "",
      branchName: branch?.name ?? "",
    },
    lines: reportLines,
  };
}
