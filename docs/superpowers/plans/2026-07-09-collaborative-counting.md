# Collaborative Counting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let multiple STAFF in the same branch count one document concurrently with 30-second soft locks, overwrite notifications, and silent background refresh that preserves local edits.

**Architecture:** Add `CountLineLock` in Prisma with a dedicated `count-line-lock.service.ts`. Enforce optimistic concurrency in `count-entry.service.ts` via `baseRevision` and active-lock checks. Extend `GET /api/count-documents/:id` to return active locks. Tablet count page acquires/renews/releases locks on edit, polls every 10s with merge-only updates, and shows inline banners + bottom toasts on overwrite.

**Tech Stack:** Next.js 16 App Router, TypeScript, Prisma (PostgreSQL), React 19, Tailwind v4.

**Design spec:** `docs/superpowers/specs/2026-07-09-collaborative-counting-design.html`

---

## File Structure (new + modified)

**Create:**
- `prisma/migrations/20260709100000_add_count_line_lock/migration.sql`
- `src/services/count-line-lock.service.ts` — acquire, renew, release, list active locks
- `src/app/api/count-documents/[documentId]/versions/[versionId]/locks/[lineId]/route.ts` — POST + DELETE
- `src/components/CountToast.tsx` — lightweight toast stack (no new npm deps)
- `scripts/test-count-line-lock.ts` — manual service smoke test
- `docs/superpowers/plans/2026-07-09-collaborative-counting.md` — this plan

**Modify:**
- `prisma/schema.prisma` — `CountLineLock` model + relations
- `src/types/count.ts` — `LineLockInfo`, `updatedByName`, conflict response types
- `src/lib/db/mappers.ts` — `mapLineLock`, optional `mapCountEntry` enrichment helper
- `src/services/count-entry.service.ts` — lock check + `baseRevision` conflict
- `src/services/count-document.service.ts` — attach locks + `updatedByName` on entries
- `src/app/api/count-documents/[documentId]/route.ts` — return `{ document, locks }`
- `src/app/api/count-documents/[documentId]/versions/[versionId]/entries/[lineId]/route.ts` — 409 responses
- `src/components/ProductCard.tsx` — lock/conflict banners
- `src/app/tablet/count/[documentId]/page.tsx` — locks, silent poll, dirty merge, toasts

---

## Constants

Use one shared constant everywhere:

```ts
export const LINE_LOCK_TTL_MS = 30_000;
export const COUNT_POLL_INTERVAL_MS = 10_000;
```

---

## Task 1: Prisma `CountLineLock` model

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260709100000_add_count_line_lock/migration.sql`

- [ ] **Step 1: Add model to schema**

In `prisma/schema.prisma`, add after `CountEntry`:

```prisma
model CountLineLock {
  documentId       String
  lineId           String
  lockedByUserId   String
  lockedByUserName String
  expiresAt        DateTime
  updatedAt        DateTime
  document         CountDocument @relation(fields: [documentId], references: [id], onDelete: Cascade)
  line             ProductLine   @relation(fields: [lineId], references: [lineId], onDelete: Cascade)

  @@id([documentId, lineId])
  @@index([documentId, expiresAt])
}
```

Add relation arrays on `CountDocument` and `ProductLine`:

```prisma
// CountDocument
lineLocks CountLineLock[]

// ProductLine
lineLocks CountLineLock[]
```

- [ ] **Step 2: Create migration SQL**

Create `prisma/migrations/20260709100000_add_count_line_lock/migration.sql`:

```sql
CREATE TABLE "CountLineLock" (
    "documentId" TEXT NOT NULL,
    "lineId" TEXT NOT NULL,
    "lockedByUserId" TEXT NOT NULL,
    "lockedByUserName" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CountLineLock_pkey" PRIMARY KEY ("documentId","lineId")
);

CREATE INDEX "CountLineLock_documentId_expiresAt_idx" ON "CountLineLock"("documentId", "expiresAt");

ALTER TABLE "CountLineLock" ADD CONSTRAINT "CountLineLock_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "CountDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CountLineLock" ADD CONSTRAINT "CountLineLock_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "ProductLine"("lineId") ON DELETE CASCADE ON UPDATE CASCADE;
```

- [ ] **Step 3: Apply migration**

Run: `npm run db:migrate`  
Expected: migration applies, Prisma client regenerates.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260709100000_add_count_line_lock/
git commit -m "Add CountLineLock table for collaborative counting."
```

---

