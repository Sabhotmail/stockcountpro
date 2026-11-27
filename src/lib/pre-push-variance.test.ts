import assert from "node:assert/strict";
import {
  indexBalancesByProductCode,
  projectedDiff,
} from "@/lib/pre-push-variance";

assert.equal(projectedDiff(283, 7483), -7200);
assert.equal(projectedDiff(72, 72), 0);
assert.equal(projectedDiff(null, 100), null);
assert.equal(projectedDiff(10, null), null);

const indexed = indexBalancesByProductCode([
  { ProductCode: " 1010030003 ", LocationBalance: 7483 },
  { ProductCode: "1010010001", LocationBalance: 72 },
]);
assert.equal(indexed["1010030003"], 7483);
assert.equal(indexed["missing"], undefined);

console.log("pre-push-variance.test: OK");
