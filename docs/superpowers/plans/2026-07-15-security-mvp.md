# Security MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden count saves (idempotent `clientMutationId`), block incomplete submits, return correct 403/404 on authz failures, and make approve+final snapshot atomic.

**Architecture:** Add `ProcessedMutation` table for per-user mutation replay; flush tablet autosave before summary submit; centralize HTTP status mapping for document routes; wrap `snapshotFinalCountEntries` + COMPLETED in one Prisma transaction.

**Tech Stack:** Next.js App Router, Prisma/PostgreSQL, Zod (existing), `node:assert/strict` + `tsx` tests (existing project style)

**Spec:** `docs/superpowers/specs/2026-07-15-security-mvp-design.html`

## Global Constraints

- Keep response error shape `{ error: string }` except existing CONFLICT payloads
- Do not require `clientMutationId` (optional for legacy); when present it must be idempotent
- Out of scope: Dexie offline, Express change warnings, role consolidation
- Prefer Thai utility copy for new user-facing errors
- After each task: commit with a concise why-focused message

## File map

| File | Responsibility |
|------|----------------|
| `prisma/schema.prisma` + migration | `ProcessedMutation` model |
| `src/lib/processed-mutation.ts` | lookup / store helpers |
| `src/services/count-entry.service.ts` | wire idempotency into save |
| `src/app/tablet/count/[documentId]/page.tsx` | emit + retry mutation ids; flush before summary |
| `src/app/tablet/count/[documentId]/summary/page.tsx` | readiness check; disable submit CTA |
| `src/services/count-document.service.ts` | `getSubmitReadiness` |
| `src/app/api/count-documents/[documentId]/submit-readiness/route.ts` | GET readiness |
| `src/lib/api/error-status.ts` | map service errors → HTTP status |
| count / supervisor API routes | use status helper |
| `src/lib/entry-snapshot.ts` | optional tx client for snapshot |
| `src/services/review.service.ts` | atomic approve |

---

### Task 1: ProcessedMutation schema + helpers

**Files:**
- Modify: `prisma/schema.prisma`
- Create: migration via `npx dotenv -e .env.local -- prisma migrate dev --name add_processed_mutation`
- Create: `src/lib/processed-mutation.ts`
- Create: `src/lib/processed-mutation.test.ts`

**Interfaces:**
- Produces:
  - `findProcessedMutation(userId: string, clientMutationId: string): Promise<{ responseJson: string } | null>`
  - `storeProcessedMutation(input: { userId: string; clientMutationId: string; documentId: string; lineId: string | null; response: SaveEntryResponse }, tx?: Prisma.TransactionClient): Promise<void>`

- [ ] **Step 1: Add model to schema**

Append to `prisma/schema.prisma`:

```prisma
model ProcessedMutation {
  id               String   @id @default(cuid())
  clientMutationId String
  userId           String
  documentId       String
  lineId           String?
  responseJson     String
  createdAt        DateTime @default(now())

  @@unique([userId, clientMutationId])
  @@index([documentId, createdAt])
}
```

- [ ] **Step 2: Create migration**

Run:

```bash
npx dotenv -e .env.local -- prisma migrate dev --name add_processed_mutation
```

Expected: migration applied, client generated.

- [ ] **Step 3: Write failing helper tests**

Create `src/lib/processed-mutation.test.ts`:

```ts
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
```

- [ ] **Step 4: Run test (expect fail)**

```bash
npx tsx src/lib/processed-mutation.test.ts
```

Expected: FAIL module not found / export missing.

- [ ] **Step 5: Implement helpers**

Create `src/lib/processed-mutation.ts`:

```ts
import { prisma } from "@/lib/prisma";
import type { SaveEntryResponse } from "@/types/count";
import type { Prisma } from "@prisma/client";

type Db = Prisma.TransactionClient | typeof prisma;

export function serializeSaveResponse(response: SaveEntryResponse): string {
  return JSON.stringify(response);
}

export function parseSaveResponse(json: string): SaveEntryResponse {
  return JSON.parse(json) as SaveEntryResponse;
}

export async function findProcessedMutation(
  userId: string,
  clientMutationId: string,
  db: Db = prisma,
) {
  return db.processedMutation.findUnique({
    where: {
      userId_clientMutationId: { userId, clientMutationId },
    },
  });
}

export async function storeProcessedMutation(
  input: {
    userId: string;
    clientMutationId: string;
    documentId: string;
    lineId: string | null;
    response: SaveEntryResponse;
  },
  db: Db = prisma,
) {
  await db.processedMutation.create({
    data: {
      clientMutationId: input.clientMutationId,
      userId: input.userId,
      documentId: input.documentId,
      lineId: input.lineId,
      responseJson: serializeSaveResponse(input.response),
    },
  });
}
```