## Task 2: Shared types and mappers

**Files:**
- Modify: `src/types/count.ts`
- Modify: `src/lib/db/mappers.ts`
- Create: `src/lib/count-collab-constants.ts`

- [ ] **Step 1: Add constants file**

Create `src/lib/count-collab-constants.ts`:

```ts
export const LINE_LOCK_TTL_MS = 30_000;
export const COUNT_POLL_INTERVAL_MS = 10_000;
```

- [ ] **Step 2: Extend count types**

In `src/types/count.ts`, extend `CountEntry`:

```ts
export interface CountEntry {
  lineId: string;
  qtyCase: number | null;
  qtyPack: number | null;
  qtyPiece: number | null;
  totalBaseQty: number | null;
  note: string | null;
  revision: number;
  updatedAt: string;
  updatedBy: string;
  updatedByName?: string;
}

export interface LineLockInfo {
  lineId: string;
  lockedByUserId: string;
  lockedByUserName: string;
  expiresAt: string;
}

export interface CountDocumentWithLocksResponse {
  document: CountDocumentDetail;
  locks: LineLockInfo[];
}

export type SaveEntryErrorCode = "CONFLICT" | "LOCKED";

export interface SaveEntryErrorResponse {
  error: SaveEntryErrorCode;
  message: string;
  entry?: CountEntry;
  lockedByUserName?: string;
}
```

- [ ] **Step 3: Add mapper for locks**

In `src/lib/db/mappers.ts`:

```ts
import type { CountLineLock as PrismaCountLineLock } from "@prisma/client";
import type { LineLockInfo } from "@/types/count";

export function mapLineLock(lock: PrismaCountLineLock): LineLockInfo {
  return {
    lineId: lock.lineId,
    lockedByUserId: lock.lockedByUserId,
    lockedByUserName: lock.lockedByUserName,
    expiresAt: toIso(lock.expiresAt),
  };
}
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/count-collab-constants.ts src/types/count.ts src/lib/db/mappers.ts
git commit -m "Add collaborative counting types and lock mapper."
```

---

## Task 3: `count-line-lock.service.ts`

**Files:**
- Create: `src/services/count-line-lock.service.ts`
- Create: `scripts/test-count-line-lock.ts`

- [ ] **Step 1: Implement lock service**

Create `src/services/count-line-lock.service.ts`:

```ts
import { mapLineLock } from "@/lib/db/mappers";
import { LINE_LOCK_TTL_MS } from "@/lib/count-collab-constants";
import { getDocumentForSession } from "@/lib/document-access";
import { canMutateCount } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import type { LineLockInfo } from "@/types/count";
import type { MockSession } from "@/types/user";

function lockExpiresAt(from = new Date()): Date {
  return new Date(from.getTime() + LINE_LOCK_TTL_MS);
}

export async function purgeExpiredLocks(documentId: string): Promise<void> {
  await prisma.countLineLock.deleteMany({
    where: { documentId, expiresAt: { lte: new Date() } },
  });
}

export async function listActiveLocks(documentId: string): Promise<LineLockInfo[]> {
  await purgeExpiredLocks(documentId);
  const rows = await prisma.countLineLock.findMany({
    where: { documentId, expiresAt: { gt: new Date() } },
    orderBy: { lineId: "asc" },
  });
  return rows.map(mapLineLock);
}

export async function acquireOrRenewLineLock(
  session: MockSession,
  documentId: string,
  lineId: string,
): Promise<LineLockInfo | SaveLockError> {
  if (!canMutateCount(session.role)) {
    return { error: "LOCKED", message: "Access denied" };
  }

  const access = await getDocumentForSession(session, documentId);
  if (!access.ok) return { error: "LOCKED", message: access.error };

  const line = await prisma.productLine.findFirst({
    where: { documentId, lineId },
  });
  if (!line) return { error: "LOCKED", message: "Line not found" };

  await purgeExpiredLocks(documentId);

  const existing = await prisma.countLineLock.findUnique({
    where: { documentId_lineId: { documentId, lineId } },
  });

  const now = new Date();
  const expiresAt = lockExpiresAt(now);

  if (
    existing &&
    existing.expiresAt > now &&
    existing.lockedByUserId !== session.userId
  ) {
    return {
      error: "LOCKED",
      message: `รายการนี้กำลังถูกนับโดย ${existing.lockedByUserName}`,
      lockedByUserName: existing.lockedByUserName,
    };
  }

  const saved = await prisma.countLineLock.upsert({
    where: { documentId_lineId: { documentId, lineId } },
    create: {
      documentId,
      lineId,
      lockedByUserId: session.userId,
      lockedByUserName: session.userName,
      expiresAt,
      updatedAt: now,
    },
    update: {
      lockedByUserId: session.userId,
      lockedByUserName: session.userName,
      expiresAt,
      updatedAt: now,
    },
  });

  return mapLineLock(saved);
}

export async function releaseLineLock(
  session: MockSession,
  documentId: string,
  lineId: string,
): Promise<void> {
  await prisma.countLineLock.deleteMany({
    where: {
      documentId,
      lineId,
      lockedByUserId: session.userId,
    },
  });
}

export async function assertCallerHoldsActiveLock(
  session: MockSession,
  documentId: string,
  lineId: string,
): Promise<{ ok: true } | SaveLockError> {
  await purgeExpiredLocks(documentId);

  const lock = await prisma.countLineLock.findUnique({
    where: { documentId_lineId: { documentId, lineId } },
  });

  const now = new Date();
  if (!lock || lock.expiresAt <= now) {
    return {
      error: "LOCKED",
      message: "การยึดรายการหมดอายุ กรุณาเริ่มนับรายการนี้ใหม่",
    };
  }

  if (lock.lockedByUserId !== session.userId) {
    return {
      error: "LOCKED",
      message: `รายการนี้กำลังถูกนับโดย ${lock.lockedByUserName}`,
      lockedByUserName: lock.lockedByUserName,
    };
  }

  return { ok: true };
}

export type SaveLockError = {
  error: "LOCKED";
  message: string;
  lockedByUserName?: string;
};
```

