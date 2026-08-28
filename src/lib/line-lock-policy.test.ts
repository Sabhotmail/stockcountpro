import assert from "node:assert/strict";
import { shouldEnforceLineLocks } from "@/lib/line-lock-policy";

function testSoloUserDoesNotNeedLocks() {
  assert.equal(shouldEnforceLineLocks([], "u1"), false);
  assert.equal(shouldEnforceLineLocks(["u1"], "u1"), false);
}

function testOtherViewerEnforcesLocks() {
  assert.equal(shouldEnforceLineLocks(["u1", "u2"], "u1"), true);
  assert.equal(shouldEnforceLineLocks(["u2"], "u1"), true);
}

testSoloUserDoesNotNeedLocks();
testOtherViewerEnforcesLocks();
console.log("line-lock-policy.test: OK");
