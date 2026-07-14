import { getDefaultProductImageUrl } from "@/lib/product-image";
import {
  classifyLocationForBranch,
  extractLocationPrefix,
  type HubForClassify,
  type LocationClassification,
} from "@/lib/express-location";
import { mapBranch, mapHub } from "@/lib/db/mappers";
import { prisma } from "@/lib/prisma";
import {
  canAccessBranch,
  canAccessCentralDocuments,
  canAccessHub,
  canSyncExpress,
} from "@/lib/permissions";
import { logExpressSync } from "@/services/audit-log.service";
import {
  fetchExpressCountDateByLocations,
  fetchExpressLocationsByCountDate,
} from "@/services/express-api.service";
import { DocumentStatus } from "@/types/count";
import type { ExpressLocationItem, ExpressStockCountLine } from "@/types/express";
import type { Branch, Hub, MockSession } from "@/types/user";

import { dateKeyToUtcDateOnly, parseDateKeyBangkok } from "@/lib/datetime";
import { mapExpressExpectedQty, mapExpressFieldQty } from "@/lib/express-expected-qty";

export type ExpressSyncLocationInput = {
  code: string;
  name?: string | null;
};

export type ExpressSyncDocumentResult = {
  branchCode: string;
  branchName?: string;
  hubCode?: string;
  hubName?: string;
  hubShortName?: string;
  locationCode?: string;
  locationName?: string | null;
  isCentral?: boolean;
  documentId?: string;
  documentNo?: string;
  lineCount?: number;
  status: "created" | "updated" | "skipped";
  reason?: string;
};

/** @deprecated Use ExpressSyncDocumentResult */
export type ExpressSyncBranchResult = ExpressSyncDocumentResult;

export type ExpressSyncResult = {
  date: string;
  expressLineCount: number;
  results: ExpressSyncDocumentResult[];
};

export type ExpressSyncLocationPreview = {
  locationCode: string;
  locationName?: string | null;
  prefix: string | null;
  classification: "hub" | "central" | "unmapped";
  mappedBranchId: string | null;
  mappedBranchCode: string | null;
  mappedBranchName: string | null;
  hubId: string | null;
  hubCode: string | null;
  hubName: string | null;
  hubShortName: string | null;
  accessible: boolean;
  selectable: boolean;
  disabledReason: string | null;
};

export type ExpressSyncPreviewResult = {
  date: string;
  locations: ExpressSyncLocationPreview[];
};

type DocumentDestination =
  | {
      kind: "hub";
      branch: Branch;
      hub: HubForClassify;
      locationCode: string;
      locationName: string | null;
    }
  | {
      kind: "central";
      branch: Branch;
      locationCode: string;
      locationName: string | null;
    };

type DocumentGroupKey = string;

function parseCountDate(value: string): Date | null {
  return parseDateKeyBangkok(value);
}

function buildLocationDocumentId(
  branchId: string,
  countDate: string,
  locationCode: string,
): string {
  const compact = countDate.replace(/-/g, "");
  return `doc_${branchId}_${compact}_loc_${locationCode}`;
}

function sanitizeDocumentNamePart(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function buildLocationDocumentNo(
  locationCode: string,
  countDate: string,
  locationName?: string | null,
): string {
  const code = sanitizeDocumentNamePart(locationCode);
  const name = locationName ? sanitizeDocumentNamePart(locationName) : "";
  const dateLabel = countDate;

  if (name) {
    return `${code} · ${name} (${dateLabel})`;
  }

  return `${code} (${dateLabel})`;
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
    where: { isActive: true },
    orderBy: { code: "asc" },
  });
  return branches.map(mapBranch);
}

async function loadActiveHubs(): Promise<Hub[]> {
  const hubs = await prisma.hub.findMany({
    where: { isActive: true },
    orderBy: [{ branchId: "asc" }, { code: "asc" }],
  });
  return hubs.map(mapHub);
}

function normalizeSelectedLocations(
  locationInputs: Array<string | ExpressSyncLocationInput>,
): ExpressSyncLocationInput[] {
  const seen = new Set<string>();
  const normalized: ExpressSyncLocationInput[] = [];

  for (const item of locationInputs) {
    const code =
      typeof item === "string"
        ? item.trim().toUpperCase()
        : String(item.code ?? "")
            .trim()
            .toUpperCase();
    if (!code || seen.has(code)) continue;
    seen.add(code);

    const name =
      typeof item === "string"
        ? null
        : typeof item.name === "string"
          ? item.name.trim() || null
          : null;

    normalized.push({ code, name });
  }

  return normalized;
}

function normalizeExpressLocationCode(item: ExpressLocationItem): string {
  return String(item.LocationCode ?? "").trim().toUpperCase();
}