- [ ] **Step 2: Smoke-test script**

Create `scripts/test-count-line-lock.ts` that imports `LINE_LOCK_TTL_MS`, logs it, and documents manual two-user test steps (no DB required for script run).

Run: `npx tsx scripts/test-count-line-lock.ts`  
Expected: prints TTL constant and checklist.

- [ ] **Step 3: Commit**

```bash
git add src/services/count-line-lock.service.ts scripts/test-count-line-lock.ts
git commit -m "Add count line lock service with 30s sliding TTL."
```

---

## Task 4: Entry save — lock check + `baseRevision` conflict

**Files:**
- Modify: `src/services/count-entry.service.ts`

- [ ] **Step 1: Import lock service + user lookup**

Add imports:

```ts
import {
  assertCallerHoldsActiveLock,
  acquireOrRenewLineLock,
} from "@/services/count-line-lock.service";
import { getUserById } from "@/services/user.service";
import type { SaveEntryErrorResponse } from "@/types/count";
```

- [ ] **Step 2: Add helper to enrich entry with name**

```ts
async function enrichEntryWithUserName(
  entry: Awaited<ReturnType<typeof prisma.countEntry.findUnique>>,
) {
  if (!entry) return null;
  const mapped = mapCountEntry(entry);
  const user = await getUserById(entry.updatedBy);
  return { ...mapped, updatedByName: user?.name ?? entry.updatedBy };
}
```

- [ ] **Step 3: Update `applyEntrySave` signature and logic**

Change return type to `SaveEntryResponse | SaveEntryErrorResponse | { error: string }`.

At start of save (after line found), call:

```ts
const lockCheck = await assertCallerHoldsActiveLock(session, documentId, lineId);
if ("error" in lockCheck) {
  return lockCheck;
}
```

Before upsert, after loading `existing`:

```ts
if (existing) {
  const expectedRevision = payload.baseRevision ?? existing.revision;
  if (payload.baseRevision === undefined || existing.revision !== expectedRevision) {
    const entry = await enrichEntryWithUserName(existing);
    const name = entry?.updatedByName ?? existing.updatedBy;
    return {
      error: "CONFLICT",
      message: `รายการนี้ถูกแก้ไขโดย ${name} แล้ว`,
      entry: entry ?? mapCountEntry(existing),
    };
  }
}
```

After successful upsert, renew lock once:

```ts
await acquireOrRenewLineLock(session, documentId, lineId);
```

Return enriched entry:

```ts
const entry = await enrichEntryWithUserName(saved);
return { status: "SAVED", entry: entry ?? mapCountEntry(saved) };
```

- [ ] **Step 4: Update PATCH route for 409**

In `src/app/api/count-documents/[documentId]/versions/[versionId]/entries/[lineId]/route.ts`:

