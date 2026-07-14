# Express API Setup

StockCount Pro calls the Express/Pode API **server-side only** (Next.js Route Handlers).

## Auth flow

1. `POST {BASE_URL}/api/login`
   - Body: `{ "username": "...", "password": "..." }`
   - Response: `{ "success": true, "token": "...", "expire": "..." }`

2. Subsequent requests use `Authorization: Bearer {token}` (token cached server-side in `express-api.service.ts`).

## Local configuration

Copy `.env.example` to `.env.local` and set:

```env
EXPRESS_API_BASE_URL=http://100.95.113.104:8080
EXPRESS_API_USERNAME=admin
EXPRESS_API_PASSWORD=your-password
```

Restart `npm run dev` after changing env.

## Express upstream APIs

| # | Method | Express URL | Purpose |
|---|--------|-------------|---------|
| 1 | GET | `/api/stockcount/locations` | Master warehouse list (ISTAB) |
| 2 | GET | `/api/stockcount/locations/countdate/{yyyy-MM-dd}` | Warehouses with stock-count data for a date (`locationData[]`) |
| 3 | GET | `/api/stockcount/countdate/{yyyy-MM-dd}/locations/{codes}` | Stock-count lines for date + comma-separated location codes |
| 4 | PUT | `/api/stockcount/countdate/{yyyy-MM-dd}/locationcode/{code}` | Push counted results back for one location |
| — | GET | `/api/stockcount/countdate/{yyyy-MM-dd}` | Legacy full-day fetch (still available; sync no longer uses it) |

## Admin proxy endpoints

Admin / HQ only. These proxy the three location APIs above:

```text
GET /api/express/locations
GET /api/express/locations/countdate/2026-03-11
GET /api/express/countdate/2026-03-11/locations/32F1,32F2
```

Legacy full-day proxy (optional `summary=1` for location counts only):

```text
GET /api/express/countdate/2026-03-11
GET /api/express/countdate/2026-03-11?summary=1
```

## Branch prefix mapping

Warehouses map to branches via the **first 2 characters** of the Express location code:

| Location code | Prefix | Branch |
|---------------|--------|--------|
| `32F1` | `32` | `PNL` |
| `24A1` | `24` | `BKK3` |

Configure per branch in **Admin → Branches** using `Branch.expressLocationPrefix` (exactly 2 alphanumeric characters, unique when set, stored uppercase).

Per-location `expressLocationCodes` and the `BranchExpressLocation` table have been removed. Prefix mapping replaces them entirely.

## Sync into PostgreSQL

Staff / Tablet — page: `/tablet/documents`  
Admin — page: `/admin/sync`

```text
GET  /api/express/sync?date=yyyy-MM-dd   # preview locations + mapping status
POST /api/express/sync                   # body: { "date": "yyyy-MM-dd", "locations": ["32F1", "24A1"] }
```

Allowed roles: `STAFF`, `COUNTER`, `BRANCH_MANAGER`, `ADMIN`, `HQ`

### Preview (`GET`)

1. Calls Express API #2 for the chosen date.
2. For each location, resolves prefix → branch via `expressLocationPrefix`.
3. Returns mapping status per location: `mappedBranchCode`, `accessible`, `selectable`, `disabledReason`.

Users see **all** Express locations for the date; only locations mapped to branches they can access are selectable.

### Sync (`POST`)

1. Body must include `date` and a non-empty `locations` array of location codes.
2. Re-validates every selected location (mapped + accessible); returns 400 if any fail — no partial sync.
3. Calls Express API #3 for selected locations only.
4. Groups lines by resolved branch; merges multiple selected locations of the same branch into **one document per branch per date**.
5. Creates/updates documents with status `IMPORTED` only.
6. Skips documents that already started counting (`COUNTING` or later).
7. Writes audit log action `IMPORT_FROM_EXPRESS` (includes selected locations).

## Push results back to Express

After a document is `COMPLETED`, Supervisor / Branch Manager / HQ / Admin can click **ส่งกลับ Express**.

```text
POST /api/count-documents/{documentId}/push-express
```

Server behavior:

1. Requires document access + `COMPLETED`.
2. Builds Express `details[]` from **counted lines only**.
3. Calls Express API #4:
   `PUT /api/stockcount/countdate/{date}/locationcode/{locationCode}`
4. `UserID` = current user's username (max 8 chars).
5. `CountFlag` = `"3"`, `ChangedDate` = today (Asia/Bangkok).
6. Writes audit `PUSH_TO_EXPRESS` (success or failure detail).
7. Re-send is allowed.

### Debugging push (200 but values not updating)

Set in `.env.local`:

```env
EXPRESS_PUSH_DEBUG=1
```

Restart dev server, then push again. Server console logs `[Express push] request` / `response` with URL, sample rows, and full body. The push success dialog also shows **Request ที่ส่งไป Express** (URL + sample 3 rows; full `details[]` when debug is on).

Compare `CountDate`, `LocationCode`, `ProductCode`, `CaseQty`, `PieceQty`, `PhysicalBalance` with what Express expects.

## Field mapping (sync)

| Express | App |
|---------|-----|
| `LocationCode` | Resolved via prefix → `Branch.expressLocationPrefix` |
| `ProductCode` | `productCode` |
| `ProductName` | `productName` |
| `CaseQty` / `PieceQty` | `expectedQtyCase` / `expectedQtyPiece` (internal); `-1` = ยังไม่ตรวจนับในหน่วยนั้น |
| `CaseUnitFactor` | `caseRatio` |
| `TransactionValue` | `expectedQty` (supervisor only); `-1` = ยังไม่ตรวจนับใน Express → เก็บเป็น `null` |
| `CountDate` | `documentDate` |