- [ ] **Step 6: Re-run test**

```bash
npx tsx src/lib/processed-mutation.test.ts
```

Expected: `processed-mutation.test: OK`

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations src/lib/processed-mutation.ts src/lib/processed-mutation.test.ts
git commit -m "Add ProcessedMutation store for save idempotency."
```

---

### Task 2: Idempotent entry save (server)

**Files:**
- Modify: `src/services/count-entry.service.ts`
- Modify: `src/types/count.ts` (optional `replayed?: boolean` on `SaveEntryResponse` if useful)
- Create: `src/services/count-entry.idempotency.test.ts` **or** a focused pure test of the early-return branch via exporting a small helper — prefer integrating logic and documenting a manual script if DB fixture harness is heavy; minimum: unit-test that `findProcessedMutation` short-circuit path is called by extracting:

```ts
export function replayIfPresent(
  existing: { responseJson: string } | null,
): SaveEntryResponse | null
```

**Interfaces:**
- Consumes: `findProcessedMutation`, `storeProcessedMutation`, `parseSaveResponse`
- Modifies: `applyEntrySave` — before mutate, if `payload.clientMutationId` set and row exists → return parsed response; after successful save → `storeProcessedMutation` (same tx as entry upsert when refactoring to `$transaction`)

- [ ] **Step 1: Add replay helper + test**

In `src/lib/processed-mutation.ts`:

```ts
export function replayIfPresent(
  row: { responseJson: string } | null,
): SaveEntryResponse | null {
  if (!row) return null;
  return parseSaveResponse(row.responseJson);
}
```

Extend `processed-mutation.test.ts` with:

```ts
function testReplayIfPresent() {
  assert.equal(replayIfPresent(null), null);
  const row = {
    responseJson: serializeSaveResponse({
      status: "SAVED",
      entry: {
        lineId: "line_1",
        qtyCase: 0,
        qtyPack: null,
        qtyPiece: 1,
        totalBaseQty: 1,
        note: null,
        revision: 1,
        updatedAt: "2026-07-15T00:00:00.000Z",
        updatedBy: "user_admin",
      },
    }),
  };
  const replayed = replayIfPresent(row);
  assert.ok(replayed);
  assert.equal(replayed.entry.qtyPiece, 1);
}
```

- [ ] **Step 2: Wire `applyEntrySave`**

Near top of `applyEntrySave` after access/version checks, before lock/qty mutate:

```ts
const mutationId = payload.clientMutationId?.trim();
if (mutationId) {
  const existingMutation = await findProcessedMutation(session.userId, mutationId);
  const replayed = replayIfPresent(existingMutation);
  if (replayed) return replayed;
}
```

After successful upsert + countedLines update + before/after `logAutoSave`:

- Prefer wrap entry upsert + document update + `storeProcessedMutation` in `prisma.$transaction`
- Call `logAutoSave` only on first process (after tx commit is OK)
- On unique violation (`P2002`) for ProcessedMutation, re-fetch and return replay

- [ ] **Step 3: Batch path**

In `saveEntriesBatch`, each item already calls `applyEntrySave` — ensure each item's `clientMutationId` is passed through `BatchSaveEntryItem` / payload (already on schema). No extra change if batch maps fields through.

- [ ] **Step 4: Manual verify**

With server running, PATCH same body twice with same `clientMutationId`; check Audit Log has one AUTO_SAVE for that edit. Or add an integration script under `scripts/` if preferred.

- [ ] **Step 5: Commit**

```bash
git add src/services/count-entry.service.ts src/lib/processed-mutation.ts src/lib/processed-mutation.test.ts src/types/count.ts
git commit -m "Make count entry saves idempotent with clientMutationId."
```

---

### Task 3: Tablet emits + retries clientMutationId; flush before summary

**Files:**
- Modify: `src/app/tablet/count/[documentId]/page.tsx`

**Interfaces:**
- For each logical save flush, set `clientMutationId` once (UUID) on the pending payload; retries of that save reuse it
- Add `flushPendingSaves(): Promise<boolean>` — clears timers, awaits in-flight, returns false if any failed

- [ ] **Step 1: Track mutation id on pending payload**

When building/scheduling save payload in `buildPayload` / `scheduleSave`, include:

```ts
clientMutationId: crypto.randomUUID(),
```

Store on `pendingSavesRef` payload. Important: **do not regenerate** when retrying the same pending object.

In `saveEntry` retry paths, reuse the payload's `clientMutationId`.

- [ ] **Step 2: Implement flush**

```ts
async function flushPendingSaves(): Promise<boolean> {
  // 1) clear all debounce timers and immediately save pending payloads
  // 2) wait until no line has syncStatus "saving" / "waiting"
  // 3) return false if any line syncStatus === "failed"
}
```

Wire footer link 「สรุปและส่งให้หัวหน้างาน」: `onClick` prevent default → `const ok = await flushPendingSaves()` → if !ok show toast/alert; if ok then `router.push(.../summary)`.

- [ ] **Step 3: Smoke test manually**

Change a qty, immediately click summary; confirm waits/saves then navigates.

- [ ] **Step 4: Commit**

```bash
git add src/app/tablet/count/[documentId]/page.tsx
git commit -m "Flush tablet autosaves and send clientMutationId on count PATCH."
```

---

### Task 4: Submit readiness + summary CTA guard

**Files:**
- Modify: `src/services/count-document.service.ts` — add `getSubmitReadiness`
- Create: `src/app/api/count-documents/[documentId]/submit-readiness/route.ts`
- Modify: `src/app/tablet/count/[documentId]/summary/page.tsx`

**Interfaces:**
- Produces:

```ts
export type SubmitReadiness =
  | {
      ok: true;
      countedLines: number;
      totalLines: number;
      versionStatus: string;
      versionId: string;
    }
  | {
      ok: false;
      reasons: string[];
      countedLines: number;
      totalLines: number;
      versionStatus: string | null;
    };
