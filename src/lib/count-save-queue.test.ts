import assert from "node:assert/strict";
import type { CountEntry, SaveEntryPayload } from "@/types/count";
import {
  payloadForSend,
  replacePendingSave,
  resolveSuccessfulLineSave,
} from "@/lib/count-save-queue";

function entry(overrides: Partial<CountEntry> = {}): CountEntry {
  return {
    lineId: "line-1",
    qtyCase: 2,
    qtyPack: null,
    qtyPiece: null,
    totalBaseQty: 144,
    note: null,
    revision: 1,
    updatedAt: "2026-10-26T10:00:00.000Z",
    updatedBy: "user-a",
    updatedByName: "สมหญิง",
    ...overrides,
  };
}

const pieceEdit: SaveEntryPayload = {
  qtyCase: 2,
  qtyPack: null,
  qtyPiece: 5,
  baseRevision: 0,
  clientMutationId: "old-id",
};

assert.deepEqual(
  payloadForSend({ ...pieceEdit }, undefined),
  {
    qtyCase: 2,
    qtyPack: null,
    qtyPiece: 5,
    clientMutationId: "old-id",
  },
  "omit baseRevision when the server has never saved this line",
);

assert.equal(
  payloadForSend({ ...pieceEdit }, 1).baseRevision,
  1,
  "stamp the last server revision at send time",
);

assert.equal(
  replacePendingSave(
    { ...pieceEdit, clientMutationId: "kept" },
    { ...pieceEdit, qtyPiece: 8, clientMutationId: "fresh" },
    false,
  ).clientMutationId,
  "kept",
  "reuse the mutation id until the request is sent",
);

assert.equal(
  replacePendingSave(
    { ...pieceEdit, clientMutationId: "sent" },
    { ...pieceEdit, qtyPiece: 8, clientMutationId: "fresh" },
    true,
  ).clientMutationId,
  "fresh",
  "a follow-up after send gets a new mutation id",
);

const caughtUp = resolveSuccessfulLineSave({
  serverEntry: entry({ qtyPiece: null, revision: 1 }),
  localEntry: entry({ qtyPiece: null, revision: 0 }),
  pending: null,
  nextClientMutationId: "unused",
});
assert.equal(caughtUp.status, "saved");
assert.equal(caughtUp.nextPayload, null);
assert.equal(caughtUp.entry.revision, 1);
assert.equal(caughtUp.entry.qtyCase, 2);

const queued = resolveSuccessfulLineSave({
  serverEntry: entry({ qtyPiece: null, revision: 1 }),
  localEntry: entry({ qtyPiece: 5, revision: 0, totalBaseQty: 144 }),
  pending: pieceEdit,
  nextClientMutationId: "follow-up",
});
assert.equal(queued.status, "saving");
assert.equal(queued.entry.qtyPiece, 5, "keep the piece typed while the first save was in flight");
assert.equal(queued.entry.qtyCase, 2);
assert.equal(queued.entry.revision, 1);
assert.equal(queued.entry.updatedBy, "user-a");
assert.equal(queued.nextPayload?.baseRevision, 1);
assert.equal(queued.nextPayload?.clientMutationId, "follow-up");
assert.equal(queued.nextPayload?.qtyPiece, 5);

console.log("count-save-queue.test: OK");