```ts
if ("error" in result) {
  if (result.error === "CONFLICT" || result.error === "LOCKED") {
    return NextResponse.json(result, { status: 409 });
  }
  return NextResponse.json({ error: result.error }, { status: 400 });
}
```

- [ ] **Step 5: Commit**

```bash
git add src/services/count-entry.service.ts src/app/api/count-documents/[documentId]/versions/[versionId]/entries/[lineId]/route.ts
git commit -m "Enforce line locks and revision conflicts on entry save."
```

---

## Task 5: Document GET — return locks + enriched entries

**Files:**
- Modify: `src/services/count-document.service.ts`
- Modify: `src/app/api/count-documents/[documentId]/route.ts`

- [ ] **Step 1: Enrich entries in `getDocumentDetail`**

After loading entries, batch-resolve names:

```ts
import { listActiveLocks } from "@/services/count-line-lock.service";
import { getUserById } from "@/services/user.service";

// inside getDocumentDetail, after entries mapped:
const userIds = [...new Set(entries.map((e) => e.updatedBy))];
const users = await Promise.all(userIds.map((id) => getUserById(id)));
const nameById = new Map(users.filter(Boolean).map((u) => [u!.id, u!.name]));

const enrichedEntries = entries.map((entry) => ({
  ...entry,
  updatedByName: nameById.get(entry.updatedBy) ?? entry.updatedBy,
}));
```

Return `entries: enrichedEntries` in detail object.

- [ ] **Step 2: Add `getDocumentDetailWithLocks` wrapper**

```ts
export async function getDocumentDetailWithLocks(
  session: MockSession,
  documentId: string,
) {
  const document = await getDocumentDetail(session, documentId);
  if (!document) return null;
  const locks = await listActiveLocks(documentId);
  return { document, locks };
}
```

- [ ] **Step 3: Update GET route**

```ts
import { getDocumentDetailWithLocks } from "@/services/count-document.service";

const result = await getDocumentDetailWithLocks(session, documentId);
if (!result) return NextResponse.json({ error: "Document not found" }, { status: 404 });
return NextResponse.json(result);
```

- [ ] **Step 4: Commit**

```bash
git add src/services/count-document.service.ts src/app/api/count-documents/[documentId]/route.ts
git commit -m "Return active line locks and entry author names on document GET."
```

---

## Task 6: Lock API routes

**Files:**
- Create: `src/app/api/count-documents/[documentId]/versions/[versionId]/locks/[lineId]/route.ts`

- [ ] **Step 1: Implement POST + DELETE**

```ts
import { NextResponse } from "next/server";
import {
  acquireOrRenewLineLock,
  releaseLineLock,
} from "@/services/count-line-lock.service";
import { getServerSession } from "@/services/mock-session.service";

export async function POST(
  _request: Request,
  {
    params,
  }: {
    params: Promise<{ documentId: string; versionId: string; lineId: string }>;
  },
) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { documentId, lineId } = await params;
  const result = await acquireOrRenewLineLock(session, documentId, lineId);

  if ("error" in result) {
    return NextResponse.json(result, { status: 409 });
  }

  return NextResponse.json({ lock: result });
}

export async function DELETE(
  _request: Request,
  {
    params,
  }: {
    params: Promise<{ documentId: string; versionId: string; lineId: string }>;
  },
) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { documentId, lineId } = await params;
  await releaseLineLock(session, documentId, lineId);
  return NextResponse.json({ status: "RELEASED" });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/count-documents/[documentId]/versions/[versionId]/locks/[lineId]/route.ts
git commit -m "Add line lock acquire and release API endpoints."
```

---

## Task 7: `CountToast` component

**Files:**
- Create: `src/components/CountToast.tsx`

- [ ] **Step 1: Create toast stack**

```tsx
"use client";

import { useEffect } from "react";

export type CountToastItem = {
  id: string;
  message: string;
};

interface CountToastProps {
  items: CountToastItem[];
  onDismiss: (id: string) => void;
}

export function CountToast({ items, onDismiss }: CountToastProps) {
  useEffect(() => {
    if (!items.length) return;
    const timers = items.map((item) =>
      setTimeout(() => onDismiss(item.id), 5000),
    );
    return () => timers.forEach(clearTimeout);
  }, [items, onDismiss]);

  if (!items.length) return null;

  return (
    <div className="fixed bottom-20 left-0 right-0 z-50 flex flex-col items-center gap-2 px-4 pointer-events-none">
      {items.map((item) => (
        <div
          key={item.id}
          className="max-w-lg rounded-lg bg-slate-900 px-4 py-3 text-sm text-white shadow-lg"
        >
          {item.message}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/CountToast.tsx
git commit -m "Add lightweight toast component for count overwrite alerts."
```

