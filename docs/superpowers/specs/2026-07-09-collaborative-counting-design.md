# Collaborative Counting (Design Spec)

Date: 2026-07-09  
Owner: StockCount Pro  
Scope: Multiple STAFF in the same branch counting the same document concurrently (informal work split)

## Goals

- Allow several counters to open **one count document** and each pick **uncounted lines** without upfront assignment.
- Prevent most duplicate work via **short-lived soft locks** (30 seconds).
- When another user overwrites a line (after lock expires or via conflict), show a **clear notification** to affected users.
- Background refresh must **not clear counted data** and must **not flicker** the page.

## Non-goals

- Supervisor pre-assignment of line ranges or areas
- WebSocket / real-time push (polling is sufficient for v1)
- Hard database row locks
- Splitting one Express document into multiple sub-documents

## Current State (as-is)

- One `CountEntry` per `ProductLine` (`lineId` PK) shared by all users.
- `CountEntry` has `revision` and `updatedBy` (userId) but save API **ignores** `baseRevision` (last write wins).
- Tablet count page loads document once; no background sync.
- Filter **“เฉพาะที่ยังไม่นับ”** exists but does not exclude lines locked by others.
- Full reload sets `loading=true` and replaces all entry state (risk of flicker if reused for polling).

## User Workflow (approved)

1. Staff A, B, C open the same document.
2. Each uses **“เฉพาะที่ยังไม่นับ”** and picks lines freely.
3. When a user starts editing a line, the system **soft-locks** it for others.
4. Lock TTL = **30 seconds**, extended on continued activity (sliding window).
5. After lock expires, another user may edit; if they save, users with stale data are **notified**.
6. Any counter may submit when document is 100% counted (existing submit flow).

---

## Architecture Overview

```
Tablet Count Page
  ├─ acquire/renew lock on edit focus
  ├─ autosave entry (with baseRevision)
  ├─ silent poll every 10s → merge entries + locks
  └─ toast/banner on overwrite detected

Count Entry API (PATCH)
  ├─ require active lock held by caller (or renew)
  ├─ optimistic concurrency via baseRevision
  └─ 409 CONFLICT when revision mismatch

Line Lock API
  ├─ POST acquire/renew (30s sliding TTL)
  └─ DELETE release (on blur / leave line / unmount)
```

---

## Data Model

### New table: `CountLineLock`

| Field | Type | Notes |
|-------|------|-------|
| `documentId` | String | FK to CountDocument |
| `lineId` | String | FK to ProductLine |
| `lockedByUserId` | String | Current holder |
| `lockedByUserName` | String | Denormalized for UI (no extra lookup) |
| `expiresAt` | DateTime | `now + 30s` on each renew |
| `updatedAt` | DateTime | Last renew |

- Primary key: `(documentId, lineId)` — one lock per line per document.
- Index on `(documentId, expiresAt)` for cleanup queries.
- Expired locks are treated as **no lock** (lazy delete on read or periodic cleanup in service).

### CountEntry (unchanged schema)

Continue using `revision` + `updatedBy` for overwrite detection.

### API response enrichment

Add optional `updatedByName` on `CountEntry` in API responses (resolved from `User.name` server-side) so notifications can show a person’s name without extra client calls.

---

## Lock Rules

### TTL: 30 seconds (sliding)

- On **first focus / first qty change** on a line → `POST lock` (acquire).
- On **each qty change** while editing → `POST lock` (renew), resets `expiresAt = now + 30s`.
- On **successful autosave** → optional renew once (keeps lock while user may continue).
- On **blur leaving line** or **navigate away** → `DELETE lock` (release).
- On **unmount** → best-effort `DELETE` via `navigator.sendBeacon` or fire-and-forget fetch.

### Who can edit

| State | Current user | Other users |
|-------|--------------|-------------|
| No lock / expired | Can acquire | Can acquire |
| Lock held by self | Can edit | See “กำลังนับโดย {name}” — inputs disabled |
| Lock held by other (active) | Inputs disabled | Can edit if holder |

“เฉพาะที่ยังไม่นับ” filter additionally **hides lines locked by other users** (still visible in “แสดงทั้งหมด” as disabled cards).

### Lock vs counted line

- A counted line is **not** locked unless someone is actively editing it.
- Editing a previously counted line requires acquiring a new lock (same rules).

---

## Save & Overwrite Rules

### Optimistic concurrency (implement `baseRevision`)

`PATCH .../entries/:lineId` payload already supports `baseRevision`.

Server logic:

1. If `baseRevision` is provided and `existing.revision !== baseRevision` → **409 CONFLICT**
   ```json
   {
     "error": "CONFLICT",
     "message": "รายการนี้ถูกแก้ไขโดย {updatedByName} แล้ว",
     "entry": { ...server entry... }
   }
   ```
2. If no `baseRevision` and entry exists → treat as conflict if `revision > 0` (force clients to send revision).
3. Require caller holds an **active lock** on the line (unless entry is new and lock was just acquired).

### Overwrite notifications (user requirement)

Notify when **another user** saved over data the current user was viewing/editing.

**Trigger A — Save response (active editor)**  
User tries to save stale data → 409 → inline error on card + toast:
> “{productCode} ถูกแก้ไขโดย {name} ขณะที่คุณกำลังนับ — โปรดตรวจสอบจำนวนใหม่”

Apply server `entry` to local state (discard local pending values for that line).

**Trigger B — Silent poll (passive viewer / expired lock)**  
Poll detects for any line where:
- `server.revision > local.revision`, and
- `server.updatedBy !== currentUserId`, and
- line is not in `dirtyLines` (no unsaved local edits)

→ Show **non-blocking toast** (dedupe per line per session):
> “{productCode} ถูกบันทึกโดย {name}”

