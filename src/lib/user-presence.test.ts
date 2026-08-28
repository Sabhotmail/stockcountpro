import assert from "node:assert/strict";
import {
  composePresenceDetail,
  describePresencePath,
  isPresenceActive,
} from "@/lib/user-presence";

function testDescribesCountPageAndDocument() {
  assert.deepEqual(describePresencePath("/tablet/count/doc_loc_2411"), {
    pageLabel: "นับสต็อก",
    documentId: "doc_loc_2411",
  });
  assert.deepEqual(
    describePresencePath("/tablet/count/doc_loc_2411/summary"),
    {
      pageLabel: "สรุปการนับ",
      documentId: "doc_loc_2411",
    },
  );
}

function testDescribesReviewAndAdminDocument() {
  assert.deepEqual(describePresencePath("/supervisor/review/doc_1"), {
    pageLabel: "ตรวจนับ",
    documentId: "doc_1",
  });
  assert.deepEqual(describePresencePath("/admin/documents/doc_1"), {
    pageLabel: "เอกสาร",
    documentId: "doc_1",
  });
}

function testDescribesKnownPagesWithoutDocument() {
  assert.equal(describePresencePath("/admin/dashboard").pageLabel, "ภาพรวม");
  assert.equal(describePresencePath("/admin/presence").pageLabel, "ผู้ที่กำลังใช้งาน");
  assert.equal(describePresencePath("/tablet/documents").pageLabel, "รายการเอกสาร");
  assert.equal(describePresencePath("/unknown").pageLabel, "กำลังใช้งานระบบ");
  assert.equal(describePresencePath("/unknown").documentId, null);
}

function testComposesLocationOntoPageLabel() {
  assert.equal(
    composePresenceDetail("นับสต็อก", {
      locationCode: "2411",
      locationName: "คลัง 3",
      documentNo: "SC-1",
    }),
    "นับสต็อก · 2411 คลัง 3",
  );
  assert.equal(composePresenceDetail("ภาพรวม", null), "ภาพรวม");
}

function testExpiredPresenceIsInactive() {
  const now = new Date("2026-08-28T02:00:00.000Z");
  assert.equal(
    isPresenceActive(new Date("2026-08-28T01:59:00.000Z"), now),
    false,
  );
  assert.equal(
    isPresenceActive(new Date("2026-08-28T02:01:00.000Z"), now),
    true,
  );
}

testDescribesCountPageAndDocument();
testDescribesReviewAndAdminDocument();
testDescribesKnownPagesWithoutDocument();
testComposesLocationOntoPageLabel();
testExpiredPresenceIsInactive();
console.log("user-presence.test: OK");
