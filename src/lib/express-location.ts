export function normalizeExpressLocationPrefix(
  value: string | null | undefined,
): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim().toUpperCase();
  return trimmed.length > 0 ? trimmed : null;
}

export function validateExpressLocationPrefix(value: string): string | null {
  if (!/^[A-Z0-9]{2}$/.test(value)) {
    return "Express location prefix must be exactly 2 alphanumeric characters";
  }
  return null;
}

const LOCATION_CODE_RE = /^[A-Z0-9]+$/;

export function assertSafeExpressLocationCodes(
  codes: string[],
): { ok: true; joined: string } | { ok: false; error: string } {
  const normalized: string[] = [];
  for (const raw of codes) {
    const code = raw.trim().toUpperCase();
    if (!code) continue;
    if (!LOCATION_CODE_RE.test(code)) {
      return {
        ok: false,
        error: `Invalid location code: ${raw.trim()}`,
      };
    }
    normalized.push(code);
  }
  if (normalized.length === 0) {
    return { ok: false, error: "locations are required" };
  }
  return { ok: true, joined: normalized.join(",") };
}

export function extractLocationPrefix(locationCode: string): string | null {
  const normalized = locationCode.trim().toUpperCase();
  if (normalized.length < 2) return null;
  return normalized.slice(0, 2);
}

export const BKK3_HQ_CENTRAL_LOCATION_CODES = [
  "24G1",
  "24D1",
  "24F1",
  "24Z1",
  "24R1",
  "24S1",
  "24C1",
] as const;

const HQ_CENTRAL_SET = new Set<string>(BKK3_HQ_CENTRAL_LOCATION_CODES);
const GDFZ_TYPES = new Set(["G", "D", "F", "Z"]);

export type HubForClassify = {
  id: string;
  branchId: string;
  code: string;
  name: string;
  shortName: string | null;
  suffixLetter: string | null;
  isActive: boolean;
};

export type LocationClassification =
  | { kind: "hub"; hub: HubForClassify }
  | { kind: "central"; branchId: string }
  | { kind: "unmapped" };

export function classifyLocation(
  locationCode: string,
  branchPrefix: string,
  hubs: HubForClassify[],
): LocationClassification {
  const code = locationCode.trim().toUpperCase();
  const prefix = branchPrefix.trim().toUpperCase();

  if (!code.startsWith(prefix)) {
    return { kind: "unmapped" };
  }

  const branchId = hubs[0]?.branchId;
  if (!branchId) {
    return { kind: "unmapped" };
  }

  if (HQ_CENTRAL_SET.has(code)) {
    return { kind: "central", branchId };
  }

  const activeHubs = hubs.filter((hub) => hub.isActive);
  const hubByCode = new Map(activeHubs.map((hub) => [hub.code, hub]));
  const hubBySuffix = new Map(
    activeHubs
      .filter((hub) => hub.suffixLetter)
      .map((hub) => [hub.suffixLetter!.toUpperCase(), hub]),
  );

  if (code.length >= 4) {
    const typeChar = code[2];
    const suffixChar = code[3];
    if (GDFZ_TYPES.has(typeChar) && hubBySuffix.has(suffixChar)) {
      return { kind: "hub", hub: hubBySuffix.get(suffixChar)! };
    }
  }

  const hubDigit = code[2];
  if (hubDigit && hubByCode.has(hubDigit)) {
    return { kind: "hub", hub: hubByCode.get(hubDigit)! };
  }

  return { kind: "unmapped" };
}

export function classifyLocationForBranch(
  locationCode: string,
  branchId: string,
  branchPrefix: string | null,
  hubs: HubForClassify[],
): LocationClassification {
  const prefix = branchPrefix?.trim().toUpperCase();
  if (!prefix) {
    return { kind: "unmapped" };
  }

  const branchHubs = hubs.filter((hub) => hub.branchId === branchId);
  if (branchHubs.length === 0) {
    return { kind: "unmapped" };
  }

  return classifyLocation(locationCode, prefix, branchHubs);
}
