import assert from "node:assert/strict";
import { serializeSaveResponse, parseSaveResponse } from "@/lib/processed-mutation";
import type { SaveEntryResponse } from "@/types/count";

function testRoundTrip() {
  const response: SaveEntryResponse = {
    status: "SAVED",
    entry: {
      lineId: "line_1",
      qtyCase: 1,
      qtyPack: null,
      qtyPiece: 0,
      totalBaseQty: 72,
      note: null,
      revision: 2,
      updatedAt: "2026-07-15T00:00:00.000Z",
      updatedBy: "user_admin",
    },
  };
  const json = serializeSaveResponse(response);
  const parsed = parseSaveResponse(json);
  assert.equal(parsed.status, "SAVED");
  assert.equal(parsed.entry.lineId, "line_1");
  assert.equal(parsed.entry.revision, 2);
}

testRoundTrip();
console.log("processed-mutation.test: OK");
