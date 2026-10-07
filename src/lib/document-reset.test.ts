import assert from "node:assert/strict";
import {
  canResetDocumentStatus,
  resetConfirmCode,
} from "@/lib/document-reset";
import { DocumentStatus } from "@/types/count";

assert.equal(canResetDocumentStatus(DocumentStatus.COUNTING), true);
assert.equal(canResetDocumentStatus(DocumentStatus.RECOUNT_REQUESTED), true);
assert.equal(canResetDocumentStatus(DocumentStatus.SUBMITTED), true);
assert.equal(canResetDocumentStatus(DocumentStatus.REVIEWING), true);
assert.equal(canResetDocumentStatus(DocumentStatus.IMPORTED), false);
assert.equal(canResetDocumentStatus(DocumentStatus.APPROVED), false);
assert.equal(canResetDocumentStatus(DocumentStatus.COMPLETED), false);

assert.equal(
  resetConfirmCode({
    locationCode: "2411",
    documentNo: "2411 · คลัง Van S CHM คันที่ 1 (2026-08-28)",
  }),
  "2411",
);
assert.equal(
  resetConfirmCode({
    locationCode: null,
    documentNo: "DOC-ONLY",
  }),
  "DOC-ONLY",
);

console.log("document-reset.test: OK");
