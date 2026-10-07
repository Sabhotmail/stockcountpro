import assert from "node:assert/strict";
import { filterLinesForRole, stripExpectedQty } from "@/lib/product-line-filter";
import type { ProductLine } from "@/types/count";
import { UserRole } from "@/types/user";

function sampleLine(overrides: Partial<ProductLine> = {}): ProductLine {
  return {
    lineId: "line-1",
    lineNo: 1,
    productCode: "P001",
    productName: "Test",
    barcode: "123",
    unitCaseName: "ลัง",
    unitPieceName: "ชิ้น",
    caseRatio: 12,
    packRatio: 1,
    allowCase: true,
    allowPack: false,
    allowPiece: true,
    expectedQty: 100,
    expectedQtyCase: 8,
    expectedQtyPiece: 4,
    ...overrides,
  };
}

const stripped = stripExpectedQty([sampleLine()]);
assert.equal(stripped.length, 1);
assert.equal(
  "expectedQty" in stripped[0]!,
  false,
  "strip removes expectedQty",
);
assert.equal(
  "expectedQtyCase" in stripped[0]!,
  false,
  "strip removes expectedQtyCase",
);
assert.equal(
  "expectedQtyPiece" in stripped[0]!,
  false,
  "strip removes expectedQtyPiece",
);

const staff = filterLinesForRole([sampleLine()], UserRole.STAFF);
assert.equal("expectedQty" in staff[0]!, false, "STAFF stripped");

const counter = filterLinesForRole([sampleLine()], UserRole.COUNTER);
assert.equal("expectedQty" in counter[0]!, false, "COUNTER stripped");

const viewer = filterLinesForRole([sampleLine()], UserRole.VIEWER);
assert.equal("expectedQty" in viewer[0]!, false, "VIEWER stripped");

const supervisor = filterLinesForRole([sampleLine()], UserRole.SUPERVISOR);
assert.equal(supervisor[0]!.expectedQty, 100, "SUPERVISOR keeps expectedQty");

const admin = filterLinesForRole([sampleLine()], UserRole.ADMIN);
assert.equal(admin[0]!.expectedQty, 100, "ADMIN keeps expectedQty");

console.log("product-line-filter.test: OK");
