import type { CountEntry } from "@/types/count";
import { createProductLinesForDocument } from "@/mock/products";

function makeEntry(
  lineId: string,
  userId: string,
  qtyCase: number | null,
  qtyPack: number | null,
  qtyPiece: number | null,
  totalBaseQty: number | null,
  note: string | null = null,
): CountEntry {
  return {
    lineId,
    qtyCase,
    qtyPack,
    qtyPiece,
    totalBaseQty,
    note,
    revision: 1,
    updatedAt: new Date().toISOString(),
    updatedBy: userId,
  };
}

const bkk1002Lines = createProductLinesForDocument("doc_bkk1_002", 12);
const bkk1003Lines = createProductLinesForDocument("doc_bkk1_003", 12);
const chm001Lines = createProductLinesForDocument("doc_chm_001", 12);

export const initialCountEntries: CountEntry[] = [
  // doc_bkk1_002 - 4 counted lines
  makeEntry(bkk1002Lines[0].lineId, "user_bkk1_staff", 2, 1, 3, 2 * 24 + 1 * 6 + 3),
  makeEntry(bkk1002Lines[1].lineId, "user_bkk1_staff", 1, 0, 0, 24),
  makeEntry(bkk1002Lines[2].lineId, "user_bkk1_staff", null, 3, 5, 3 * 10 + 5),
  makeEntry(bkk1002Lines[3].lineId, "user_bkk1_staff", null, null, 0, 0, "ไม่พบสินค้า"),
  // doc_bkk1_003 - all counted
  ...bkk1003Lines.map((line, i) =>
    makeEntry(
      line.lineId,
      "user_bkk1_staff",
      i % 3 === 0 ? 1 : null,
      i % 3 === 1 ? 2 : null,
      i % 3 === 2 ? 5 : 3,
      (i % 3 === 0 ? 1 * line.caseRatio : 0) +
        (i % 3 === 1 ? 2 * line.packRatio : 0) +
        (i % 3 === 2 ? 5 : 3),
    ),
  ),
  // doc_chm_001 - completed
  ...chm001Lines.map((line, i) =>
    makeEntry(line.lineId, "user_admin", null, null, 10 + i, 10 + i),
  ),
];

export const documentProductLines: Record<string, ReturnType<typeof createProductLinesForDocument>> = {
  doc_bkk1_001: createProductLinesForDocument("doc_bkk1_001", 12),
  doc_bkk1_002: bkk1002Lines,
  doc_bkk1_003: bkk1003Lines,
  doc_bkk2_001: createProductLinesForDocument("doc_bkk2_001", 12),
  doc_chm_001: chm001Lines,
};
