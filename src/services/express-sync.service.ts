import { getDefaultProductImageUrl } from "@/lib/product-image";
import { extractLocationPrefix } from "@/lib/express-location";
import { prisma } from "@/lib/prisma";
import { canAccessBranch, canSyncExpress } from "@/lib/permissions";
import { logExpressSync } from "@/services/audit-log.service";
import {
  fetchExpressCountDateByLocations,
  fetchExpressLocationsByCountDate,
} from "@/services/express-api.service";
import { DocumentStatus } from "@/types/count";
import type { ExpressLocationItem, ExpressStockCountLine } from "@/types/express";
import { mapBranch } from "@/lib/db/mappers";
import type { Branch, MockSession } from "@/types/user";

import { parseDateKeyBangkok } from "@/lib/datetime";
import { mapExpressExpectedQty, mapExpressFieldQty } from "@/lib/express-expected-qty";

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

export type ExpressSyncLocationPreview = {
  locationCode: string;
  locationName?: string | null;
  prefix: string | null;
  mappedBranchId: string | null;
  mappedBranchCode: string | null;
  mappedBranchName: string | null;
  accessible: boolean;
  selectable: boolean;
  disabledReason: string | null;
};

export type ExpressSyncPreviewResult = {
  date: string;
  locations: ExpressSyncLocationPreview[];
};

function parseCountDate(value: string): Date | null {
  return parseDateKeyBangkok(value);
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
    expectedQty: mapExpressExpectedQty(
      line.TransactionValue,
      line.PhysicalBalance,
    ),
    expectedQtyCase: mapExpressFieldQty(line.CaseQty),
    expectedQtyPiece: mapExpressFieldQty(line.PieceQty),
  };
}

function buildPrefixBranchLookup(branches: Branch[]): Map<string, Branch> {
  const lookup = new Map<string, Branch>();

  for (const branch of branches) {
    const prefix = branch.expressLocationPrefix?.trim().toUpperCase();
    if (prefix) {
      lookup.set(prefix, branch);
    }
  }

  return lookup;
}

async function loadBranchesForExpressLookup(): Promise<Branch[]> {
  const branches = await prisma.branch.findMany({
    orderBy: { code: "asc" },
  });
  return branches.map(mapBranch);
}

function normalizeSelectedLocationCodes(locationCodes: string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const code of locationCodes) {
    const value = code.trim().toUpperCase();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    normalized.push(value);
  }

  return normalized;
}

function normalizeExpressLocationCode(item: ExpressLocationItem): string {
  return String(item.LocationCode ?? "").trim().toUpperCase();
}

function buildLocationPreview(
  item: ExpressLocationItem,
  branchByPrefix: Map<string, Branch>,
  session: MockSession,
): ExpressSyncLocationPreview {
  const locationCode = normalizeExpressLocationCode(item);
  const prefix = extractLocationPrefix(locationCode);
  const branch = prefix ? branchByPrefix.get(prefix) : undefined;
  const accessible = branch
    ? canAccessBranch(session.role, session.branchIds, branch.id)
    : false;

  let disabledReason: string | null = null;
  if (!branch) {
    disabledReason = "ยังไม่ตั้ง prefix สำหรับคลังนี้";
  } else if (!accessible) {
    disabledReason = "ไม่มีสิทธิ์สาขา";
  }

  return {
    locationCode,
    locationName:
      typeof item.LocationName === "string" ? item.LocationName : null,
    prefix,
    mappedBranchId: branch?.id ?? null,
    mappedBranchCode: branch?.code ?? null,
    mappedBranchName: branch?.name ?? null,
    accessible,
    selectable: Boolean(branch && accessible),
    disabledReason,
  };
}

function buildLocationPreviews(
  locations: ExpressLocationItem[],
  branches: Branch[],
  session: MockSession,
): ExpressSyncLocationPreview[] {
  const branchByPrefix = buildPrefixBranchLookup(branches);

  return locations
    .map((item) => buildLocationPreview(item, branchByPrefix, session))
    .filter((item) => item.locationCode.length > 0)
    .sort((a, b) => a.locationCode.localeCompare(b.locationCode));
}

