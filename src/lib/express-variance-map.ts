import type { ExpressVarianceLine } from "@/types/express-variance";

export function normalizeProductCode(code: string): string {
  return code.trim().toUpperCase();
}

export type ExpressVarianceRowInput = ExpressVarianceLine & {
  ProductCode: string;
};

export function indexVarianceByProductCode(
  rows: ExpressVarianceRowInput[],
): Record<string, ExpressVarianceLine> {
  const indexed: Record<string, ExpressVarianceLine> = {};
  for (const row of rows) {
    const key = normalizeProductCode(row.ProductCode);
    if (!key) continue;
    indexed[key] = {
      PhysicalBalance: row.PhysicalBalance,
      LocationBalance: row.LocationBalance,
      DifferentQty: row.DifferentQty,
      CountFlag: row.CountFlag,
    };
  }
  return indexed;
}
