/** Staff can enter -1 on the count page to mark a unit field as not yet counted. */
export const COUNT_QTY_NOT_COUNTED = -1;

export function requiresQtySaveConfirmation(
  value: number | null,
  expressFieldNotCounted: boolean,
): boolean {
  if (value === null || value === COUNT_QTY_NOT_COUNTED) return false;
  if (expressFieldNotCounted) return false;
  return true;
}

export function isQtyFieldCounted(value: number | null): boolean {
  return value !== null && value !== COUNT_QTY_NOT_COUNTED;
}

export function effectiveQtyForTotal(value: number | null): number {
  if (value === null || value === COUNT_QTY_NOT_COUNTED) return 0;
  return value;
}
