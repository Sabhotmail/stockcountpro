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

/** Display counted qty as e.g. `2 ลัง · 5 ชิ้น` for summary/review tables. */
export function formatCountQtyCasePiece(params: {
  qtyCase: number | null;
  qtyPack?: number | null;
  qtyPiece: number | null;
  allowCase: boolean;
  allowPack?: boolean;
  allowPiece: boolean;
  unitCaseName?: string | null;
  unitPackName?: string | null;
  unitPieceName?: string | null;
  isCounted: boolean;
}): string {
  const {
    qtyCase,
    qtyPack,
    qtyPiece,
    allowCase,
    allowPack,
    allowPiece,
    unitCaseName,
    unitPackName,
    unitPieceName,
    isCounted,
  } = params;

  if (!isCounted) return "—";

  const parts: string[] = [];
  if (allowCase && isQtyFieldCounted(qtyCase)) {
    parts.push(`${qtyCase} ${unitCaseName?.trim() || "ลัง"}`);
  }
  if (allowPack && isQtyFieldCounted(qtyPack ?? null)) {
    parts.push(`${qtyPack} ${unitPackName?.trim() || "แพ็ค"}`);
  }
  if (allowPiece && isQtyFieldCounted(qtyPiece)) {
    parts.push(`${qtyPiece} ${unitPieceName?.trim() || "ชิ้น"}`);
  }

  if (parts.length === 0) return "0";
  return parts.join(" · ");
}
