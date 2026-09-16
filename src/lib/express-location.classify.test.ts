import assert from "node:assert/strict";
import {
  BKK3_HQ_CENTRAL_LOCATION_CODES,
  classifyLocation,
  isValidHubCode,
  isValidHubSuffixLetter,
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

const nkrHubs: HubForClassify[] = [
  {
    id: "hub_nkr_0",
    branchId: "branch_nkr",
    code: "0",
    name: "Hub 0",
    shortName: "H0",
    suffixLetter: null,
    isActive: true,
  },
  {
    id: "hub_nkr_1",
    branchId: "branch_nkr",
    code: "1",
    name: "Hub 1",
    shortName: "NKR",
    suffixLetter: "1",
    isActive: true,
  },
  {
    id: "hub_nkr_2",
    branchId: "branch_nkr",
    code: "2",
    name: "Hub 2",
    shortName: "H2",
    suffixLetter: "2",
    isActive: true,
  },
];

function testNkrNumericSuffixAndHubZero() {
  assert.equal(
    (classifyLocation("43G1", "43", nkrHubs) as { hub: HubForClassify }).hub
      .code,
    "1",
  );
  assert.equal(
    (classifyLocation("43D2", "43", nkrHubs) as { hub: HubForClassify }).hub
      .code,
    "2",
  );
  assert.equal(
    (classifyLocation("4301", "43", nkrHubs) as { hub: HubForClassify }).hub
      .code,
    "0",
  );
  assert.equal(classifyLocation("24G1", "24", hubs).kind, "central");
}

function testHubCodeAndSuffixValidation() {
  assert.equal(isValidHubCode("0"), true);
  assert.equal(isValidHubCode("9"), true);
  assert.equal(isValidHubCode("10"), false);
  assert.equal(isValidHubCode("A"), false);
  assert.equal(isValidHubSuffixLetter("A"), true);
  assert.equal(isValidHubSuffixLetter("1"), true);
  assert.equal(isValidHubSuffixLetter("z"), true);
  assert.equal(isValidHubSuffixLetter("AB"), false);
  assert.equal(isValidHubSuffixLetter(""), false);
}

testCentralCodes();
testHubVanCodes();
testHubGdfzCodes();
testUnmappedCodes();
testNkrNumericSuffixAndHubZero();
testHubCodeAndSuffixValidation();

console.log("express-location.classify.test: OK");
