import assert from "node:assert/strict";
import {
  indexVarianceByProductCode,
  normalizeProductCode,
} from "@/lib/express-variance-map";

assert.equal(normalizeProductCode(" 1010010001 "), "1010010001");

const indexed = indexVarianceByProductCode([
  {
    ProductCode: "1010010001",
    PhysicalBalance: 72,
    LocationBalance: 72,
    DifferentQty: 0,
    CountFlag: "3",
  },
  {
    ProductCode: " 1060010004 ",
    PhysicalBalance: 3648,
    LocationBalance: 3600,
    DifferentQty: 48,
    CountFlag: "3",
  },
]);
assert.equal(indexed["1060010004"]?.DifferentQty, 48);
assert.equal(indexed["missing"], undefined);
console.log("express-variance-map.test: OK");
