# BKK3 Hub Model + Central HQ Accounting Locations

**Date:** 2026-07-10  
**Status:** Draft for review  
**Goal:** Restructure StockCount Pro around a single branch **BKK3** (Express prefix `24`), with **Hubs** for operational counting and a **central HQ (accounting)** document for shared warehouses.

## Decisions (brainstorming)

| Topic | Choice |
|-------|--------|
| Branch model | Only **BKK3** in production use (`expressLocationPrefix = 24`) |
| Document split | **One document per Hub per day** |
| User access | Users assigned to **Hub(s)** |
| Location → Hub | Auto-parse: digit at position 3 = Hub code |
| Central / HQ locations | Single bucket: **คลังกลาง HQ (บัญชี)** — not Hub-scoped |
| Central document | One **BKK3 central** document per day; only HQ/accounting roles can see & count |
| Approach | Add `Hub` entity under Branch (Approach 1) |

### Location classification (`24…`)

| Pattern | Example | Destination |
|---------|---------|-------------|
| `24` + **digit** + … | `2411`, `2425` | Hub `1` (CHM), Hub `2` (PNL) |
| Explicit central list | `24C1`, `24F1`, `24G1`, `24R1`, `24Z1`, `24DA`, `24GA`, `24DB`, `24GB` | Central HQ (accounting) document |
| Other `24*` not matching | — | Unmapped / not selectable until classified |

Hub digit mapping (Admin-configurable):

| Hub code (char at index 2) | Name (seed) |
|----------------------------|-------------|
| `1` | เชียงใหม่ (CHM) |
| `2` | พิษณุโลก (PNL) |

Future hubs: add Hub row with code `3`, `4`, … — no code deploy required for new digit if Admin can create hubs.

## Architecture overview

```
Branch BKK3 (prefix 24)
├── Hub 1 CHM  → CountDocument (date + branchId + hubId)
├── Hub 2 PNL  → CountDocument (date + branchId + hubId)
└── Central HQ → CountDocument (date + branchId + hubId=null, isCentral=true)
```

Sync flow:

