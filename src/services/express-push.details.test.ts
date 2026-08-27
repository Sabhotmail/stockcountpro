import assert from "node:assert/strict";
import { COUNT_QTY_NOT_COUNTED } from "@/lib/count-qty";
import { buildExpressPushDetails } from "@/services/express-push.service";
import type { CountEntry, ProductLine } from "@/types/count";

function line(
  overrides: Partial<ProductLine> & { lineId: string; productCode: string },
): ProductLine {
  return {
    lineNo: 1,
    productName: "Test",
    barcode: overrides.productCode,
    unitPieceName: "ชิ้น",
    caseRatio: 12,
    packRatio: 1,
    allowCase: true,
    allowPack: false,
    allowPiece: true,
    ...overrides,
  };
}

function countedEntry(
  lineId: string,
  qtyCase: number | null,
  qtyPiece: number | null,
  totalBaseQty: number | null,
): CountEntry {
  return {
    lineId,
    qtyCase,
    qtyPack: null,
    qtyPiece,
    totalBaseQty,
    note: null,
    revision: 1,
    updatedAt: "2026-08-27T00:00:00.000Z",
    updatedBy: "u1",
  };
}

const meta = {
  locationCode: "32F1",
  countDate: "2026-08-27",
  userIdSent: "admin",
  changedDate: "2026-08-28",
};

function testSendsEverySkuAndZerosUncounted() {
  const details = buildExpressPushDetails({
    productLines: [
      line({ lineId: "a", productCode: "SKU-A", lineNo: 1 }),
      line({ lineId: "b", productCode: "SKU-B", lineNo: 2 }),
    ],
    entries: [countedEntry("a", 1, 2, 14)],
    ...meta,
  });

  assert.equal(details.length, 2);
  assert.equal(details[0]?.ProductCode, "SKU-A");
  assert.equal(details[0]?.CaseQty, 1);
  assert.equal(details[0]?.PieceQty, 2);
  assert.equal(details[0]?.PhysicalBalance, 14);
  assert.equal(details[1]?.ProductCode, "SKU-B");
  assert.equal(details[1]?.CaseQty, 0);
  assert.equal(details[1]?.PieceQty, 0);
  assert.equal(details[1]?.PhysicalBalance, 0);
}

function testMinusOneUncountedBecomesZero() {
  const details = buildExpressPushDetails({
    productLines: [line({ lineId: "a", productCode: "SKU-A" })],
    entries: [
      countedEntry("a", COUNT_QTY_NOT_COUNTED, COUNT_QTY_NOT_COUNTED, null),
    ],
    ...meta,
  });

  assert.equal(details.length, 1);
  assert.equal(details[0]?.CaseQty, 0);
  assert.equal(details[0]?.PieceQty, 0);
  assert.equal(details[0]?.PhysicalBalance, 0);
}

function testCountedZeroIsStillSentAsZero() {
  const details = buildExpressPushDetails({
    productLines: [line({ lineId: "a", productCode: "SKU-A" })],
    entries: [countedEntry("a", 0, 0, 0)],
    ...meta,
  });

  assert.equal(details.length, 1);
  assert.equal(details[0]?.CaseQty, 0);
  assert.equal(details[0]?.PieceQty, 0);
  assert.equal(details[0]?.PhysicalBalance, 0);
}

function testEmptyDocumentHasNoDetails() {
  const details = buildExpressPushDetails({
    productLines: [],
    entries: [],
    ...meta,
  });
  assert.equal(details.length, 0);
}

testSendsEverySkuAndZerosUncounted();
testMinusOneUncountedBecomesZero();
testCountedZeroIsStillSentAsZero();
testEmptyDocumentHasNoDetails();
console.log("express-push.details.test: OK");