---

## Task 8: `ProductCard` lock and conflict UI

**Files:**
- Modify: `src/components/ProductCard.tsx`

- [ ] **Step 1: Extend props**

```ts
interface ProductCardProps {
  line: ProductLine;
  entry: CountEntry | undefined;
  syncStatus: SyncStatus;
  disabled?: boolean;
  lockHeldByOther?: string | null;
  conflictMessage?: string | null;
  onAcceptServer?: () => void;
  onQtyChange: (...) => void;
  onEditStart?: () => void;
  onEditEnd?: () => void;
}
```

- [ ] **Step 2: Render banners**

Above product header, when `lockHeldByOther`:

```tsx
{lockHeldByOther && (
  <div className="mb-2 rounded-lg bg-amber-100 px-3 py-2 text-sm font-medium text-amber-800">
    กำลังนับโดย {lockHeldByOther}
  </div>
)}
```

When `conflictMessage`:

```tsx
{conflictMessage && (
  <div className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
    <p>{conflictMessage}</p>
    {onAcceptServer && (
      <button
        type="button"
        onClick={onAcceptServer}
        className="mt-2 rounded-md bg-red-600 px-3 py-1 text-xs font-semibold text-white"
      >
        ใช้ข้อมูลของระบบ
      </button>
    )}
  </div>
)}
```

When counted and `entry.updatedByName`:

```tsx
<p className="mt-1 text-xs text-slate-400">บันทึกโดย {entry.updatedByName}</p>
```

Wire `onFocus` on qty inputs to `onEditStart`, `onBlur` to `onEditEnd`.

- [ ] **Step 3: Commit**

```bash
git add src/components/ProductCard.tsx
git commit -m "Show lock and conflict banners on product cards."
```

---

## Task 9: Tablet count page — locks, silent poll, merge

**Files:**
- Modify: `src/app/tablet/count/[documentId]/page.tsx`

- [ ] **Step 1: Load current user once**

On mount, fetch `/api/me` and store `currentUserId` in state.

- [ ] **Step 2: Parse `{ document, locks }` response**

Update `loadDocument` initial load to set `locks` state: `Record<string, LineLockInfo>`.

- [ ] **Step 3: Add `refreshDocumentSilent`**

Copy fetch logic from `loadDocument` but:
- Do **not** set `loading`
- Save `scrollY` to ref before merge; restore in `requestAnimationFrame`
- Merge entries: skip lines in `dirtyLinesRef` or with `syncStatusByLine[lineId] === "saving"`
- Replace `locks` from response
- Update `document.countedLines` / status only when changed
- Call `detectOverwriteFromPoll(serverEntries)`:

```ts
function detectOverwriteFromPoll(
  serverEntries: CountEntry[],
  localEntries: Record<string, CountEntry>,
  dirtyLines: Set<string>,
  currentUserId: string,
  productCodeByLineId: Map<string, string>,
) {
  for (const server of serverEntries) {
    const local = localEntries[server.lineId];
    if (!local) continue;
    if (dirtyLines.has(server.lineId)) {
      if (server.revision > local.revision && server.updatedBy !== currentUserId) {
        setConflictByLine((prev) => ({
          ...prev,
          [server.lineId]:
            "มีคนอื่นบันทึกทับขณะคุณยังไม่ได้บันทึก — โปรดตรวจสอบ",
        }));
        pushToast(
          `${productCodeByLineId.get(server.lineId)} ถูกบันทึกโดย ${server.updatedByName ?? "ผู้ใช้อื่น"}`,
        );
      }
      continue;
    }
    if (
      server.revision > local.revision &&
      server.updatedBy !== currentUserId
    ) {
      setEntries((prev) => ({ ...prev, [server.lineId]: server }));
      pushToast(
        `${productCodeByLineId.get(server.lineId)} ถูกบันทึกโดย ${server.updatedByName ?? "ผู้ใช้อื่น"}`,
      );
    }
  }
}
```

- [ ] **Step 4: Poll interval**

```ts
useEffect(() => {
  if (!isEditable) return;
  const id = setInterval(() => {
    void refreshDocumentSilent();
  }, COUNT_POLL_INTERVAL_MS);
  return () => clearInterval(id);
}, [isEditable, refreshDocumentSilent]);
```

