import assert from "node:assert/strict";
import { filterCountableLines } from "@/lib/line-filter";

const lines = [
  { productCode: "A1", productName: "เจเล่", isCounted: false, lineId: "l1" },
  { productCode: "B2", productName: "น้ำ", isCounted: true, lineId: "l2" },
  { productCode: "C3", productName: "นม", isCounted: false, lineId: "l3" },
];

function codes(result: { productCode: string }[]) {
  return result.map((line) => line.productCode);
}

function testAllShowsCountedAndUncounted() {
  assert.deepEqual(codes(filterCountableLines(lines, { countStatus: "all" })), [
    "A1",
    "B2",
    "C3",
  ]);
}

function testUncountedHidesCountedLines() {
  assert.deepEqual(
    codes(filterCountableLines(lines, { countStatus: "uncounted" })),
    ["A1", "C3"],
  );
}

function testCountedHidesUncountedLines() {
  assert.deepEqual(
    codes(filterCountableLines(lines, { countStatus: "counted" })),
    ["B2"],
  );
}

function testUncountedHidesLinesLockedByOthers() {
  assert.deepEqual(
    codes(
      filterCountableLines(lines, {
        countStatus: "uncounted",
        isLockedByOther: (line) => line.lineId === "l3",
      }),
    ),
    ["A1"],
  );
}

function testCountedKeepsLinesLockedByOthers() {
  const countedLocked = [
    { productCode: "B2", productName: "น้ำ", isCounted: true, lineId: "l2" },
  ];
  assert.deepEqual(
    codes(
      filterCountableLines(countedLocked, {
        countStatus: "counted",
        isLockedByOther: () => true,
      }),
    ),
    ["B2"],
  );
}

function testSearchStillAppliesWithCountStatus() {
  assert.deepEqual(
    codes(
      filterCountableLines(lines, {
        countStatus: "all",
        nameFilter: "เจ",
      }),
    ),
    ["A1"],
  );
}

function testShowUncountedOnlyStillWorks() {
  assert.deepEqual(
    codes(filterCountableLines(lines, { showUncountedOnly: true })),
    ["A1", "C3"],
  );
}

testAllShowsCountedAndUncounted();
testUncountedHidesCountedLines();
testCountedHidesUncountedLines();
testUncountedHidesLinesLockedByOthers();
testCountedKeepsLinesLockedByOthers();
testSearchStillAppliesWithCountStatus();
testShowUncountedOnlyStillWorks();
console.log("line-filter.test: OK");
