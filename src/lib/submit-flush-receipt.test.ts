import assert from "node:assert/strict";
import {
  clearFlushReceipt,
  flushReceiptKey,
  hasValidFlushReceipt,
  writeFlushReceipt,
} from "@/lib/submit-flush-receipt";

assert.equal(
  flushReceiptKey("doc1", "ver1"),
  "scp:flush:doc1:ver1",
  "receipt key format",
);

// jsdom-less: exercise helpers only when sessionStorage exists (browser).
if (typeof sessionStorage !== "undefined") {
  clearFlushReceipt("doc1", "ver1");
  assert.equal(hasValidFlushReceipt("doc1", "ver1"), false, "empty → false");
  writeFlushReceipt("doc1", "ver1");
  assert.equal(hasValidFlushReceipt("doc1", "ver1"), true, "written → true");
  assert.equal(hasValidFlushReceipt("doc1", "other"), false, "wrong version");
  clearFlushReceipt("doc1", "ver1");
  assert.equal(hasValidFlushReceipt("doc1", "ver1"), false, "cleared → false");
}

console.log("submit-flush-receipt.test: OK");
