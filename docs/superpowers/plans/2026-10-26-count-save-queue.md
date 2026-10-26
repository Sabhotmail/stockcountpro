# Count Save Queue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the latest case/pack/piece quantities when a second edit happens before the first save returns, including on a slow network, and let the user retry a real failure without clearing the fields.

**Architecture:** A pure helper decides whether a successful save should show the server row or keep the newer on-screen quantities and send one follow-up. The tablet count page runs at most one request per line, stamps `baseRevision` at send time from the last server revision, and shows **บันทึกอีกครั้ง** only when the line failed without a conflict banner.

**Tech Stack:** Next.js client page, existing `PATCH /api/count-documents/[documentId]/versions/[versionId]/entries/[lineId]`, `node:assert` tests run with `npx tsx`.

**Spec:** [docs/superpowers/specs/2026-10-26-count-save-queue-design.html](../specs/2026-10-26-count-save-queue-design.html)

## Global Constraints

- Do not add a database field and do not change the PATCH entry contract.
- One in-flight save per line. A newer edit replaces the waiting payload; it does not start a second request.
- `baseRevision` is set when the request is sent, from the last revision returned by the server or loaded with the document. Never send the optimistic `0`.
- A follow-up request uses a new `clientMutationId`. Edits that replace a payload before it is sent keep the existing id.
- On success with a waiting payload, copy revision, `updatedBy`, `updatedByName`, and `updatedAt` from the server entry and keep the local `qtyCase`, `qtyPack`, `qtyPiece`, and `totalBaseQty`. Send the waiting payload immediately, with no extra 1 second delay.
- A line stays dirty while a request is in flight or a payload is waiting, so polling does not overwrite it.
- Slow responses stay on **กำลังบันทึก...**. Do not mark them failed because the 30 second summary wait expired.
- Network failure keeps the on-screen quantities and shows **บันทึกอีกครั้ง**.
- A 409 from another user keeps the red banner and **ใช้ข้อมูลของระบบ**. Do not auto-send over that entry, and do not show **บันทึกอีกครั้ง** while `conflictMessage` is set.
- Do not change the first-count confirm dialog or `convertPieceOverflowToCase`.
- Do not abort an in-flight request with a timeout.
- Summary navigation still waits at most 30 seconds (`FLUSH_PENDING_SAVES_MAX_MS`).

---

### Task 1: Pure save-queue decision

**Files:**
- Create: `src/lib/count-save-queue.ts`
- Create: `src/lib/count-save-queue.test.ts`

**Interfaces:**
- Consumes: `CountEntry` and `SaveEntryPayload` from `src/types/count.ts`
- Produces:
  - `payloadForSend(pending: SaveEntryPayload, knownServerRevision: number | undefined): SaveEntryPayload`
  - `replacePendingSave(existing: SaveEntryPayload | undefined, incoming: SaveEntryPayload, requestAlreadySent: boolean): SaveEntryPayload`
  - `resolveSuccessfulLineSave(input: { serverEntry: CountEntry; localEntry: CountEntry; pending: SaveEntryPayload | null; nextClientMutationId: string }): { entry: CountEntry; nextPayload: SaveEntryPayload | null; status: "saved" | "saving" }`

- [ ] **Step 1: Write the failing test**

Create `src/lib/count-save-queue.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx tsx src/lib/count-save-queue.test.ts`

Expected: FAIL because `src/lib/count-save-queue.ts` does not exist.

- [ ] **Step 3: Write the minimal implementation**

Create `src/lib/count-save-queue.ts`:

```typescript
import type { CountEntry, SaveEntryPayload } from "@/types/count";

export function payloadForSend(
  pending: SaveEntryPayload,
  knownServerRevision: number | undefined,
): SaveEntryPayload {
  const next: SaveEntryPayload = { ...pending };
  if (knownServerRevision === undefined) {
    delete next.baseRevision;
    return next;
  }
  next.baseRevision = knownServerRevision;
  return next;
}

export function replacePendingSave(
  existing: SaveEntryPayload | undefined,
  incoming: SaveEntryPayload,
  requestAlreadySent: boolean,
): SaveEntryPayload {
  if (!existing || requestAlreadySent) return incoming;
  return { ...incoming, clientMutationId: existing.clientMutationId };
}

export function resolveSuccessfulLineSave(input: {
  serverEntry: CountEntry;
  localEntry: CountEntry;
  pending: SaveEntryPayload | null;
  nextClientMutationId: string;
}): {
  entry: CountEntry;
  nextPayload: SaveEntryPayload | null;
  status: "saved" | "saving";
} {
  const { serverEntry, localEntry, pending, nextClientMutationId } = input;
  if (!pending) {
    return { entry: serverEntry, nextPayload: null, status: "saved" };
  }

  return {
    entry: {
      ...localEntry,
      revision: serverEntry.revision,
      updatedAt: serverEntry.updatedAt,
      updatedBy: serverEntry.updatedBy,
      updatedByName: serverEntry.updatedByName,
    },
    nextPayload: {
      ...pending,
      baseRevision: serverEntry.revision,
      clientMutationId: nextClientMutationId,
    },
    status: "saving",
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx tsx src/lib/count-save-queue.test.ts`

