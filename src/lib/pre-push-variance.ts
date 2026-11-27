import { normalizeProductCode } from "@/lib/express-variance-map";

export function projectedDiff(
  appQty: number | null | undefined,
  locationBalance: number | null | undefined,
): number | null {
  if (appQty == null || locationBalance == null) return null;
  if (Number.isNaN(appQty) || Number.isNaN(locationBalance)) return null;
  return Number(appQty) - Number(locationBalance);
}

export type BalanceRowInput = {
  ProductCode: string;
  LocationBalance: number | null;
};

export function indexBalancesByProductCode(
  rows: BalanceRowInput[],
): Record<string, number | null> {
  const indexed: Record<string, number | null> = {};
  for (const row of rows) {
    const key = normalizeProductCode(row.ProductCode);
    if (!key) continue;
    indexed[key] = row.LocationBalance;
  }
  return indexed;
}