```

- [ ] **Step 1: Implement `getSubmitReadiness(session, documentId)`**

Use `getDocumentForSession`. Fail reasons (Thai):

- no current version / not DRAFT → 「เวอร์ชันไม่พร้อมส่ง」
- document not COUNTING / RECOUNT_REQUESTED → 「เอกสารไม่ได้อยู่สถานะนับ」

Return counts from document fields.

- [ ] **Step 2: GET route**

```ts
// src/app/api/count-documents/[documentId]/submit-readiness/route.ts
export async function GET(_req, { params }) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { documentId } = await params;
  const result = await getSubmitReadiness(session, documentId);
  if ("error" in result && result.error) {
    // use Task 5 helper when available; temporarily map 403/404 via document access status
  }
  return NextResponse.json(result);
}
```

Prefer returning readiness payload even when `ok: false` with 200; only use 403/404 when document access fails.

- [ ] **Step 3: Summary page**

On load + before submit:

1. `GET .../submit-readiness`
2. If `!ok` → disable submit, show reasons
3. On submit click → re-check readiness; if fail, abort with Thai message

Copy for incomplete local flush (if passed via query `?pending=1` optional): 「ยังมีรายการที่กำลังบันทึก — กลับไปหน้านับให้บันทึกครบก่อน」

- [ ] **Step 4: Commit**

```bash
git add src/services/count-document.service.ts src/app/api/count-documents/[documentId]/submit-readiness/route.ts src/app/tablet/count/[documentId]/summary/page.tsx
git commit -m "Gate stock-count submit on readiness and finished autosaves."
```

---

### Task 5: Authz HTTP status helper on critical routes

**Files:**
- Create: `src/lib/api/error-status.ts`
- Create: `src/lib/api/error-status.test.ts`
- Modify routes:
  - `src/app/api/count-documents/[documentId]/versions/[versionId]/submit/route.ts`
  - `src/app/api/count-documents/[documentId]/versions/[versionId]/entries/[lineId]/route.ts`
  - `src/app/api/count-documents/[documentId]/versions/[versionId]/entries/batch/route.ts`
  - `src/app/api/count-documents/[documentId]/note/route.ts`
  - `src/app/api/count-documents/[documentId]/start/route.ts` (if exists)
  - `src/app/api/supervisor/count-documents/[documentId]/approve/route.ts`
  - `src/app/api/supervisor/count-documents/[documentId]/request-recount/route.ts`

**Interfaces:**
- Produces:

```ts
export function httpStatusForServiceError(error: string): 400 | 403 | 404 | 409
```

Rules:
- includes `"Access denied"` or Thai equivalent used → 403
- includes `"not found"` / `"Not found"` / `"ไม่พบ"` document/version/line → 404
- `"CONFLICT"` exact or structured conflict → 409 (routes that already return CONFLICT keep body; status becomes 409 if currently 400)
- else 400

- [ ] **Step 1: Write tests**

```ts
import assert from "node:assert/strict";
import { httpStatusForServiceError } from "@/lib/api/error-status";