Expected: `count-save-queue.test: OK`

- [ ] **Step 5: Commit**

```bash
git add src/lib/count-save-queue.ts src/lib/count-save-queue.test.ts
git commit -m "Add a pure decision for queued count-line saves."
```

---

### Task 2: One in-flight save per line

**Files:**
- Modify: `src/app/tablet/count/[documentId]/page.tsx`
- Test: `src/lib/count-save-queue.test.ts` (already passing; do not change it in this task)

**Interfaces:**
- Consumes: `payloadForSend`, `replacePendingSave`, `resolveSuccessfulLineSave` from Task 1, plus `newClientMutationId` from `src/lib/client-id.ts`
- Produces: page-local `runSaveQueue(lineId: string): Promise<void>` used by `scheduleSave` and later by retry and flush

- [ ] **Step 1: Seed the last server revision when the document loads**

In `src/app/tablet/count/[documentId]/page.tsx`, next to `entriesRef`, add:

```typescript
const serverRevisionRef = useRef<Record<string, number>>({});
```

Add this function inside the component, after the ref declarations:

```typescript
const rememberServerRevision = useCallback((entry: CountEntry) => {
  serverRevisionRef.current[entry.lineId] = entry.revision;
}, []);
```

In the load effect, after filling `entryMap` and before `setEntries(entryMap)`, add:

```typescript
for (const entry of doc.entries) {
  serverRevisionRef.current[entry.lineId] = entry.revision;
}
```

Inside `refreshDocumentSilent`, whenever a server entry is copied onto `next[lineId]`, also call `rememberServerRevision(server)` for that entry. Do this for the `!local` branch and for the branch that replaces a clean local row when `server.revision > local.revision`. Do not copy a server row over a dirty or saving line.

- [ ] **Step 2: Replace scheduleSave and saveEntry with a single-flight queue**

Import `payloadForSend`, `replacePendingSave`, and `resolveSuccessfulLineSave` from `@/lib/count-save-queue`.

Keep `buildPayload` as it is, including `convertPieceOverflowToCase`. In `applyEntryUpdate`, after building the optimistic entry object, assign it to `entriesRef.current[line.lineId]` before `setEntries`, so a follow-up does not read a stale ref.

Replace `saveEntry` and `scheduleSave` with these two callbacks. `sendEntryOnce` returns `"saved"`, `"conflict"`, or `"failed"`. `runSaveQueue` is the only function that adds or removes `savingLinesRef`.

