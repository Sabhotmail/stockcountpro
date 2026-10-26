import assert from "node:assert/strict";
import { summaryFlushToast } from "@/lib/count-save-flush";

assert.equal(
  summaryFlushToast({ lineStatuses: ["saving"], noteFailed: false }),
  "ยังบันทึกไม่เสร็จ กรุณารอแล้วกดสรุปอีกครั้ง",
);
assert.equal(
  summaryFlushToast({ lineStatuses: ["waiting"], noteFailed: false }),
  "ยังบันทึกไม่เสร็จ กรุณารอแล้วกดสรุปอีกครั้ง",
);
assert.equal(
  summaryFlushToast({ lineStatuses: ["failed"], noteFailed: false }),
  "บันทึกบางรายการไม่สำเร็จ กรุณากดบันทึกอีกครั้งก่อนส่งสรุป",
);
assert.equal(
  summaryFlushToast({ lineStatuses: ["saving", "failed"], noteFailed: false }),
  "บันทึกบางรายการไม่สำเร็จ กรุณากดบันทึกอีกครั้งก่อนส่งสรุป",
);
assert.equal(
  summaryFlushToast({ lineStatuses: ["saved"], noteFailed: true }),
  "บันทึกบางรายการไม่สำเร็จ กรุณากดบันทึกอีกครั้งก่อนส่งสรุป",
);
assert.equal(
  summaryFlushToast({ lineStatuses: ["saved"], noteFailed: false }),
  null,
);

console.log("count-save-flush.test: OK");
