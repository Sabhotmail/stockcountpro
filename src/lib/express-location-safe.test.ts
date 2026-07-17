import assert from "node:assert/strict";
import { assertSafeExpressLocationCodes } from "@/lib/express-location";

function testAcceptsAlphanumeric() {
  const r = assertSafeExpressLocationCodes(["32f1", " 32G1 "]);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.joined, "32F1,32G1");
}

function testRejectsTraversal() {
  const r = assertSafeExpressLocationCodes(["32F1/../api"]);
  assert.equal(r.ok, false);
}

function testRejectsEmpty() {
  const r = assertSafeExpressLocationCodes(["  ", ""]);
  assert.equal(r.ok, false);
}

testAcceptsAlphanumeric();
testRejectsTraversal();
testRejectsEmpty();
console.log("express-location-safe.test: OK");
