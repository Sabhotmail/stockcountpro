import { getDefaultProductImageUrl } from "@/lib/product-image";
import { prisma } from "@/lib/prisma";
import { canAccessBranch, canSyncExpress } from "@/lib/permissions";
import { logExpressSync } from "@/services/audit-log.service";
import { fetchExpressCountDate } from "@/services/express-api.service";
import { DocumentStatus } from "@/types/count";
import type { ExpressStockCountLine } from "@/types/express";
import type { Branch, MockSession } from "@/types/user";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export type ExpressSyncBranchResult = {
  branchCode: string;
  branchName?: string;
  documentId?: string;
  documentNo?: string;
  lineCount?: number;
  status: "created" | "updated" | "skipped";
  reason?: string;
};

export type ExpressSyncResult = {
  date: string;
  expressLineCount: number;
  results: ExpressSyncBranchResult[];
};

function parseCountDate(value: string): Date | null {
  if (!DATE_PATTERN.test(value)) return null;

  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function buildDocumentId(branchId: string, countDate: string): string {
  const compact = countDate.replace(/-/g, "");
  return `doc_${branchId}_${compact}`;
}

function buildDocumentNo(
  branchCode: string,
  countDate: string,
  expressDocumentNo?: string,
): string {
  if (expressDocumentNo?.trim()) {
    return expressDocumentNo.trim();
  }

  return `CNT-${branchCode}-${countDate.replace(/-/g, "")}`;
}

function mapExpressLineToProductLine(
  line: ExpressStockCountLine,
  documentId: string,
  lineNo: number,
) {
  const caseRatio = Math.max(1, Math.round(line.CaseUnitFactor || 1));
  const rawPieceUnit = line.CaseUnitCode?.trim() || "";
  const unitPieceName =
    rawPieceUnit && /[ก-๙]/.test(rawPieceUnit) ? rawPieceUnit : "ชิ้น";

  return {
    lineId: `${documentId}_line_${String(lineNo).padStart(4, "0")}`,
    documentId,
    lineNo,
    productCode: line.ProductCode,
    productName: line.ProductName,
    productImageUrl: getDefaultProductImageUrl(line.ProductCode),
    barcode: line.ProductCode,
    unitCaseName: line.CaseUnitName || "ลัง",
    unitPackName: null,
    unitPieceName,
    caseRatio,
    packRatio: 1,
    allowCase: caseRatio > 1 || line.CaseQty > 0,
    allowPack: false,
    allowPiece: true,
    expectedQty: Math.round(line.TransactionValue ?? line.PhysicalBalance ?? 0),
  };
}

function buildExpressBranchLookup(branches: Branch[]): Map<string, Branch> {
  const lookup = new Map<string, Branch>();

  for (const branch of branches) {
    lookup.set(branch.code.toUpperCase(), branch);

    const expressCode = branch.expressLocationCode?.trim().toUpperCase();
    if (expressCode) {
      lookup.set(expressCode, branch);
    }
  }

  return lookup;
}

function resolveBranchByLocationCode(
  locationCode: string,
  branchByLocationCode: Map<string, Branch>,
): Branch | undefined {
  return branchByLocationCode.get(locationCode);
}

function groupExpressLinesByLocation(
  lines: ExpressStockCountLine[],
): Map<string, ExpressStockCountLine[]> {
  const groups = new Map<string, ExpressStockCountLine[]>();

  for (const line of lines) {
    const locationCode = line.LocationCode?.trim().toUpperCase();
    if (!locationCode) continue;

    const bucket = groups.get(locationCode) ?? [];
    bucket.push(line);
    groups.set(locationCode, bucket);
  }

  return groups;
}

async function upsertImportedDocument(
  branchId: string,
  branchCode: string,
  countDate: Date,
  countDateKey: string,
  lines: ExpressStockCountLine[],
): Promise<ExpressSyncBranchResult> {
  const documentId = buildDocumentId(branchId, countDateKey);
  const documentNo = buildDocumentNo(branchCode, countDateKey, lines[0]?.DocumentNumber);
  const productLines = lines.map((line, index) =>
    mapExpressLineToProductLine(line, documentId, index + 1),
  );
  const now = new Date();

  const existing = await prisma.countDocument.findUnique({
    where: { id: documentId },
  });

  if (existing && existing.status !== DocumentStatus.IMPORTED) {
    return {
      branchCode,
      documentId,
      documentNo: existing.documentNo,
      lineCount: existing.totalLines,
      status: "skipped",
      reason: `เอกสารอยู่ในสถานะ ${existing.status} — ไม่ sync ทับ`,
    };
  }

  await prisma.$transaction(async (tx) => {
    if (existing) {
      await tx.productLine.deleteMany({ where: { documentId } });
      await tx.countDocument.update({
        where: { id: documentId },
        data: {
          documentNo,
          documentDate: countDate,
          totalLines: productLines.length,
          countedLines: 0,
          note: null,
          updatedAt: now,
        },
      });
    } else {
      await tx.countDocument.create({
        data: {
          id: documentId,
          documentNo,
          documentDate: countDate,
          branchId,
          status: DocumentStatus.IMPORTED,
          currentVersionId: null,
          currentVersionNo: 0,
          totalLines: productLines.length,
          countedLines: 0,
          note: null,
          createdAt: now,
          updatedAt: now,
        },
      });
    }

    if (productLines.length > 0) {
      await tx.productLine.createMany({ data: productLines });
    }
  });

  return {
    branchCode,
    documentId,
    documentNo,
    lineCount: productLines.length,
    status: existing ? "updated" : "created",
  };
}

export async function syncExpressCountDate(
  session: MockSession,
  countDate: string,
): Promise<ExpressSyncResult | { error: string }> {
  if (!canSyncExpress(session.role)) {
    return { error: "Access denied" };
  }

  const parsedDate = parseCountDate(countDate);
  if (!parsedDate) {
    return { error: "Invalid date format. Use yyyy-MM-dd" };
  }

  const expressResult = await fetchExpressCountDate(countDate);
  if ("error" in expressResult) {
    return { error: expressResult.error };
  }

  if (!expressResult.success) {
    return { error: expressResult.message ?? "Express API returned failure" };
  }

  const expressLines = expressResult.stockCountData ?? [];
  const groups = groupExpressLinesByLocation(expressLines);
  const branches = await prisma.branch.findMany();
  const branchByLocationCode = buildExpressBranchLookup(branches.map((branch) => ({
    id: branch.id,
    code: branch.code,
    name: branch.name,
    expressLocationCode: branch.expressLocationCode,
  })));

  const results: ExpressSyncBranchResult[] = [];

  for (const [locationCode, lines] of groups) {
    const branch = resolveBranchByLocationCode(locationCode, branchByLocationCode);
    if (!branch) {
      results.push({
        branchCode: locationCode,
        status: "skipped",
        reason: `ไม่พบสาขาในระบบสำหรับ Express LocationCode "${locationCode}"`,
        lineCount: lines.length,
      });
      continue;
    }

    if (
      !canAccessBranch(session.role, session.branchIds, branch.id)
    ) {
      continue;
    }

    const result = await upsertImportedDocument(
      branch.id,
      branch.code,
      parsedDate,
      countDate,
      lines,
    );

    results.push({
      ...result,
      branchName: branch.name,
    });
  }

  if (results.length === 0) {
    return { error: "ไม่พบข้อมูลใบตรวจนับสำหรับสาขาของคุณในวันที่นี้" };
  }

  const created = results.filter((item) => item.status === "created").length;
  const updated = results.filter((item) => item.status === "updated").length;
  const skipped = results.filter((item) => item.status === "skipped").length;

  await logExpressSync(session.userId, session.userName, countDate, {
    expressLineCount: expressLines.length,
    created,
    updated,
    skipped,
  });

  return {
    date: countDate,
    expressLineCount: expressLines.length,
    results,
  };
}

export async function previewExpressCountDate(
  session: MockSession,
  countDate: string,
) {
  if (!canSyncExpress(session.role)) {
    return { error: "Access denied" } as const;
  }

  if (!parseCountDate(countDate)) {
    return { error: "Invalid date format. Use yyyy-MM-dd" } as const;
  }

  const expressResult = await fetchExpressCountDate(countDate);
  if ("error" in expressResult) {
    return { error: expressResult.error } as const;
  }

  if (!expressResult.success) {
    return {
      error: expressResult.message ?? "Express API returned failure",
    } as const;
  }

  const lines = expressResult.stockCountData ?? [];
  const groups = groupExpressLinesByLocation(lines);
  const branches = await prisma.branch.findMany();
  const branchByLocationCode = buildExpressBranchLookup(branches.map((branch) => ({
    id: branch.id,
    code: branch.code,
    name: branch.name,
    expressLocationCode: branch.expressLocationCode,
  })));

  const locations = Array.from(groups.entries())
    .filter(([locationCode]) => {
      const branch = resolveBranchByLocationCode(locationCode, branchByLocationCode);
      if (!branch) return false;
      return canAccessBranch(session.role, session.branchIds, branch.id);
    })
    .map(([locationCode, branchLines]) => {
      const branch = resolveBranchByLocationCode(locationCode, branchByLocationCode);
      return {
        branchCode: branch?.code ?? locationCode,
        expressLocationCode: locationCode,
        lineCount: branchLines.length,
      };
    })
    .sort((a, b) => a.branchCode.localeCompare(b.branchCode));

  if (locations.length === 0) {
    return { error: "ไม่พบข้อมูลใบตรวจนับสำหรับสาขาของคุณในวันที่นี้" } as const;
  }

  return {
    date: countDate,
    expressLineCount: locations.reduce((sum, item) => sum + item.lineCount, 0),
    locationCount: locations.length,
    locations,
  };
}