function classifyForActiveBranches(
  locationCode: string,
  branches: Branch[],
  hubs: Hub[],
): {
  classification: LocationClassification;
  branch: Branch | null;
} {
  const prefix = extractLocationPrefix(locationCode);
  if (!prefix) {
    return { classification: { kind: "unmapped" }, branch: null };
  }

  const branch = branches.find(
    (item) => item.expressLocationPrefix?.trim().toUpperCase() === prefix,
  );
  if (!branch?.expressLocationPrefix) {
    return { classification: { kind: "unmapped" }, branch: null };
  }

  const classification = classifyLocationForBranch(
    locationCode,
    branch.id,
    branch.expressLocationPrefix,
    hubs,
  );

  return { classification, branch };
}

function canAccessClassification(
  session: MockSession,
  branch: Branch,
  classification: LocationClassification,
): boolean {
  if (!canAccessBranch(session.role, session.branchIds, branch.id)) {
    return false;
  }

  if (classification.kind === "central") {
    return canAccessCentralDocuments(session.role);
  }

  if (classification.kind === "hub") {
    return canAccessHub(session.role, session.hubIds, classification.hub.id);
  }

  return false;
}

function buildLocationPreview(
  item: ExpressLocationItem,
  branches: Branch[],
  hubs: Hub[],
  session: MockSession,
): ExpressSyncLocationPreview {
  const locationCode = normalizeExpressLocationCode(item);
  const prefix = extractLocationPrefix(locationCode);
  const { classification, branch } = classifyForActiveBranches(
    locationCode,
    branches,
    hubs,
  );

  let hubId: string | null = null;
  let hubCode: string | null = null;
  let hubName: string | null = null;
  let hubShortName: string | null = null;
  let classificationKind: ExpressSyncLocationPreview["classification"] =
    "unmapped";

  if (classification.kind === "hub") {
    classificationKind = "hub";
    hubId = classification.hub.id;
    hubCode = classification.hub.code;
    hubName = classification.hub.name;
    hubShortName = classification.hub.shortName;
  } else if (classification.kind === "central") {
    classificationKind = "central";
  }

  const accessible = branch
    ? canAccessClassification(session, branch, classification)
    : false;

  let disabledReason: string | null = null;
  if (!branch) {
    disabledReason = "ยังไม่ตั้ง prefix สำหรับคลังนี้";
  } else if (classification.kind === "unmapped") {
    disabledReason = "ยังไม่ได้กำหนด Hub/HQ สำหรับคลังนี้";
  } else if (!accessible) {
    disabledReason =
      classification.kind === "central"
        ? "คลังกลาง HQ — เฉพาะบัญชี/HQ"
        : "ไม่มีสิทธิ์ Hub นี้";
  }

  return {
    locationCode,
    locationName:
      typeof item.LocationName === "string" ? item.LocationName : null,
    prefix,
    classification: classificationKind,
    mappedBranchId: branch?.id ?? null,
    mappedBranchCode: branch?.code ?? null,
    mappedBranchName: branch?.name ?? null,
    hubId,
    hubCode,
    hubName,
    hubShortName,
    accessible,
    selectable: Boolean(branch && classification.kind !== "unmapped" && accessible),
    disabledReason,
  };
}

function buildLocationPreviews(
  locations: ExpressLocationItem[],
  branches: Branch[],
  hubs: Hub[],
  session: MockSession,
): ExpressSyncLocationPreview[] {
  return locations
    .map((item) => buildLocationPreview(item, branches, hubs, session))
    .filter((item) => item.locationCode.length > 0 && item.accessible)
    .sort((a, b) => a.locationCode.localeCompare(b.locationCode));
}

function getDocumentGroupKey(destination: DocumentDestination): DocumentGroupKey {
  return `${destination.branch.id}|loc:${destination.locationCode}`;
}