```typescript
const sendEntryOnce = useCallback(
  async (lineId: string, payload: SaveEntryPayload): Promise<"saved" | "conflict" | "failed"> => {
    if (!versionId) return "failed";

    const gotLock = await ensureLock(lineId);
    if (!gotLock) return "failed";

    const stamped = payloadForSend(payload, serverRevisionRef.current[lineId]);

    try {
      const res = await fetch(
        `/api/count-documents/${documentId}/versions/${versionId}/entries/${lineId}`,
        {
          method: "PATCH",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(stamped),
        },
      );

      if (res.status === 409) {
        const data = (await res.json()) as SaveEntryErrorResponse;
        delete pendingSavesRef.current[lineId];

        if (data.error === "CONFLICT" && data.entry) {
          const serverEntry = data.entry as CountEntry;
          rememberServerRevision(serverEntry);
          entriesRef.current[lineId] = serverEntry;
          setEntries((prev) => ({ ...prev, [lineId]: serverEntry }));
          setServerEntryByLine((prev) => ({ ...prev, [lineId]: serverEntry }));
          setConflictByLine((prev) => ({ ...prev, [lineId]: data.message }));
          pushToast(`${productCodeByLineId.get(lineId) ?? lineId} ${data.message}`);
          dirtyLinesRef.current.delete(lineId);
        } else if (data.error === "LOCKED") {
          pushToast(data.message ?? "รายการนี้ถูกจองโดยผู้ใช้อื่น");
        }

        setSyncStatusByLine((prev) => ({ ...prev, [lineId]: "failed" }));
        return "conflict";
      }

      if (!res.ok) return "failed";

      const data = (await res.json()) as { entry: CountEntry };
      const serverEntry = data.entry;
      rememberServerRevision(serverEntry);
      const pending = pendingSavesRef.current[lineId] ?? null;
      const decision = resolveSuccessfulLineSave({
        serverEntry,
        localEntry: entriesRef.current[lineId] ?? serverEntry,
        pending,
        nextClientMutationId: newClientMutationId(),
      });

      if (decision.nextPayload) {
        pendingSavesRef.current[lineId] = decision.nextPayload;
      } else {
        delete pendingSavesRef.current[lineId];
        dirtyLinesRef.current.delete(lineId);
        setConflictByLine((prev) => {
          if (!prev[lineId]) return prev;
          const next = { ...prev };
          delete next[lineId];
          return next;
        });
        if (activeEditLineIdRef.current !== lineId) {
          void releaseLock(lineId);
        }
      }

      entriesRef.current[lineId] = decision.entry;
      setEntries((prev) => ({ ...prev, [lineId]: decision.entry }));
      setSyncStatusByLine((prev) => ({ ...prev, [lineId]: decision.status }));
      return "saved";
    } catch {
      return "failed";
    }
  },
  [
    documentId,
    ensureLock,
    productCodeByLineId,
    pushToast,
    releaseLock,
    rememberServerRevision,
    versionId,
  ],
);

const runSaveQueue = useCallback(
  async (lineId: string) => {
    if (savingLinesRef.current.has(lineId)) return;
    if (!versionId) {
      setSyncStatusByLine((prev) => ({ ...prev, [lineId]: "failed" }));
      return;
    }

    savingLinesRef.current.add(lineId);
    setSyncStatusByLine((prev) => ({ ...prev, [lineId]: "saving" }));
    try {
      while (pendingSavesRef.current[lineId]) {
        const pending = pendingSavesRef.current[lineId];
        delete pendingSavesRef.current[lineId];
        const outcome = await sendEntryOnce(lineId, pending);
        if (outcome !== "saved") {
          if (outcome === "failed") {
            setSyncStatusByLine((prev) => ({ ...prev, [lineId]: "failed" }));
          }
          break;
        }
      }
    } finally {
      savingLinesRef.current.delete(lineId);
    }
  },
  [sendEntryOnce, versionId],
);

const scheduleSave = useCallback(
  (lineId: string, payload: SaveEntryPayload) => {
    const inFlight = savingLinesRef.current.has(lineId);
    pendingSavesRef.current[lineId] = replacePendingSave(
      pendingSavesRef.current[lineId],
      payload,
      inFlight,
    );

    if (inFlight) {
      setSyncStatusByLine((prev) => ({ ...prev, [lineId]: "saving" }));
      return;
    }

    setSyncStatusByLine((prev) => ({ ...prev, [lineId]: "waiting" }));
    if (saveTimersRef.current[lineId]) {
      clearTimeout(saveTimersRef.current[lineId]);
    }
    saveTimersRef.current[lineId] = setTimeout(() => {
      delete saveTimersRef.current[lineId];
      void runSaveQueue(lineId);
    }, AUTO_SAVE_DELAY_MS);
  },
  [runSaveQueue],
);
```

`runSaveQueue` must no-op when `savingLinesRef` already has the line, so a second edit during flight only stores the payload. The in-flight loop reads that payload after `sendEntryOnce` returns.

On a non-OK response other than 409, `sendEntryOnce` returns `"failed"` and `runSaveQueue` sets **failed**. It must not delete `entriesRef`, so the typed quantities stay on screen.

- [ ] **Step 3: Point flush at the queue**

In `flushPendingSaves`, keep clearing timers. For each line that still has `pendingSavesRef.current[lineId]`, call `runSaveQueue(lineId)` instead of `saveEntry`. If the line is already in `savingLinesRef`, do not start a second queue; the existing loop will send the pending payload. Keep the 30 second wait loop. Do not set a `saving` or `waiting` line to `failed` when the deadline expires.

- [ ] **Step 4: Run the helper test again**

Run: `npx tsx src/lib/count-save-queue.test.ts`

Expected: `count-save-queue.test: OK`

