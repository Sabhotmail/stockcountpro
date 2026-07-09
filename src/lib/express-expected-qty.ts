/** Express uses -1 to mean the product line has not been counted in Express yet. */
export const EXPRESS_EXPECTED_NOT_COUNTED = -1;

export function mapExpressExpectedQty(
  transactionValue: number | null | undefined,
  physicalBalance: number | null | undefined,
): number | null {
  const raw = transactionValue ?? physicalBalance;
  if (raw === undefined || raw === null) return null;
  const rounded = Math.round(raw);
  if (rounded === EXPRESS_EXPECTED_NOT_COUNTED) return null;
  return rounded;
}

export function hasComparableExpectedQty(
  expectedQty: number | null | undefined,
): boolean {
  if (expectedQty === null || expectedQty === undefined) return false;
  if (expectedQty === EXPRESS_EXPECTED_NOT_COUNTED) return false;
  return true;
}

export function formatExpectedQtyForSupervisor(
  expectedQty: number | null | undefined,
): string {
  if (!hasComparableExpectedQty(expectedQty)) {
    return "ยังไม่ตรวจนับ";
  }
  return String(expectedQty);
}
