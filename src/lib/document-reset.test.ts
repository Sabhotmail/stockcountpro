import assert from "node:assert/strict";
import { canResetDocumentStatus } from "@/lib/document-reset";
import { DocumentStatus } from "@/types/count";

assert.equal(canResetDocumentStatus(DocumentStatus.COUNTING), true);
assert.equal(canResetDocumentStatus(DocumentStatus.RECOUNT_REQUESTED), true);
assert.equal(canResetDocumentStatus(DocumentStatus.SUBMITTED), true);
assert.equal(canResetDocumentStatus(DocumentStatus.REVIEWING), true);
assert.equal(canResetDocumentStatus(DocumentStatus.IMPORTED), false);
assert.equal(canResetDocumentStatus(DocumentStatus.APPROVED), false);
assert.equal(canResetDocumentStatus(DocumentStatus.COMPLETED), false);

console.log("document-reset.test: OK");
