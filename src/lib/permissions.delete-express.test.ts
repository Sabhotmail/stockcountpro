import assert from "node:assert/strict";
import { canDeleteExpressStockCount } from "@/lib/permissions";
import { UserRole } from "@/types/user";

function testAllowedRoles() {
  assert.equal(canDeleteExpressStockCount(UserRole.ADMIN), true);
  assert.equal(canDeleteExpressStockCount(UserRole.HQ), true);
  assert.equal(canDeleteExpressStockCount(UserRole.SUPERVISOR), true);
}

function testDeniedRoles() {
  const denied = [
    UserRole.STAFF,
    UserRole.COUNTER,
    UserRole.BRANCH_MANAGER,
    UserRole.VIEWER,
  ] as const;
  for (const role of denied) {
    assert.equal(canDeleteExpressStockCount(role), false, role);
  }
}

testAllowedRoles();
testDeniedRoles();
console.log("permissions.delete-express.test: OK");