Update local entry from server.

**Trigger C — Poll while line is dirty**  
If user has unsaved edits and server revision advanced:
→ Show stronger banner on that card + toast:
> “มีคนอื่นบันทึกทับขณะคุณยังไม่ได้บันทึก — โปรดตรวจสอบ”

Offer actions: **ใช้ข้อมูลของระบบ** (reset to server) — no “force overwrite” in v1.

---

## API Endpoints

### `GET /api/count-documents/:documentId`

Extend existing response with:

```json
{
  "document": { ... },
  "locks": [
    {
      "lineId": "...",
      "lockedByUserId": "...",
      "lockedByUserName": "...",
      "expiresAt": "ISO"
    }
  ]
}
```

Only return **non-expired** locks.

### `POST /api/count-documents/:documentId/versions/:versionId/locks/:lineId`

Acquire or renew lock for current user.

- If unheld or expired → create/overwrite lock.
- If held by self → renew.
- If held by other and not expired → **409 LOCKED**
  ```json
  { "error": "LOCKED", "lockedByUserName": "..." }
  ```

### `DELETE /api/count-documents/:documentId/versions/:versionId/locks/:lineId`

Release lock if held by current user (idempotent).

### `PATCH .../entries/:lineId` (existing)

Add lock check + `baseRevision` enforcement as above.

---

## Tablet UI Changes

### ProductCard

- Show lock banner when locked by another user:
  - “กำลังนับโดย {name}” (amber badge)
- Show overwrite banner when conflict detected on that line.
- Disable qty inputs when locked by other or document not editable.
- Show “บันทึกโดย {updatedByName}” on counted lines (subtle, optional).

### Count page state

New state slices:

- `locks: Record<lineId, LineLockInfo>`
- `dirtyLines: Set<lineId>` — local edits not yet confirmed saved
- `lastKnownRevision: Record<lineId, number>` — for poll diffing
- `notifiedRevisions: Set<lineId@revision>` — dedupe toasts

### Silent refresh (no flicker)

Separate loaders:

| Function | `loading` spinner | Behavior |
|----------|-------------------|----------|
| `loadDocumentInitial()` | Yes (first mount only) | Full load |
| `refreshDocumentSilent()` | **No** | Poll every **10s** |

`refreshDocumentSilent()` merge rules:

1. **Never** call `setLoading(true)`.
2. Update `document.countedLines`, `document.status` only if changed.
3. For each `entry` from server:
   - If `lineId ∈ dirtyLines` or `syncStatus === "saving"` → **skip** (keep local).
   - Else if `revision` changed → update local entry.
4. Replace `locks` entirely from server response.
5. **Do not** reset `codeFilter`, `nameFilter`, `showUncountedOnly`, scroll position.
6. Use stable React keys (`line.lineId`) — no list remount.
7. Avoid replacing `document.lines` array reference if deep-equal (optional micro-opt).

Scroll preservation: store `scrollY` in ref before merge; restore after `requestAnimationFrame` if unchanged filter.

### Autosave interaction with lock

- Schedule autosave (1s debounce) only if lock held by self.
- On save success: update `lastKnownRevision`, remove from `dirtyLines`, set entry from response.
- On 409: show notification, apply server entry, remove dirty flag.

---

## Permissions & Security

- Reuse existing `canMutateCount` + branch document access checks.
- Users can only acquire/release locks on documents they can count.
- Lock holder must match session userId for save and release.
- Server is source of truth; client notifications are advisory except on save conflict.

---

## Audit Log (optional v1)

Defer new audit actions. Existing `AUTO_SAVE_COUNT` already logs saves with `lineId`.

Phase 2: `LOCK_LINE` / `OVERWRITE_CONFLICT` if needed.

---

## Error Handling

| Case | HTTP | User message |
|------|------|--------------|
| Lock held by other | 409 LOCKED | “รายการนี้กำลังถูกนับโดย {name}” |
| Revision mismatch | 409 CONFLICT | “ถูกแก้ไขโดย {name} แล้ว” |
| Lock expired before save | 409 LOCKED | “การยึดรายการหมดอายุ กรุณาเริ่มนับรายการนี้ใหม่” |
| Document not editable | 400 | existing messages |

---

## Testing Checklist

### Two-tablet manual test

1. User A starts editing line X → User B sees lock banner, cannot edit.
2. User A idle >30s → lock expires → User B can edit and save.
3. User A still on page with stale qty → poll or save shows **overwrite notification** with B’s name.
4. User A and B edit **different** lines concurrently → both save successfully.
5. Silent poll for 2 minutes → no full-page spinner, no scroll jump, counted numbers remain visible.
6. “เฉพาะที่ยังไม่นับ” hides lines locked by others.
7. Submit still works when all lines counted.

### Automated (light)

- Service unit tests: lock acquire/renew/expire, revision conflict detection.
- Optional API route tests for 409 paths.

---

## Implementation Notes

- New service: `src/services/count-line-lock.service.ts`
- Extend: `count-entry.service.ts`, `count-document.service.ts` (include locks in detail)
- New routes under `src/app/api/count-documents/.../locks/`
- Primary UI work: `src/app/tablet/count/[documentId]/page.tsx`, `ProductCard.tsx`
- Types: `LineLockInfo`, extend `CountDocumentDetail`, `SaveEntryResponse` union with conflict

---

## Open Decisions (resolved)

| Question | Decision |
|----------|----------|
| Lock duration | **30 seconds**, sliding on activity |
| Assignment model | **None** (informal / uncounted picker) |
| Overwrite notification | **Required** — toast + inline on card |
| Refresh UX | **Silent merge**, no flicker, preserve scroll and dirty edits |
| Submit who | Any counter when 100% (unchanged) |