function aggregateExpressLinesByBranch(
  groups: Map<string, ExpressStockCountLine[]>,
  branchByPrefix: Map<string, Branch>,
  session: MockSession,
): {
  linesByBranchId: Map<string, { branch: Branch; lines: ExpressStockCountLine[] }>;
  skipped: ExpressSyncBranchResult[];
} {
  const linesByBranchId = new Map<
    string,
    { branch: Branch; lines: ExpressStockCountLine[] }
  >();
  const skipped: ExpressSyncBranchResult[] = [];

  for (const [locationCode, lines] of groups) {
    const branch = resolveBranchByLocationCode(locationCode, branchByPrefix);
    if (!branch) {
      skipped.push({
        branchCode: locationCode,
        status: "skipped",
        reason: `ไม่พบสาขาในระบบสำหรับ Express LocationCode "${locationCode}"`,
        lineCount: lines.length,
      });
      continue;
    }

    if (!canAccessBranch(session.role, session.branchIds, branch.id)) {
      continue;
    }

    const bucket = linesByBranchId.get(branch.id) ?? { branch, lines: [] };
    bucket.lines.push(...lines);
    linesByBranchId.set(branch.id, bucket);
  }

  return { linesByBranchId, skipped };
}

function resolveBranchByLocationCode(
  locationCode: string,
  branchByPrefix: Map<string, Branch>,
): Branch | undefined {
  const prefix = extractLocationPrefix(locationCode);
  if (!prefix) return undefined;
  return branchByPrefix.get(prefix);
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
  locationCodes: string[],
): Promise<ExpressSyncResult | { error: string }> {
  if (!canSyncExpress(session.role)) {
    return { error: "Access denied" };
  }

  const parsedDate = parseCountDate(countDate);
  if (!parsedDate) {
    return { error: "Invalid date format. Use yyyy-MM-dd" };
  }

  const selectedLocationCodes = normalizeSelectedLocationCodes(locationCodes);
  if (selectedLocationCodes.length === 0) {
    return { error: "locations are required" };
  }

  const locationResult = await fetchExpressLocationsByCountDate(countDate);
  if ("error" in locationResult) {
    return { error: locationResult.error };
  }

  const branches = await loadBranchesForExpressLookup();
  const branchByPrefix = buildPrefixBranchLookup(branches);
  const previews = buildLocationPreviews(locationResult.locations, branches, session);
  const previewByCode = new Map(previews.map((item) => [item.locationCode, item]));
  const invalidLocationCodes = selectedLocationCodes.filter(
    (code) => !previewByCode.get(code)?.selectable,
  );

  if (invalidLocationCodes.length > 0) {
    return {
      error: `ไม่สามารถ sync คลังที่เลือกได้: ${invalidLocationCodes.join(", ")}`,
    };
  }

  const expressResult = await fetchExpressCountDateByLocations(
    countDate,
    selectedLocationCodes,
  );
  if ("error" in expressResult) {
    return { error: expressResult.error };
  }

  if (!expressResult.success) {
    return { error: expressResult.message ?? "Express API returned failure" };
  }

  const expressLines = expressResult.stockCountData ?? [];
  const selectedLocationSet = new Set(selectedLocationCodes);
  const groups = groupExpressLinesByLocation(
    expressLines.filter((line) =>
      selectedLocationSet.has(line.LocationCode?.trim().toUpperCase()),
    ),
  );
  const { linesByBranchId, skipped: skippedResults } = aggregateExpressLinesByBranch(
    groups,
    branchByPrefix,
    session,
  );

  const results: ExpressSyncBranchResult[] = [...skippedResults];

  for (const { branch, lines } of linesByBranchId.values()) {
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
  const skippedCount = results.filter((item) => item.status === "skipped").length;

  await logExpressSync(session.userId, session.userName, countDate, {
    expressLineCount: expressLines.length,
    created,
    updated,
    skipped: skippedCount,
    locations: selectedLocationCodes,
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
): Promise<ExpressSyncPreviewResult | { error: string }> {
  if (!canSyncExpress(session.role)) {
    return { error: "Access denied" };
  }

  if (!parseCountDate(countDate)) {
    return { error: "Invalid date format. Use yyyy-MM-dd" };
  }

  const expressResult = await fetchExpressLocationsByCountDate(countDate);
  if ("error" in expressResult) {
    return { error: expressResult.error };
  }

  const branches = await loadBranchesForExpressLookup();
  const locations = buildLocationPreviews(expressResult.locations, branches, session);

  return {
    date: countDate,
    locations,
  };
}
