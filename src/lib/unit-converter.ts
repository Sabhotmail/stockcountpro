import type { ProductLine } from "@/types/count";

export function calculateTotalBaseQty(
  line: Pick<ProductLine, "caseRatio" | "packRatio">,
  qtyCase: number | null,
  qtyPack: number | null,
  qtyPiece: number | null,
): number | null {
  if (qtyCase === null && qtyPack === null && qtyPiece === null) {
    return null;
  }

  const c = qtyCase ?? 0;
  const p = qtyPack ?? 0;
  const pc = qtyPiece ?? 0;

  return c * line.caseRatio + p * line.packRatio + pc;
}

/**
 * Convert excess pieces into cases when piece qty reaches caseRatio.
 * Example: caseRatio=72, case=1, piece=80 → case=2, piece=8
 */
export function convertPieceOverflowToCase(
  line: Pick<ProductLine, "allowCase" | "caseRatio">,
  qtyCase: number | null,
  qtyPiece: number | null,
): { qtyCase: number | null; qtyPiece: number | null } {
  if (!line.allowCase || line.caseRatio <= 1) {
    return { qtyCase, qtyPiece };
  }

  if (qtyCase === null && qtyPiece === null) {
    return { qtyCase, qtyPiece };
  }

  const totalPieces = (qtyCase ?? 0) * line.caseRatio + (qtyPiece ?? 0);
  const nextCase = Math.floor(totalPieces / line.caseRatio);
  const nextPiece = totalPieces % line.caseRatio;

  return {
    qtyCase: nextCase,
    qtyPiece: nextPiece,
  };
}

export function isEntryCounted(
  qtyCase: number | null,
  qtyPack: number | null,
  qtyPiece: number | null,
): boolean {
  return qtyCase !== null || qtyPack !== null || qtyPiece !== null;
}

export function validateQuantities(
  line: Pick<ProductLine, "allowCase" | "allowPack" | "allowPiece">,
  qtyCase: number | null | undefined,
  qtyPack: number | null | undefined,
  qtyPiece: number | null | undefined,
): string | null {
  const fields = [
    { allowed: line.allowCase, value: qtyCase, name: "qtyCase" },
    { allowed: line.allowPack, value: qtyPack, name: "qtyPack" },
    { allowed: line.allowPiece, value: qtyPiece, name: "qtyPiece" },
  ];

  for (const field of fields) {
    if (field.value === undefined || field.value === null) continue;
    if (!field.allowed) {
      return `${field.name} is not allowed for this product`;
    }
    if (!Number.isInteger(field.value) || field.value < 0) {
      return `${field.name} must be a non-negative integer`;
    }
  }

  return null;
}
