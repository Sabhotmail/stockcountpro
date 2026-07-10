# Express Location APIs + Prefix Branch Mapping

**Date:** 2026-07-10  
**Status:** Draft for review  
**Goal:** Integrate three new Express location APIs, let users multi-select warehouses before sync, and map warehouses to branches via a configurable 2-character prefix instead of per-location codes.

## Decisions (from brainstorming)

| Topic | Choice |
|-------|--------|
| Scope | Both: change sync flow **and** add admin proxy endpoints |
| Location selection | User multi-selects warehouses for the chosen count date |
| UI surfaces | `/tablet/documents` and `/admin/sync` (same picker UX) |
| Location list visibility | Show **all** Express locations for that date; sync only creates docs for branches the user can access |
| Unmapped / unauthorized locations | Block sync until every selected location maps to an accessible branch |
| Branch matching | First **2 characters** of location code → branch (e.g. `32F1` → prefix `32` → `PNL`) |
| Prefix config storage | Admin-editable mapping (no deploy required) |
| `expressLocationCodes` | **Remove** — replaced entirely by prefix mapping |

## Architecture

### Express upstream APIs

| # | Method | Express URL | Purpose |
|---|--------|-------------|---------|
| 1 | GET | `/api/stockcount/locations` | Master warehouse list (ISTAB) |
| 2 | GET | `/api/stockcount/locations/countdate/{countdate}` | Warehouses that have stock-count data for a date |
| 3 | GET | `/api/stockcount/countdate/{countdate}/locations/{locations}` | Stock-count lines for date + comma-separated location codes |

Auth remains the existing Express login + Bearer token cache in `express-api.service.ts`.

### App proxy (Admin / HQ only)

| App route | Upstream |
|-----------|----------|
| `GET /api/express/locations` | API #1 |
| `GET /api/express/locations/countdate/[date]` | API #2 |
| `GET /api/express/countdate/[date]/locations/[locations]` | API #3 |

Keep existing `GET /api/express/countdate/[date]` for now (legacy full-day fetch) but **sync no longer uses it**.

### Sync API (Staff / Counter / Branch Manager / Admin / HQ)

| App route | Change |
|-----------|--------|
| `GET /api/express/sync?date=yyyy-MM-dd` | Preview: return locations for that date + mapping status (mapped branch, accessible?, selectable?) |
| `POST /api/express/sync` | Body: `{ date, locations: string[] }` — fetch API #3 for selected locations only, then upsert documents |

### Prefix mapping data model

Add `Branch.expressLocationPrefix` (string, length 2, unique when set).

Examples:

| Prefix | Branch code |
|--------|-------------|
| `24` | `BKK3` |
| `32` | `PNL` |

Rules:

- Prefix is exactly 2 characters (digits/letters), stored uppercase.
- Unique across branches (one prefix → one branch).
- Nullable during migration; branches without a prefix cannot receive synced locations.
- Location `32F1` resolves via `locationCode.slice(0, 2)` → `32` → branch `PNL`.

### Remove per-location codes

- Drop model `BranchExpressLocation` and column usage.
- Remove `Branch.expressLocationCodes` from types/API/UI.
- Admin Branches page: edit **prefix** instead of location code list.
- Migration: drop `BranchExpressLocation` table; add `expressLocationPrefix` on `Branch`.
- Seed: set prefixes for demo branches (e.g. BKK1/BKK2/CHM/SRB as needed for local testing).

## Sync flow (detail)

```
1. User picks count date
2. App calls GET /api/express/sync?date=...
   - Server calls Express API #2
   - For each location code:
       prefix = first 2 chars (uppercase)
       branch = Branch where expressLocationPrefix = prefix
       accessible = user can access that branch (Admin/HQ = all)
   - Response includes: locationCode, mappedBranchCode?, mappedBranchName?, accessible, selectable
3. UI shows multi-select checklist of all locations
   - selectable=true → checkbox enabled
   - selectable=false → disabled + reason ("ยังไม่ตั้ง prefix", "ไม่มีสิทธิ์สาขา")
4. Sync button enabled only when:
   - ≥1 location selected
   - every selected location is selectable
5. POST /api/express/sync { date, locations }
   - Re-validate selection server-side (same rules)
   - Call Express API #3 with selected codes
   - Group lines by resolved branch
   - Upsert one document per branch per date (merge selected locations of same branch)
   - Same IMPORTED-only overwrite / skip COUNTING+ rules as today
   - Audit log IMPORT_FROM_EXPRESS includes selected locations
```

Product line field mapping stays unchanged (`CaseQty`/`PieceQty`/`TransactionValue`/etc.).

## UI

### Sync picker (shared component)

Used on `/tablet/documents` and a real `/admin/sync` page (replace current redirect).

- Date input
- “โหลดคลัง” / auto-load on date change
- Multi-select list with location code + mapped branch badge + disabled reason
- Select-all for selectable items only
- Sync button + result summary (created/updated/skipped)

### Admin Branches

- Replace location-code editor with single `expressLocationPrefix` field (2 chars).
- Table column shows prefix instead of location badges.

### Admin proxy tools (optional thin UI or raw JSON via routes)

Proxy routes are enough for Postman/browser testing; optional simple admin panel can list master locations later — **out of MVP** unless time allows. MVP = working proxy routes + sync picker.

## Permissions

| Action | Who |
|--------|-----|
| Proxy Express location APIs | Admin, HQ |
| Preview sync locations / run sync | STAFF, COUNTER, BRANCH_MANAGER, ADMIN, HQ (same as today) |
| Edit branch prefix | Admin, HQ |

Staff may **see** all Express locations for the date in the picker, but can only **select** those mapped to their accessible branches.

## Error handling

| Case | Behavior |
|------|----------|
| Express not configured | 503 |
| Express upstream failure | 502 + message |
| Empty `locations` on POST | 400 |
| Any selected location unmapped / inaccessible | 400, no partial sync |
| Document already past IMPORTED | skip that branch (existing behavior) |
| Duplicate prefix on save | 400 validation error |

## Testing / verification

1. Configure prefixes in Admin Branches (`24`, `32`, …).
2. Proxy: hit three new `/api/express/...` routes as admin.
3. Tablet sync: load locations for a date, multi-select, sync; confirm documents per branch.
4. Staff with one branch: cannot select other branches’ locations.
5. Unmapped location selected → Sync blocked.
6. Confirm old `expressLocationCodes` UI/API gone.

## Out of scope

- Changing count/review UX
- Changing Express product field semantics
- Auto-creating branches from unknown prefixes
- Keeping dual mapping (`expressLocationCodes` + prefix)
