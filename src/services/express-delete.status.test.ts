import assert from "node:assert/strict";
import {
  expressDeleteBlockedReason,
  isExpressDeleteAllowedStatus,
} from "@/services/count-document.service";
import { DocumentStatus } from "@/types/count";

function testAllowedStatuses() {
  assert.equal(isExpressDeleteAllowedStatus(DocumentStatus.IMPORTED), true);
  assert.equal(isExpressDeleteAllowedStatus(DocumentStatus.COUNTING), true);
  assert.equal(
    isExpressDeleteAllowedStatus(DocumentStatus.RECOUNT_REQUESTED),
    true,
  );
}

function testBlockedStatuses() {
  const blocked = [
    DocumentStatus.SUBMITTED,
    DocumentStatus.REVIEWING,
    DocumentStatus.APPROVED,
    DocumentStatus.COMPLETED,
  ] as const;
  for (const status of blocked) {
    assert.equal(isExpressDeleteAllowedStatus(status), false, status);
    assert.ok(expressDeleteBlockedReason(status), status);
  }
}

testAllowedStatuses();
testBlockedStatuses();
console.log("express-delete.status.test: OK");
