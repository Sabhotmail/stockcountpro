import assert from "node:assert/strict";
import {
  BKK3_HQ_CENTRAL_LOCATION_CODES,
  classifyLocation,
  type HubForClassify,
} from "@/lib/express-location";

const hubs: HubForClassify[] = [
  {
    id: "hub_1",
    branchId: "branch_bkk3",
    code: "1",
    name: "เชียงใหม่",
    shortName: "CHM",
    suffixLetter: "A",
    isActive: true,
  },
  {
    id: "hub_2",
    branchId: "branch_bkk3",
    code: "2",
    name: "พิษณุโลก",
    shortName: "PNL",
    suffixLetter: "B",
    isActive: true,
  },
];

function testCentralCodes() {
  for (const code of BKK3_HQ_CENTRAL_LOCATION_CODES) {
    const result = classifyLocation(code, "24", hubs);
    assert.equal(result.kind, "central", `${code} should be central`);
  }
}

function testHubVanCodes() {
  assert.equal(classifyLocation("2411", "24", hubs).kind, "hub");
  assert.equal(
    (classifyLocation("2411", "24", hubs) as { hub: HubForClassify }).hub.code,
    "1",
  );
  assert.equal(classifyLocation("2425", "24", hubs).kind, "hub");
  assert.equal(
    (classifyLocation("2425", "24", hubs) as { hub: HubForClassify }).hub.code,
    "2",
  );
}

function testHubGdfzCodes() {
  assert.equal(
    (classifyLocation("24GA", "24", hubs) as { hub: HubForClassify }).hub.code,
    "1",
  );
  assert.equal(
    (classifyLocation("24DB", "24", hubs) as { hub: HubForClassify }).hub.code,
    "2",
  );
}

function testUnmappedCodes() {
  assert.equal(classifyLocation("2431", "24", hubs).kind, "unmapped");
  assert.equal(classifyLocation("24GC", "24", hubs).kind, "unmapped");
  assert.equal(classifyLocation("32F1", "24", hubs).kind, "unmapped");
}

testCentralCodes();
testHubVanCodes();
testHubGdfzCodes();
testUnmappedCodes();

console.log("express-location.classify.test: OK");