function resolveDestination(
  locationCode: string,
  branches: Branch[],
  hubs: Hub[],
  locationName: string | null = null,
): DocumentDestination | null {
  const { classification, branch } = classifyForActiveBranches(
    locationCode,
    branches,
    hubs,
  );

  if (!branch) return null;

  if (classification.kind === "hub") {
    return {
      kind: "hub",
      branch,
      hub: classification.hub,
      locationCode,
      locationName,
    };
  }

  if (classification.kind === "central") {
    return { kind: "central", branch, locationCode, locationName };
  }

  return null;
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

function aggregateExpressLinesByDocument(
  groups: Map<string, ExpressStockCountLine[]>,
  branches: Branch[],
  hubs: Hub[],
  session: MockSession,
  locationNameByCode: Map<string, string | null>,
): {
  linesByDestination: Map<
    DocumentGroupKey,
    { destination: DocumentDestination; lines: ExpressStockCountLine[] }
  >;
  skipped: ExpressSyncDocumentResult[];
} {
  const linesByDestination = new Map<
    DocumentGroupKey,
    { destination: DocumentDestination; lines: ExpressStockCountLine[] }
  >();
  const skipped: ExpressSyncDocumentResult[] = [];

  for (const [locationCode, lines] of groups) {
    const destination = resolveDestination(
      locationCode,
      branches,
      hubs,
      locationNameByCode.get(locationCode) ?? null,
    );
    if (!destination) {
      skipped.push({
        branchCode: locationCode,
        locationCode,
        status: "skipped",
        reason: `ไม่สามารถจัดกลุ่มคลัง "${locationCode}" ได้`,
        lineCount: lines.length,
      });
      continue;
    }

    if (!canAccessClassification(session, destination.branch, 
      destination.kind === "central"
        ? { kind: "central", branchId: destination.branch.id }
        : { kind: "hub", hub: destination.hub },
    )) {
      continue;
    }

    const key = getDocumentGroupKey(destination);
    const bucket = linesByDestination.get(key) ?? { destination, lines: [] };
    bucket.lines.push(...lines);
    linesByDestination.set(key, bucket);
  }

  return { linesByDestination, skipped };
}

async function upsertImportedDocument(
  destination: DocumentDestination,
  countDateKey: string,
  lines: ExpressStockCountLine[],
): Promise<ExpressSyncDocumentResult> {
  const branch = destination.branch;
  const locationCode = destination.locationCode;
  const locationName = destination.locationName;
  const isCentral = destination.kind === "central";
  const hub = destination.kind === "hub" ? destination.hub : null;

  const documentId = buildLocationDocumentId(branch.id, countDateKey, locationCode);
  const documentNo = buildLocationDocumentNo(
    locationCode,
    countDateKey,
    locationName,
  );
  const documentDate = dateKeyToUtcDateOnly(countDateKey);
  if (!documentDate) {
    return {
      branchCode: branch.code,
      branchName: branch.name,
      hubCode: hub?.code,
      hubName: hub?.name,
      hubShortName: hub?.shortName ?? undefined,
      locationCode,
      locationName,
      isCentral,
      documentId,
      documentNo,
      lineCount: 0,
      status: "skipped",
      reason: "วันที่เอกสารไม่ถูกต้อง",
    };
  }

  const productLines = lines.map((line, index) =>
    mapExpressLineToProductLine(line, documentId, index + 1),
  );
  const now = new Date();

  const existing = await prisma.countDocument.findUnique({
    where: { id: documentId },
  });

  if (existing && existing.status !== DocumentStatus.IMPORTED) {
    return {
      branchCode: branch.code,
      branchName: branch.name,
      hubCode: hub?.code,
      hubName: hub?.name,
      hubShortName: hub?.shortName ?? undefined,
      locationCode,
      locationName,
      isCentral,
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
          documentDate,
          hubId: hub?.id ?? null,
          locationCode,
          locationName,
          isCentral,
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
          documentDate,
          branchId: branch.id,
          hubId: hub?.id ?? null,
          locationCode,
          locationName,
          isCentral,
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
    branchCode: branch.code,
    branchName: branch.name,
    hubCode: hub?.code,
    hubName: hub?.name,
    hubShortName: hub?.shortName ?? undefined,
    locationCode,
    locationName,
    isCentral,
    documentId,
    documentNo,
    lineCount: productLines.length,
    status: existing ? "updated" : "created",
  };
}

export async function syncExpressCountDate(
  session: MockSession,
  countDate: string,
  locationInputs: Array<string | ExpressSyncLocationInput>,
): Promise<ExpressSyncResult | { error: string }> {
  if (!canSyncExpress(session.role)) {
    return { error: "Access denied" };
  }

  const parsedDate = parseCountDate(countDate);
  if (!parsedDate) {
    return { error: "Invalid date format. Use yyyy-MM-dd" };
  }

  const selectedLocations = normalizeSelectedLocations(locationInputs);
  if (selectedLocations.length === 0) {
    return { error: "locations are required" };
  }

  const selectedLocationCodes = selectedLocations.map((item) => item.code);
  const locationNameByCode = new Map(
    selectedLocations.map((item) => [item.code, item.name ?? null]),
  );

  const branches = await loadBranchesForExpressLookup();
  const hubs = await loadActiveHubs();

  const invalidLocationCodes = selectedLocationCodes.filter((code) => {
    const destination = resolveDestination(
      code,
      branches,
      hubs,
      locationNameByCode.get(code) ?? null,
    );
    if (!destination) return true;
    return !canAccessClassification(
      session,
      destination.branch,
      destination.kind === "central"
        ? { kind: "central", branchId: destination.branch.id }
        : { kind: "hub", hub: destination.hub },
    );
  });

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
  const { linesByDestination, skipped: skippedResults } =
    aggregateExpressLinesByDocument(
      groups,
      branches,
      hubs,
      session,
      locationNameByCode,
    );

  const results: ExpressSyncDocumentResult[] = [...skippedResults];

  for (const { destination, lines } of linesByDestination.values()) {
    results.push(
      await upsertImportedDocument(destination, countDate, lines),
    );
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
  const hubs = await loadActiveHubs();
  const locations = buildLocationPreviews(
    expressResult.locations,
    branches,
    hubs,
    session,
  );

  return {
    date: countDate,
    locations,
  };
}