- [ ] **Step 5: Commit**

```bash
git add src/app/tablet/count/[documentId]/page.tsx
git commit -m "Queue count saves so a slow first request cannot drop the next quantity."
```

---

### Task 3: Retry button on a failed line

**Files:**
- Modify: `src/components/ProductCard.tsx`
- Modify: `src/app/tablet/count/[documentId]/page.tsx` (`CountLineRow` and the card render)

**Interfaces:**
- Consumes: `runSaveQueue` from Task 2
- Produces: `ProductCard` prop `onRetry?: () => void`. The button is rendered only when `syncStatus === "failed"`, `conflictMessage` is empty, and `disabled` is false.

- [ ] **Step 1: Add the button to ProductCard**

Add `onRetry?: () => void` to `ProductCardProps` and destructure it. Inside the piece-quantity branch of the qty row, after the calculator button, render:

```tsx
{syncStatus === "failed" && !conflictMessage && !disabled && onRetry && (
  <Button type="button" size="sm" className="min-h-10" onClick={onRetry}>
    บันทึกอีกครั้ง
  </Button>
)}
```

The conflict banner and **ใช้ข้อมูลของระบบ** stay unchanged. Do not render **บันทึกอีกครั้ง** when `conflictMessage` is set.

- [ ] **Step 2: Retry from the quantities on screen**

Add `onRetry: () => void` to `CountLineRow` and pass it to `ProductCard`.

In the page component, add:

```typescript
const retryFailedLine = useCallback(
  (line: ProductLine) => {
    if (!isEditable) return;
    if (conflictByLine[line.lineId]) return;
    const entry = entriesRef.current[line.lineId];
    if (!entry) return;

    dirtyLinesRef.current.add(line.lineId);
    pendingSavesRef.current[line.lineId] = {
      qtyCase: entry.qtyCase,
      qtyPack: entry.qtyPack,
      qtyPiece: entry.qtyPiece,
      clientMutationId: newClientMutationId(),
    };
    if (saveTimersRef.current[line.lineId]) {
      clearTimeout(saveTimersRef.current[line.lineId]);
      delete saveTimersRef.current[line.lineId];
    }
    void runSaveQueue(line.lineId);
  },
  [conflictByLine, isEditable, runSaveQueue],
);
```

Pass `onRetry={() => retryFailedLine(line)}` from the `filteredLines.map` render into `CountLineRow`. `runSaveQueue` stamps `baseRevision` inside `sendEntryOnce`, so this payload must not copy an optimistic revision.

- [ ] **Step 3: Commit**

```bash
git add src/components/ProductCard.tsx "src/app/tablet/count/[documentId]/page.tsx"
git commit -m "Let a failed count line be saved again without clearing the quantities."
```

---

### Task 4: Summary toasts for slow versus failed saves

**Files:**
- Create: `src/lib/count-save-flush.ts`
- Create: `src/lib/count-save-flush.test.ts`
- Modify: `src/app/tablet/count/[documentId]/page.tsx` (the summary click handler only)

**Interfaces:**
- Consumes: `SyncStatus` from `src/types/count.ts`
- Produces: `summaryFlushToast(input: { lineStatuses: SyncStatus[]; noteFailed: boolean }): string | null`

- [ ] **Step 1: Write the failing test**

Create `src/lib/count-save-flush.test.ts`:

```typescript
import assert from "node:assert/strict";
import { summaryFlushToast } from "@/lib/count-save-flush";

assert.equal(
  summaryFlushToast({ lineStatuses: ["saving"], noteFailed: false }),
  "ยังบันทึกไม่เสร็จ กรุณารอแล้วกดสรุปอีกครั้ง",
);
assert.equal(
  summaryFlushToast({ lineStatuses: ["waiting"], noteFailed: false }),
  "ยังบันทึกไม่เสร็จ กรุณารอแล้วกดสรุปอีกครั้ง",
);
assert.equal(
  summaryFlushToast({ lineStatuses: ["failed"], noteFailed: false }),
  "บันทึกบางรายการไม่สำเร็จ กรุณากดบันทึกอีกครั้งก่อนส่งสรุป",
);
assert.equal(
  summaryFlushToast({ lineStatuses: ["saving", "failed"], noteFailed: false }),
  "บันทึกบางรายการไม่สำเร็จ กรุณากดบันทึกอีกครั้งก่อนส่งสรุป",
);
assert.equal(
  summaryFlushToast({ lineStatuses: ["saved"], noteFailed: true }),
  "บันทึกบางรายการไม่สำเร็จ กรุณากดบันทึกอีกครั้งก่อนส่งสรุป",
);
assert.equal(
  summaryFlushToast({ lineStatuses: ["saved"], noteFailed: false }),
  null,
);

console.log("count-save-flush.test: OK");
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx tsx src/lib/count-save-flush.test.ts`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the helper and use it**

