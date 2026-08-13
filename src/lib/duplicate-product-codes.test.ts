import assert from "node:assert/strict";
import {
  findDuplicateProductCodes,
  formatDuplicateProductCodeWarning,
} from "@/lib/duplicate-product-codes";

function testNoDuplicates() {
  assert.deepEqual(findDuplicateProductCodes(["A", "B", "C"]), []);
  assert.equal(formatDuplicateProductCodeWarning([]), null);
}

function testFindsCodesThatAppearMoreThanOnce() {
  assert.deepEqual(
    findDuplicateProductCodes(["A", "B", "A", "C", "B", "B"]),
    ["A", "B"],
  );
}

function testTrimsAndIgnoresEmpty() {
  assert.deepEqual(
    findDuplicateProductCodes(["  A  ", "A", "", "   ", "C"]),
    ["A"],
  );
}

function testFormatsWarning() {
  assert.equal(
    formatDuplicateProductCodeWarning(["A123", "B456"]),
    "พบรหัสสินค้าซ้ำ 2 รหัส: A123, B456",
  );
}

function testFormatsManyCodesWithRemainder() {
  assert.equal(
    formatDuplicateProductCodeWarning(["A", "B", "C", "D", "E", "F", "G"]),
    "พบรหัสสินค้าซ้ำ 7 รหัส: A, B, C, D, E และอีก 2",
  );
}

testNoDuplicates();
testFindsCodesThatAppearMoreThanOnce();
testTrimsAndIgnoresEmpty();
testFormatsWarning();
testFormatsManyCodesWithRemainder();
console.log("duplicate-product-codes.test: OK");
