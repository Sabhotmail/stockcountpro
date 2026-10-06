import assert from "node:assert/strict";
import { buildProductImageReport } from "@/services/product-image-report.service";
import { DocumentStatus } from "@/types/count";

function testBuildReportGroupsAndSplitsMissing() {
  const report = buildProductImageReport(
    [
      {
        productCode: "101",
        productName: "มีรูป",
        document: {
          id: "d1",
          documentNo: "CNT-1",
          status: DocumentStatus.COUNTING,
          branch: { code: "B1", name: "สาขา 1" },
        },
      },
      {
        productCode: "202",
        productName: "ไม่มีรูป",
        document: {
          id: "d1",
          documentNo: "CNT-1",
          status: DocumentStatus.COUNTING,
          branch: { code: "B1", name: "สาขา 1" },
        },
      },
      {
        productCode: "202",
        productName: "ไม่มีรูป (ชื่อซ้ำ)",
        document: {
          id: "d2",
          documentNo: "CNT-2",
          status: DocumentStatus.SUBMITTED,
          branch: { code: "B2", name: "สาขา 2" },
        },
      },
      {
        productCode: " 202 ",
        productName: "trim",
        document: {
          id: "d2",
          documentNo: "CNT-2",
          status: DocumentStatus.SUBMITTED,
          branch: { code: "B2", name: "สาขา 2" },
        },
      },
    ],
    new Set(["101"]),
  );

  assert.equal(report.summary.totalProductCodes, 2);
  assert.equal(report.summary.withImage, 1);
  assert.equal(report.summary.missingImage, 1);
  assert.equal(report.missing.length, 1);
  assert.equal(report.missing[0]?.productCode, "202");
  assert.equal(report.missing[0]?.productName, "ไม่มีรูป");
  assert.equal(report.missing[0]?.documents.length, 2);
  assert.deepEqual(
    report.missing[0]?.documents.map((d) => d.documentNo),
    ["CNT-1", "CNT-2"],
  );
}

function testEmptyLines() {
  const report = buildProductImageReport([], new Set(["x"]));
  assert.deepEqual(report.summary, {
    totalProductCodes: 0,
    withImage: 0,
    missingImage: 0,
  });
  assert.equal(report.missing.length, 0);
}

testBuildReportGroupsAndSplitsMissing();
testEmptyLines();
console.log("product-image-report.service.test: OK");