assert.equal(httpStatusForServiceError("Access denied"), 403);
assert.equal(httpStatusForServiceError("Document not found"), 404);
assert.equal(httpStatusForServiceError("Version not found"), 404);
assert.equal(httpStatusForServiceError("Only submitted documents can be approved"), 400);
console.log("error-status.test: OK");
```

- [ ] **Step 2: Implement helper + wire routes**

Example submit route:

```ts
if ("error" in result) {
  return NextResponse.json(
    { error: result.error },
    { status: httpStatusForServiceError(result.error) },
  );
}
```

Where `getDocumentForSession` returns `{ status }`, prefer that status over string sniffing when available (pass through from services gradually). For MVP, string mapping is enough if services keep English `"Access denied"` / `"… not found"` messages (they currently do for many paths).

- [ ] **Step 3: Run tests**

```bash
npx tsx src/lib/api/error-status.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/api/error-status.ts src/lib/api/error-status.test.ts src/app/api
git commit -m "Return 403/404 from count and supervisor mutation routes."
```

---

### Task 6: Atomic approve + final snapshot

**Files:**
- Modify: `src/lib/entry-snapshot.ts` — accept optional `Prisma.TransactionClient`
- Modify: `src/services/review.service.ts` — `approveDocument`

**Interfaces:**
- Change `snapshotFinalCountEntries(documentId, versionId, db = prisma)` to use `db` for deleteMany/createMany and for nested `snapshotDocumentEntries` reads/writes that must be consistent
- If `snapshotDocumentEntries` is complex, at minimum: inside `approveDocument` transaction callback:
  1. re-check status SUBMITTED
  2. call snapshot using `tx`
  3. update version + document

- [ ] **Step 1: Refactor snapshot to accept tx**

```ts
export async function snapshotFinalCountEntries(
  documentId: string,
  versionId: string,
  db: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<CountEntry[]> {
  const entries = await snapshotDocumentEntries(documentId, versionId, db);
  await db.finalCountEntry.deleteMany({ where: { documentId } });
  if (entries.length > 0) {
    await db.finalCountEntry.createMany({ /* ... */ });
  }
  return entries;
}
```

Thread `db` through `snapshotDocumentEntries` / `resolveEffectiveEntries` only as far as needed for writes; reads of entries/snapshots can use `db` for consistency.

- [ ] **Step 2: Wrap approve**

Replace separate snapshot + transaction with:

```ts
await prisma.$transaction(async (tx) => {
  const fresh = await tx.countDocument.findUnique({ where: { id: documentId } });
  if (!fresh || fresh.status !== DocumentStatus.SUBMITTED) {
    throw new Error("ONLY_SUBMITTED");
  }
  await snapshotFinalCountEntries(documentId, version.id, tx);
  await tx.countVersion.update({
    where: { id: version.id },
    data: { status: VersionStatus.APPROVED },
  });
  await tx.countDocument.update({
    where: { id: documentId },
    data: { status: DocumentStatus.COMPLETED, updatedAt: new Date() },
  });
});
```

Map thrown `ONLY_SUBMITTED` → `{ error: "Only submitted documents can be approved" }`.

Keep `logApproveVersion` / `logCompleteDocument` **after** successful commit (best-effort audit per spec).

- [ ] **Step 3: Manual check**

Approve a submitted document; verify `FinalCountEntry` rows exist and status COMPLETED.

- [ ] **Step 4: Commit**

```bash
git add src/lib/entry-snapshot.ts src/services/review.service.ts
git commit -m "Approve documents with atomic final count snapshot."
```

---

### Task 7: Verification pass

**Files:** none (commands only)

- [ ] **Step 1: Run unit tests**

```bash
npx tsx src/lib/processed-mutation.test.ts
npx tsx src/lib/api/error-status.test.ts
npx tsc --noEmit -p tsconfig.json
```

Expected: all OK / exit 0

- [ ] **Step 2: Optional build**

```bash
npm run build
```

(If Prisma EPERM on Windows: stop `next start`/`next dev` first.)

- [ ] **Step 3: Final commit if docs-only tweaks remain**

Update spec HTML Status remains Approved; no code change required.

---

## Spec coverage check

| Spec item | Task |
|-----------|------|
| ProcessedMutation + save idempotency | 1–2 |
| Client mutation id + retry | 3 |
| Submit flush / summary gate + readiness | 3–4 |
| 403/404 polish on critical routes | 5 |
| Approve + snapshot transaction | 6 |
| Tests listed in spec | 1, 2 helper, 5, 7 |

## Placeholder scan

No TBD steps; commands and code samples are concrete.

## Type consistency

- `SaveEntryResponse` stays canonical serialized shape
- `getSubmitReadiness` return type used by route + summary page
- `httpStatusForServiceError` returns `400 | 403 | 404 | 409`
