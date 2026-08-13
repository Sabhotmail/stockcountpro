import assert from "node:assert/strict";
import { listActiveCountWorkers } from "@/lib/active-count-workers";
import type { LineLockInfo } from "@/types/count";

function lock(
  lineId: string,
  userId: string,
  name: string,
  expiresAt: string,
): LineLockInfo {
  return { lineId, lockedByUserId: userId, lockedByUserName: name, expiresAt };
}

const now = Date.parse("2026-08-13T04:00:00.000Z");

function testIgnoresExpiredLocks() {
  const workers = listActiveCountWorkers(
    [
      lock("l1", "u1", "Ann", "2026-08-13T03:59:00.000Z"),
      lock("l2", "u2", "Bee", "2026-08-13T04:01:00.000Z"),
    ],
    "u0",
    now,
  );
  assert.deepEqual(
    workers.map((w) => w.userId),
    ["u2"],
  );
}

function testGroupsLinesPerUserAndPutsCurrentUserFirst() {
  const workers = listActiveCountWorkers(
    [
      lock("l1", "u2", "Bee", "2026-08-13T04:01:00.000Z"),
      lock("l2", "u1", "Ann", "2026-08-13T04:01:00.000Z"),
      lock("l3", "u2", "Bee", "2026-08-13T04:02:00.000Z"),
    ],
    "u1",
    now,
  );
  assert.equal(workers.length, 2);
  assert.deepEqual(workers[0], {
    userId: "u1",
    name: "Ann",
    lineCount: 1,
    isCurrentUser: true,
  });
  assert.deepEqual(workers[1], {
    userId: "u2",
    name: "Bee",
    lineCount: 2,
    isCurrentUser: false,
  });
}

function testEmptyWhenNoActiveLocks() {
  assert.deepEqual(listActiveCountWorkers([], "u1", now), []);
}

testIgnoresExpiredLocks();
testGroupsLinesPerUserAndPutsCurrentUserFirst();
testEmptyWhenNoActiveLocks();
console.log("active-count-workers.test: OK");
