import assert from "node:assert/strict";
import {
  batchSaveEntriesBodySchema,
  createAdminUserBodySchema,
  expressDeleteBodySchema,
  expressDeletePreviewQuerySchema,
  expressDeleteRetryBodySchema,
  expressSyncBodySchema,
  loginBodySchema,
  resetAdminPasswordBodySchema,
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

function testPasswordMinLength() {
  const short = parseWithSchema(createAdminUserBodySchema, {
    name: "A",
    username: "a",
    role: "STAFF",
    branchIds: ["b1"],
    hubIds: [],
    passwordMode: "set",
    password: "1234567",
  });
  assert.equal(short.ok, false);

  const ok = parseWithSchema(createAdminUserBodySchema, {
    name: "A",
    username: "a",
    role: "STAFF",
    branchIds: ["b1"],
    hubIds: [],
    passwordMode: "set",
    password: "12345678",
  });
  assert.equal(ok.ok, true);

  const resetShort = parseWithSchema(resetAdminPasswordBodySchema, {
    passwordMode: "set",
    password: "short",
  });
  assert.equal(resetShort.ok, false);
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

function testExpressDeleteSchemas() {
  const preview = parseWithSchema(expressDeletePreviewQuerySchema, {
    countDate: "2026-03-11",
    locationCode: "32f1",
  });
  assert.equal(preview.ok, true);
  if (!preview.ok) return;
  assert.equal(preview.data.locationCode, "32F1");

  const deleteBody = parseWithSchema(expressDeleteBodySchema, {
    countDate: "2026-03-11",
    locationCode: "32F1",
    documentId: "doc_1",
    confirmPhrase: "DELETE 2026-03-11 32F1",
  });
  assert.equal(deleteBody.ok, true);

  const badDate = parseWithSchema(expressDeleteBodySchema, {
    countDate: "11-03-2026",
    locationCode: "32F1",
    documentId: "doc_1",
    confirmPhrase: "DELETE",
  });
  assert.equal(badDate.ok, false);

  const badCode = parseWithSchema(expressDeleteRetryBodySchema, {
    countDate: "2026-03-11",
    locationCode: "../api",
  });
  assert.equal(badCode.ok, false);
}

testLoginRequiresFields();
testPasswordMinLength();
testExpressSyncLocationsStringArray();
testExpressSyncLocationsObjectArray();
testExpressSyncRejectsBadLocations();
testSaveEntryAllowsPartialQty();
testBatchRequiresItems();
testExpressDeleteSchemas();

console.log("schemas.test: OK");
