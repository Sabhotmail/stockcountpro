# BKK3 Hub Model + Central HQ Accounting Locations

**Date:** 2026-07-10  
**Status:** Approved — implemented 2026-07-10  
**Goal:** Restructure StockCount Pro around a single branch **BKK3** (Express prefix `24`), with **Hubs** for operational counting and a **central HQ (accounting)** document for shared warehouses.

## Decisions (brainstorming)

| Topic | Choice |
|-------|--------|
| Branch model | Only **BKK3** in production use (`expressLocationPrefix = 24`) |
| Document split | **One document per Hub per day** |
| User access | Users assigned to **Hub(s)** |
| Location → Hub | Auto-parse: digit at position 3 = Hub code |
| Central / HQ locations | **Wonder / พิเศษ** (`*1` ท้าย) เท่านั้น — ไม่รวม G/D/F/Z แยก Hub |
| G/D/F/Z per Hub | `24GA`, `24DA`, … → อยู่**ภายใต้เอกสาร Hub** นั้น (A=CHM, B=PNL) |
| Active hubs (MVP) | **Hub 1 (CHM)** และ **Hub 2 (PNL)** เท่านั้น |
| Central document | One **BKK3 central** document per day; only HQ/accounting roles can see & count |
| Approach | Add `Hub` entity under Branch (Approach 1) |

### Location classification (`24…`) — ตามแบบออกแบบของผู้ใช้

**ใช้งานจริงตอนนี้: Hub 1 (CHM) และ Hub 2 (PNL) เท่านั้น**

#### กลุ่ม A — อยู่ภายใต้เอกสาร Hub (Staff ของ Hub นั้นนับ)

| แพทเทิร์น | ตัวอย่าง | Hub |
|----------|---------|-----|
| `24` + **เลข Hub** + ลำดับคัน | `2411`, `2425` | 1=CHM, 2=PNL |
| `24` + **G/D/F/Z** + **ตัวย่อ Hub** | `24GA`, `24DA`, `24FA`, `24ZA` | A → Hub 1 (CHM) |
| | `24GB`, `24DB`, `24FB`, `24ZB` | B → Hub 2 (PNL) |

ตัวย่อ Hub (ตำแหน่งที่ 4) สำหรับ G/D/F/Z — อนาคตขยายได้:

| ตัวย่อ | Hub | สถานะ MVP |
|--------|-----|-----------|
| A | 1 – CHM | ใช้งาน |
| B | 2 – PNL | ใช้งาน |
| C–I | 3–8 (SRB, UDN, …) | อนาคต — ยังไม่ map |

#### กลุ่ม B — คลังกลาง HQ (บัญชี) — เอกสารกลาง BKK3 แยก 1 ฉบับ/วัน

| รหัส | ความหมาย |
|------|----------|
| `24G1` | คลังดี Wonder |
| `24D1` | คลังเสีย Wonder |
| `24F1` | คลังแถม Wonder |
| `24Z1` | คลังพัก Wonder |
| `24R1` | Customer Receive |
| `24S1` | Direct Ship ขาย |
| `24C1` | ลด C/N |

→ เฉพาะ **HQ / บัญชี** เห็นและ sync ได้

#### กลุ่ม C — อนาคต / ยังไม่เปิด

| แพทเทิร์น | ตัวอย่าง |
|----------|---------|
| Van Hub 3–8 | `2431`, `248B` |
| G/D/F/Z + ตัวย่อ C–I | `24GC`, `24DI`, … |

Hub digit mapping (Van — ตำแหน่งที่ 3):

| Hub code | Name | MVP |
|----------|------|-----|
| `1` | เชียงใหม่ (CHM) | ใช้งาน |
| `2` | พิษณุโลก (PNL) | ใช้งาน |
| `3`–`8` | SRB, UDN, NKR, SRT, SKL, BKK1 | อนาคต |

## Architecture overview

```
Branch BKK3 (prefix 24)
├── Hub 1 CHM  → เอกสารรวม: Van (241x) + G/D/F/Z ของ Hub A (24GA, 24DA, …)
├── Hub 2 PNL  → เอกสารรวม: Van (242x) + G/D/F/Z ของ Hub B (24GB, 24DB, …)
└── Central HQ → เอกสารกลาง: 24G1, 24D1, 24F1, 24Z1, 24R1, 24S1, 24C1
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
export const BKK3_HQ_CENTRAL_LOCATION_CODES = [
  "24G1", "24D1", "24F1", "24Z1",
  "24R1", "24S1", "24C1",
] as const;

// Hub suffix letter (pos 4) for G/D/F/Z types → Hub code
export const HUB_SUFFIX_TO_CODE: Record<string, string> = {
  A: "1", // CHM
  B: "2", // PNL
  // C: "3", ... future
};
```

Parse helper (order matters):

```ts
function classifyLocation(code: string, hubs: Hub[]):
  | { kind: "hub"; hub: Hub }
  | { kind: "central" }
  | { kind: "unmapped" }
```

Rules:

1. If code in `BKK3_HQ_CENTRAL_LOCATION_CODES` → `central`
2. Else if `code[2]` in `GDFZ` and `code[3]` in `AB` and maps to active Hub → `hub`
3. Else if `code[2]` is digit `1` or `2` matching active Hub → `hub` (Van)
4. Else → `unmapped`

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
2. Load locations → `2411`, `24GA` selectable for CHM staff; `24G1` only for HQ.
3. Sync CHM (`2411` + `24GA`) → **หนึ่งเอกสาร Hub CHM**; sync `24G1` → เอกสารกลาง HQ.
4. PNL staff ไม่เปิดเอกสาร CHM.
5. เพิ่ม Hub `3` ใน Admin + ตัวย่อ `C` → `243x`, `24GC` map ได้โดยไม่แก้โค้ด parse

## Open points (defaults chosen)

| Point | Default |
|-------|---------|
| SUPERVISOR hub scope | Assigned hubs only |
| User still needs UserBranch | Yes, BKK3 |
| Central allowlist storage | Code constant first; Admin UI later if needed |
| Old branches BKK1/CHM/SRB | Soft-disable or leave unused |

---

**Next after approval:** writing-plans → implement Hub schema, classify, sync grouping, access, Admin hub/user UI.
