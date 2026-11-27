import assert from "node:assert/strict";
import { normalizeProductCode } from "@/lib/express-variance-map";

assert.equal(normalizeProductCode(" 1010010001 "), "1010010001");
assert.equal(normalizeProductCode("abc"), "ABC");
console.log("express-variance-map.test: OK");