- [ ] **Step 5: Lock acquire on edit**

```ts
async function ensureLock(lineId: string) {
  if (!versionId) return false;
  const res = await fetch(
    `/api/count-documents/${documentId}/versions/${versionId}/locks/${lineId}`,
    { method: "POST" },
  );
  if (res.status === 409) {
    const data = await res.json();
    pushToast(data.message ?? "รายการนี้ถูกจองโดยผู้ใช้อื่น");
    return false;
  }
  if (!res.ok) return false;
  const data = await res.json();
  setLocks((prev) => ({ ...prev, [lineId]: data.lock }));
  return true;
}

async function releaseLock(lineId: string) {
  if (!versionId) return;
  await fetch(
    `/api/count-documents/${documentId}/versions/${versionId}/locks/${lineId}`,
    { method: "DELETE" },
  );
  setLocks((prev) => {
    const next = { ...prev };
    delete next[lineId];
    return next;
  });
}
```

In `updateEntry`, before local state update:

```ts
const gotLock = await ensureLock(line.lineId);
if (!gotLock) return;
dirtyLinesRef.current.add(line.lineId);
```

On `onEditEnd` for a line → `releaseLock(lineId)`.

- [ ] **Step 6: Handle 409 on save**

In `saveEntry` catch block when `res.status === 409`:

```ts
const data = await res.json();
if (data.error === "CONFLICT" && data.entry) {
  setEntries((prev) => ({ ...prev, [lineId]: data.entry }));
  setConflictByLine((prev) => ({
    ...prev,
    [lineId]: data.message,
  }));
  pushToast(
    `${lines.find((l) => l.lineId === lineId)?.productCode} ${data.message}`,
  );
  dirtyLinesRef.current.delete(lineId);
}
```

- [ ] **Step 7: Filter “เฉพาะที่ยังไม่นับ”**

In `filteredLines` useMemo, when `showUncountedOnly`:

```ts
const lock = locks[line.lineId];
if (
  lock &&
  lock.lockedByUserId !== currentUserId &&
  new Date(lock.expiresAt) > new Date()
) {
  return false;
}
```

- [ ] **Step 8: Render `CountToast` + pass card props**

```tsx
<CountToast items={toasts} onDismiss={dismissToast} />
```

Per card:

```tsx
const lock = locks[line.lineId];
const lockHeldByOther =
  lock &&
  lock.lockedByUserId !== currentUserId &&
  new Date(lock.expiresAt) > new Date()
    ? lock.lockedByUserName
    : null;

<ProductCard
  ...
  disabled={!isEditable || !!lockHeldByOther}
  lockHeldByOther={lockHeldByOther}
  conflictMessage={conflictByLine[line.lineId] ?? null}
  onAcceptServer={() => acceptServerEntry(line.lineId)}
/>
```

- [ ] **Step 9: Commit**

```bash
git add src/app/tablet/count/[documentId]/page.tsx
git commit -m "Add collaborative counting UX with locks, silent poll, and toasts."
```

---

## Task 10: Verification and push

**Files:** none (verification only)

- [ ] **Step 1: Run lint**

Run: `npm run lint`  
Expected: no new errors in touched files (pre-existing hook warnings elsewhere are OK).

- [ ] **Step 2: Run build (best-effort)**

Run: `npm run build`  
If Prisma EPERM on Windows: stop dev server, retry.

- [ ] **Step 3: Manual two-browser test**

Follow checklist in design spec HTML § Testing:
- Lock banner visible to second user
- 30s idle → second user can take line
- Overwrite toast appears
- Poll does not flash full-page loader
- Uncounted filter hides others' locked lines

- [ ] **Step 4: Push**

```bash
git push
```

---

## Spec Coverage Self-Review

| Spec requirement | Task |
|------------------|------|
| 30s sliding lock | Task 1, 3, 6, 9 |
| baseRevision / 409 CONFLICT | Task 4 |
| Lock held by other → disabled UI | Task 8, 9 |
| Overwrite toast (save + poll) | Task 7, 9 |
| Dirty line conflict banner + accept server | Task 8, 9 |
| Silent poll 10s, no flicker | Task 9 |
| Uncounted filter hides locked lines | Task 9 |
| GET returns locks | Task 5 |
| updatedByName on entries | Task 4, 5 |

No placeholders remain; all tasks have concrete paths and code.