1. Load Express locations for date (API #2).
2. Classify each location → `{ kind: hub, hubCode } | { kind: central } | { kind: unmapped }`.
3. UI multi-select: Staff see only locations for their hubs; HQ/Admin see hubs + central.
4. POST sync selected locations → group by destination document key → upsert one IMPORTED doc per group.

## Data model

### New: `Hub`

```prisma
model Hub {
  id        String   @id
  branchId  String
  code      String   // "1", "2", … (matches LocationCode[2] when digit)
  name      String
  shortName String?  // e.g. CHM, PNL
  isActive  Boolean  @default(true)
  branch    Branch   @relation(...)
  users     UserHub[]
  documents CountDocument[]

  @@unique([branchId, code])
}
```

### `CountDocument` changes

- Add `hubId String?` (null = central document for that branch/date)
- Add `isCentral Boolean @default(false)` (redundant with hubId null but clearer for queries)
- Unique business key: `(branchId, documentDate, hubId)` with partial unique for central — implement as:
  - `@@unique([branchId, documentDate, hubId])` where hubId always set for hub docs
  - For central: use sentinel hub id **or** `hubId` null + `@@unique([branchId, documentDate, isCentral])` carefully

**Recommended:** nullable `hubId`; application enforces one central doc per `(branchId, date)` where `hubId IS NULL`; hub docs require non-null `hubId`. DB: unique index on `(branchId, documentDate, hubId)` — in PostgreSQL multiple NULLs are distinct in unique constraints unless `NULLS NOT DISTINCT` — use a partial unique index for central:

```sql
CREATE UNIQUE INDEX ... ON "CountDocument" ("branchId", "documentDate") WHERE "hubId" IS NULL;
CREATE UNIQUE INDEX ... ON "CountDocument" ("branchId", "documentDate", "hubId") WHERE "hubId" IS NOT NULL;
```

Document id / no examples:

- Hub: `doc_branch_bkk3_20260710_hub_1`, `CNT-BKK3-CHM-20260710`
- Central: `doc_branch_bkk3_20260710_central`, `CNT-BKK3-HQ-20260710`

### User access: `UserHub`

```prisma
model UserHub {
  userId String
  hubId  String
  @@id([userId, hubId])
}
```

- Keep `UserBranch` for now (user still belongs to BKK3) **or** derive branch from hub’s branch.
- **MVP:** User must have `UserBranch` to BKK3 **and** `UserHub` rows for operational hubs. HQ/Admin/roles with central access need branch BKK3; hub assignment optional for central-only work.

### Central location allowlist

Config (Admin-editable later; seed constants for MVP):

```ts
export const BKK3_CENTRAL_LOCATION_CODES = [
  "24C1", "24F1", "24G1", "24R1", "24Z1",
  "24DA", "24GA", "24DB", "24GB",
] as const;
```

Parse helper:

```ts
function classifyLocation(code: string, hubs: Hub[]): 
  | { kind: "hub"; hub: Hub }
  | { kind: "central" }
  | { kind: "unmapped" }
```

Rules order:

1. If code in central allowlist → `central`
2. Else if `code[0..1]==branch.prefix` and `code[2]` is digit matching a Hub.code → `hub`
3. Else → `unmapped`

## Permissions

| Role | Hub docs | Central HQ doc | Sync select |
|------|----------|----------------|-------------|
| STAFF / COUNTER | Assigned hubs only | No | Hub locations only |
| SUPERVISOR / BRANCH_MANAGER | Assigned hubs (or all hubs under branch — TBD; default assigned) | No unless also HQ | Same |
| HQ / ADMIN | All hubs under accessible branches | Yes | All selectable for branch |
| VIEWER | Read-only per assignment | If HQ-like — no for MVP | No sync |

Exact SUPERVISOR scope: **assigned hubs only** unless Admin (same as staff for MVP).

## Files / areas to change (inventory)

| Area | Change |
|------|--------|
| `prisma/schema.prisma` + migration | Hub, UserHub, CountDocument.hubId |
| `src/lib/express-location.ts` | Replace 2-char-only branch map with classify helper |
| `src/services/express-sync.service.ts` | Group by hub/central; document id/no; access checks |
| `src/components/ExpressSyncPanel.tsx` | Show Hub / Central badges; filter by access |
| `src/services/count-document.service.ts` | List/filter by hub access |
| `src/lib/permissions.ts` / document-access | Hub-aware access |
| `src/services/admin*.ts` + Admin UI | CRUD Hubs under BKK3; user↔hub assignment |
| `src/app/admin/users/page.tsx` | Hub multi-select |
| `src/app/admin/branches/page.tsx` | Keep branch; link to hubs management |
| Seed / mocks | BKK3 + Hub 1/2 + central list; retire multi-branch demo or keep inactive |
| Docs | EXPRESS_API_SETUP + new design/plan |

### Lower priority / later

- Auto-migrate old PNL/`32*` documents
- Per-location Admin override map (rejected for MVP — auto-parse only)
- Separate “คลังกลาง HQ” vs “บัญชี” subtypes (user unified them)

## Out of scope (this change set)

- Hard-deleting historical multi-branch demo data automatically
- Changing Express product field mapping
- Using ISTAB master locations API for sync
- Soft-delete rules for Hub (can add `isActive` like Branch)

## Verification plan

1. Seed BKK3 prefix `24`, Hub `1`/`2`.
2. Load locations for `2026-07-10` → `2411` selectable for CHM staff; `24G1` only for HQ.
3. Sync CHM vans → one CHM document; sync central codes → one HQ central document.
4. PNL staff cannot open CHM document.
5. Add Hub `3` in Admin → `243x` maps without code change.

## Open points (defaults chosen)

| Point | Default |
|-------|---------|
| SUPERVISOR hub scope | Assigned hubs only |
| User still needs UserBranch | Yes, BKK3 |
| Central allowlist storage | Code constant first; Admin UI later if needed |
| Old branches BKK1/CHM/SRB | Soft-disable or leave unused |

---

**Next after approval:** writing-plans → implement Hub schema, classify, sync grouping, access, Admin hub/user UI.
