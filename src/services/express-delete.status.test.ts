import assert from "node:assert/strict";
import {
  expressDeleteBlockedReason,
  isExpressDeleteAllowedStatus,
} from "@/services/count-document.service";
import { DocumentStatus } from "@/types/count";

function testAllowedStatuses() {
  assert.equal(isExpressDeleteAllowedStatus(DocumentStatus.IMPORTED), true);
  assert.equal(expressDeleteBlockedReason(DocumentStatus.IMPORTED, 0), null);
}

function testBlockedStatuses() {
  const countedOrStarted = [
    DocumentStatus.COUNTING,
    DocumentStatus.RECOUNT_REQUESTED,
  ] as const;
  for (const status of countedOrStarted) {
    assert.equal(isExpressDeleteAllowedStatus(status), false, status);
    assert.equal(
      expressDeleteBlockedReason(status),
      "เอกสารถูกนับแล้ว ไม่สามารถลบได้",
      status,
    );
  }

  const submitted = [
    DocumentStatus.SUBMITTED,
    DocumentStatus.REVIEWING,
  ] as const;
  for (const status of submitted) {
    assert.equal(isExpressDeleteAllowedStatus(status), false, status);
    assert.equal(
      expressDeleteBlockedReason(status),
      "เอกสารส่งให้หัวหน้างานแล้ว ไม่สามารถลบได้",
      status,
    );
  }

  const closed = [
    DocumentStatus.APPROVED,
    DocumentStatus.COMPLETED,
  ] as const;
  for (const status of closed) {
    assert.equal(isExpressDeleteAllowedStatus(status), false, status);
    assert.equal(
      expressDeleteBlockedReason(status),
      "เอกสารอนุมัติหรือปิดแล้ว ไม่สามารถลบได้",
      status,
    );
  }
}

function testImportedWithCountedLinesBlocked() {
  assert.equal(
    expressDeleteBlockedReason(DocumentStatus.IMPORTED, 1),
    "เอกสารถูกนับแล้ว ไม่สามารถลบได้",
  );
}

testAllowedStatuses();
testBlockedStatuses();
testImportedWithCountedLinesBlocked();
console.log("express-delete.status.test: OK");
