import assert from "node:assert/strict";
import {
  batchSaveEntriesBodySchema,
  expressSyncBodySchema,
  loginBodySchema,
  saveEntryBodySchema,
} from "@/lib/api/schemas";
import { parseWithSchema } from "@/lib/api/parse-body";

function testLoginRequiresFields() {
  const missing = parseWithSchema(loginBodySchema, { username: "", password: "" });
  assert.equal(missing.ok, false);

  const ok = parseWithSchema(loginBodySchema, {
    username: " admin ",
    password: "secret",
  });
  assert.equal(ok.ok, true);
  if (!ok.ok) return;
  assert.equal(ok.data.username, "admin");
}

function testExpressSyncLocationsStringArray() {
  const parsed = parseWithSchema(expressSyncBodySchema, {
    date: "2026-07-14",
    locations: ["WH01", "WH02"],
  });
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.deepEqual(parsed.data.locations, [{ code: "WH01" }, { code: "WH02" }]);
}

function testExpressSyncLocationsObjectArray() {
  const parsed = parseWithSchema(expressSyncBodySchema, {
    date: "2026-07-14",
    locations: [{ code: "WH01", name: "Main" }],
  });
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.deepEqual(parsed.data.locations, [{ code: "WH01", name: "Main" }]);
}

function testExpressSyncRejectsBadLocations() {
  const parsed = parseWithSchema(expressSyncBodySchema, {
    date: "2026-07-14",
    locations: "WH01",
  });
  assert.equal(parsed.ok, false);
}

function testSaveEntryAllowsPartialQty() {
  const parsed = parseWithSchema(saveEntryBodySchema, {
    qtyCase: 1,
    qtyPack: null,
    baseRevision: 2,
  });
  assert.equal(parsed.ok, true);
}

function testBatchRequiresItems() {
  const empty = parseWithSchema(batchSaveEntriesBodySchema, { items: [] });
  assert.equal(empty.ok, false);

  const ok = parseWithSchema(batchSaveEntriesBodySchema, {
    items: [{ lineId: "line_1", qtyPiece: 3 }],
  });
  assert.equal(ok.ok, true);
}

testLoginRequiresFields();
testExpressSyncLocationsStringArray();
testExpressSyncLocationsObjectArray();
testExpressSyncRejectsBadLocations();
testSaveEntryAllowsPartialQty();
testBatchRequiresItems();

console.log("schemas.test: OK");