Create `src/lib/count-save-flush.ts`:

```typescript
import type { SyncStatus } from "@/types/count";

const STILL_SAVING_TOAST = "ยังบันทึกไม่เสร็จ กรุณารอแล้วกดสรุปอีกครั้ง";
const FAILED_TOAST = "บันทึกบางรายการไม่สำเร็จ กรุณากดบันทึกอีกครั้งก่อนส่งสรุป";

export function summaryFlushToast(input: {
  lineStatuses: SyncStatus[];
  noteFailed: boolean;
}): string | null {
  if (input.noteFailed || input.lineStatuses.some((status) => status === "failed")) {
    return FAILED_TOAST;
  }
  if (
    input.lineStatuses.some(
      (status) => status === "saving" || status === "waiting",
    )
  ) {
    return STILL_SAVING_TOAST;
  }
  return null;
}
```

In the summary `onClick`, after `const ok = await flushPendingSaves()`, replace the single toast with:

```typescript
if (!ok) {
  const toast = summaryFlushToast({
    lineStatuses: Object.values(syncStatusByLineRef.current),
    noteFailed: noteSyncStatusRef.current === "failed",
  });
  pushToast(toast ?? "ยังบันทึกไม่เสร็จ กรุณารอแล้วกดสรุปอีกครั้ง");
  return;
}
```

`flushPendingSaves` still returns false both when a line is failed and when the 30 second wait ends while a line is `saving` or `waiting`. It must not change a still-saving line to `failed`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx tsx src/lib/count-save-flush.test.ts`

Expected: `count-save-flush.test: OK`

Also run: `npx tsx src/lib/count-save-queue.test.ts`

Expected: `count-save-queue.test: OK`

- [ ] **Step 5: Commit**

```bash
git add src/lib/count-save-flush.ts src/lib/count-save-flush.test.ts "src/app/tablet/count/[documentId]/page.tsx"
git commit -m "Tell counters to wait on a slow save and retry when a save actually failed."
```

---

### Task 5: Changelog

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `package.json` (`version` only)

**Interfaces:**
- Consumes: none
- Produces: app version `1.0.14` shown by `src/lib/app-version.ts`

- [ ] **Step 1: Add the release note**

Set `package.json` `"version"` to `"1.0.14"`.

Insert this section at the top of `CHANGELOG.md`, under `# Changelog`:

```markdown
## 1.0.14 — 2026-10-26

### Fixed

- หน้านับไม่ขึ้นบันทึกไม่สำเร็จเมื่อกรอกชิ้นต่อจากลังขณะคำขอก่อนหน้ายังไม่กลับ รวมถึงตอนเน็ตช้า จำนวนล่าสุดยังอยู่บนจอ
- รายการที่บันทึกไม่สำเร็จเพราะเน็ตขาดมีปุ่ม **บันทึกอีกครั้ง** โดยไม่ต้องลบจำนวน คนอื่นบันทึกทับยังต้องกด **ใช้ข้อมูลของระบบ**
```

- [ ] **Step 2: Commit**

```bash
git add CHANGELOG.md package.json
git commit -m "Bump to 1.0.14 and document queued count saves."
```

---

## Self-review

Spec coverage:

- One request per line and coalesced follow-up: Task 2
- Revision stamped at send time, new mutation id on follow-up: Task 1 and Task 2
- Local quantities survive the first response: Task 1 `resolveSuccessfulLineSave`
- Slow network stays **กำลังบันทึก...**: Task 2 status and Task 4 toast
- **บันทึกอีกครั้ง** without clearing fields: Task 3
- Other-user 409 keeps the red banner and hides retry: Task 2 deletes the waiting payload, Task 3 checks `conflictMessage`
- Summary wait of 30 seconds and the two toasts: Task 4
- Piece overflow and the confirm dialog: left untouched
- Lock held by someone else: `ensureLock` failure still returns `"failed"` and the existing toast

No placeholder steps. `resolveSuccessfulLineSave`, `payloadForSend`, `replacePendingSave`, `runSaveQueue`, and `summaryFlushToast` use the same names in every task.
