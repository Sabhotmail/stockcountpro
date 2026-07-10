# Express Location APIs + Prefix Mapping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate three Express location APIs, let users multi-select warehouses before sync, and map warehouses to branches via Admin-editable 2-character prefixes (replacing `expressLocationCodes`).

**Architecture:** Extend `express-api.service.ts` with three upstream fetches; add Admin proxy routes; rewrite sync preview/POST to use location selection + prefix lookup; store `Branch.expressLocationPrefix`; remove `BranchExpressLocation`.

**Tech Stack:** Next.js App Router, Prisma/PostgreSQL, TypeScript, existing shadcn UI.

**Spec:** `docs/superpowers/specs/2026-07-10-express-location-apis-design.md`

**Note:** This repo has no unit-test runner. Verify each task with `npx tsc --noEmit` and/or `npm run build`, plus the listed manual checks.

---

## File map

| File | Responsibility |
|------|----------------|
| `src/lib/express-location.ts` | Prefix normalize/validate + extract prefix from location code |
| `src/types/express.ts` | Response types for locations APIs |
| `src/types/user.ts` | `Branch.expressLocationPrefix` instead of `expressLocationCodes` |
| `prisma/schema.prisma` + migration | Add prefix column; drop `BranchExpressLocation` |
| `src/lib/db/mappers.ts` | Map prefix field |
| `src/mock/branches.ts` + `prisma/seed.ts` | Seed prefixes |
| `src/services/admin.service.ts` + branch PATCH route | Edit prefix |
| `src/app/admin/branches/page.tsx` | Prefix editor UI |
| `src/services/express-api.service.ts` | Fetch APIs #1–#3 |
| `src/app/api/express/locations/**` | Admin proxies |
| `src/services/express-sync.service.ts` | Preview + sync by selected locations |
| `src/app/api/express/sync/route.ts` | Accept `locations[]` |
| `src/components/ExpressSyncPanel.tsx` | Shared date + multi-select + sync UI |
| `src/app/tablet/documents/page.tsx` | Use panel |
| `src/app/admin/sync/page.tsx` | Real sync page (replace redirect) |
| `docs/EXPRESS_API_SETUP.md` | Document new endpoints |

---

### Task 1: Prefix helpers + Branch type

**Files:**
- Modify: `src/lib/express-location.ts`
- Modify: `src/types/user.ts`
- Modify: `src/types/count.ts` (any `branchExpressLocationCodes` display fields — keep name but source from prefix later, or rename in Task 7)

- [ ] **Step 1: Replace location-code helpers with prefix helpers**

Rewrite `src/lib/express-location.ts`:

```ts
export function normalizeExpressLocationPrefix(
  value: string | null | undefined,
): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim().toUpperCase();
  return trimmed.length > 0 ? trimmed : null;
}

export function validateExpressLocationPrefix(value: string): string | null {
  if (!/^[A-Z0-9]{2}$/.test(value)) {
    return "Express location prefix must be exactly 2 alphanumeric characters";
  }
  return null;
}

export function extractLocationPrefix(locationCode: string): string | null {
  const normalized = locationCode.trim().toUpperCase();
  if (normalized.length < 2) return null;
  return normalized.slice(0, 2);
}

/** @deprecated kept only if needed during migration — remove callers in later tasks */
export function normalizeExpressLocationCode(value: string): string | null {
  const trimmed = value.trim().toUpperCase();
  return trimmed.length > 0 ? trimmed : null;
}
```

- [ ] **Step 2: Update Branch type**

In `src/types/user.ts`, change `Branch` to:

```ts
export interface Branch {
  id: string;
  code: string;
  name: string;
  expressLocationPrefix: string | null;
}
```

- [ ] **Step 3: Update mock branches**

In `src/mock/branches.ts`:

```ts
export const mockBranches: Branch[] = [
  {
    id: "branch_bkk1",
    code: "BKK1",
    name: "กรุงเทพ 1",
    expressLocationPrefix: "32",
  },
  {
    id: "branch_bkk2",
    code: "BKK2",
    name: "กรุงเทพ 2",
    expressLocationPrefix: "24",
  },
  {
    id: "branch_chm",
    code: "CHM",
    name: "เชียงใหม่",
    expressLocationPrefix: null,
  },
  {
    id: "branch_srb",
    code: "SRB",
    name: "สระบุรี",
    expressLocationPrefix: null,
  },
];
```

(Adjust demo prefixes as needed; production mapping `24→BKK3` / `32→PNL` will be set in Admin.)

- [ ] **Step 4: Verify TypeScript will fail on old field usages (expected)**

Run: `npx tsc --noEmit`
Expected: errors wherever `expressLocationCodes` is still referenced — leave for later tasks, or temporarily comment only if blocking. Prefer fixing in subsequent tasks in order.

- [ ] **Step 5: Commit**

```bash
git add src/lib/express-location.ts src/types/user.ts src/mock/branches.ts
git commit -m "Add express location prefix helpers and Branch type."
```

---

### Task 2: Prisma schema + migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260710100000_branch_express_location_prefix/migration.sql`
- Modify: `prisma/seed.ts`
- Modify: `src/lib/db/mappers.ts`

- [ ] **Step 1: Update Branch model; remove BranchExpressLocation**

In `prisma/schema.prisma`:

```prisma
model Branch {
  id                    String           @id
  code                  String           @unique
  name                  String
  expressLocationPrefix String?          @unique
  users                 UserBranch[]
  documents             CountDocument[]
  auditLogs             AuditLog[]
}

# DELETE the entire BranchExpressLocation model
```

- [ ] **Step 2: Write migration SQL**

`prisma/migrations/20260710100000_branch_express_location_prefix/migration.sql`:

```sql
-- AlterTable
ALTER TABLE "Branch" ADD COLUMN "expressLocationPrefix" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Branch_expressLocationPrefix_key" ON "Branch"("expressLocationPrefix");

-- DropTable
DROP TABLE IF EXISTS "BranchExpressLocation";
```

- [ ] **Step 3: Update mapper**

In `src/lib/db/mappers.ts`, remove `BranchExpressLocation` import/type and map:

```ts
export function mapBranch(branch: PrismaBranch): Branch {
  return {
    id: branch.id,
    code: branch.code,
    name: branch.name,
    expressLocationPrefix: branch.expressLocationPrefix ?? null,
  };
}
```

Remove all `include: { expressLocations: ... }` from callers in later tasks; for this step fix `mapBranch` signature only.

- [ ] **Step 4: Update seed**

In `prisma/seed.ts`, stop creating `expressLocations`; set prefix:

```ts
await prisma.branch.create({
  data: {
    id: branch.id,
    code: branch.code,
    name: branch.name,
    expressLocationPrefix: branch.expressLocationPrefix,
  },
});
```

Remove `await prisma.branchExpressLocation.deleteMany();` (table gone) — or keep deleteMany only if migration not applied yet; after migration remove that line.

- [ ] **Step 5: Apply migration**

Run: `npm run db:migrate`
Expected: migration applied successfully.

Then: `npx prisma generate`

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260710100000_branch_express_location_prefix prisma/seed.ts src/lib/db/mappers.ts
git commit -m "Replace BranchExpressLocation with expressLocationPrefix."
```

---

### Task 3: Admin branch prefix API + UI

**Files:**
- Modify: `src/services/admin.service.ts`
- Modify: `src/app/api/admin/branches/[branchId]/route.ts`
- Modify: `src/app/admin/branches/page.tsx`
- Delete usages of `formatExpressLocationCodes` for branch list (optional keep unused export)

- [ ] **Step 1: Change UpdateAdminBranchInput**

```ts
export type UpdateAdminBranchInput = {
  expressLocationPrefix: string | null;
};
```

Rewrite `updateBranchForAdmin`:

```ts
export async function updateBranchForAdmin(
  session: MockSession,
  branchId: string,
  input: UpdateAdminBranchInput,
): Promise<Branch | { error: string }> {
  if (!canAccessAdmin(session)) return { error: "Access denied" };

  const prefix = normalizeExpressLocationPrefix(input.expressLocationPrefix);
  if (prefix) {
    const formatError = validateExpressLocationPrefix(prefix);
    if (formatError) return { error: formatError };
  }

  const existingBranch = await prisma.branch.findUnique({
    where: { id: branchId },
    select: { id: true },
  });
  if (!existingBranch) return { error: "Branch not found" };

  if (prefix) {
    const conflict = await prisma.branch.findFirst({
      where: {
        expressLocationPrefix: prefix,
        id: { not: branchId },
      },
      select: { code: true },
    });
    if (conflict) {
      return {
        error: `Prefix "${prefix}" is already used by branch ${conflict.code}`,
      };
    }
  }

  try {
    const branch = await prisma.branch.update({
      where: { id: branchId },
      data: { expressLocationPrefix: prefix },
    });
    return mapBranch(branch);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { error: "Express location prefix is already used by another branch" };
    }
    throw error;
  }
}
```

Update `listBranchesForAdmin` to `findMany` without `expressLocations` include.

- [ ] **Step 2: Update PATCH route**

Accept `{ expressLocationPrefix: string | null }`:

```ts
const { expressLocationPrefix } = body as {
  expressLocationPrefix?: unknown;
};

if (
  expressLocationPrefix !== null &&
  typeof expressLocationPrefix !== "string"
) {
  return NextResponse.json(
    { error: "expressLocationPrefix must be a string or null" },
    { status: 400 },
  );
}

const result = await updateBranchForAdmin(session, branchId, {
  expressLocationPrefix:
    expressLocationPrefix === undefined ? null : expressLocationPrefix,
});
```

- [ ] **Step 3: Simplify Admin Branches UI**

Replace location list editor with a single 2-char input bound to `expressLocationPrefix`. Table column shows prefix or `—`. PATCH body:

```json
{ "expressLocationPrefix": "32" }
```

Clearing the field sends `null`.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit` (fix remaining `expressLocationCodes` errors in sync/count services — next tasks).

Manual: as admin, set BKK1 prefix `32`, save, reload.

- [ ] **Step 5: Commit**

```bash
git add src/services/admin.service.ts src/app/api/admin/branches/[branchId]/route.ts src/app/admin/branches/page.tsx
git commit -m "Allow admin to edit branch Express location prefix."
```

---

### Task 4: Express API client for 3 location endpoints

**Files:**
- Modify: `src/types/express.ts`
- Modify: `src/services/express-api.service.ts`

- [ ] **Step 1: Add types**

Append to `src/types/express.ts` (adjust field names if live API differs — prefer loose typing with known keys):

```ts
export interface ExpressLocationItem {
  LocationCode: string;
  LocationName?: string;
  [key: string]: unknown;
}

export interface ExpressLocationsResponse {
  success: boolean;
  message?: string;
  locations?: ExpressLocationItem[];
  // Some Express payloads may nest differently; normalize in the client.
  data?: ExpressLocationItem[];
  stockCountLocations?: ExpressLocationItem[];
}

export interface ExpressCountDateByLocationsResponse {
  success: boolean;
  message?: string;
  stockCountData?: ExpressStockCountLine[];
}
```

- [ ] **Step 2: Add shared authenticated GET helper**

In `express-api.service.ts`, extract internal helper to avoid duplicating 401-retry logic:

```ts
async function expressGet<T>(
  path: string,
  errorLabel: string,
): Promise<T | { error: string }> {
  const config = getExpressConfig();
  if ("error" in config) return { error: config.error };

  const tokenResult = await getExpressToken();
  if ("error" in tokenResult) return tokenResult;

  const url = `${config.baseUrl}${path}`;

  const doFetch = async (token: string) =>
    fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });

  let res = await doFetch(tokenResult.token);
  if (res.status === 401) {
    cachedToken = null;
    const retryToken = await loginExpressApi();
    if ("error" in retryToken) return retryToken;
    res = await doFetch(retryToken.token);
  }

  if (!res.ok) {
    return { error: `${errorLabel} failed (${res.status})` };
  }

  return (await res.json()) as T;
}
```

Refactor `fetchExpressCountDate` to use `expressGet` (optional but preferred).

- [ ] **Step 3: Implement three fetchers**

```ts
function normalizeLocationList(
  data: ExpressLocationsResponse,
): ExpressLocationItem[] {
  return (
    data.locations ??
    data.stockCountLocations ??
    data.data ??
    []
  );
}

export async function fetchExpressLocations(): Promise<
  { locations: ExpressLocationItem[] } | { error: string }
> {
  const result = await expressGet<ExpressLocationsResponse>(
    "/api/stockcount/locations",
    "Express locations",
  );
  if ("error" in result) return result;
  if (!result.success) {
    return { error: result.message ?? "Express locations failed" };
  }
  return { locations: normalizeLocationList(result) };
}

export async function fetchExpressLocationsByCountDate(
  countDate: string,
): Promise<{ locations: ExpressLocationItem[] } | { error: string }> {
  const result = await expressGet<ExpressLocationsResponse>(
    `/api/stockcount/locations/countdate/${encodeURIComponent(countDate)}`,
    "Express locations by countdate",
  );
  if ("error" in result) return result;
  if (!result.success) {
    return { error: result.message ?? "Express locations by countdate failed" };
  }
  return { locations: normalizeLocationList(result) };
}

export async function fetchExpressCountDateByLocations(
  countDate: string,
  locationCodes: string[],
): Promise<ExpressCountDateByLocationsResponse | { error: string }> {
  const joined = locationCodes.map((c) => c.trim().toUpperCase()).filter(Boolean).join(",");
  if (!joined) return { error: "locations are required" };

  const result = await expressGet<ExpressCountDateByLocationsResponse>(
    `/api/stockcount/countdate/${encodeURIComponent(countDate)}/locations/${encodeURIComponent(joined)}`,
    "Express countdate by locations",
  );
  if ("error" in result) return result;
  return result;
}
```

- [ ] **Step 4: Commit**

```bash
git add src/types/express.ts src/services/express-api.service.ts
git commit -m "Add Express client methods for location APIs."
```

---

### Task 5: Admin proxy routes

**Files:**
- Create: `src/app/api/express/locations/route.ts`
- Create: `src/app/api/express/locations/countdate/[date]/route.ts`
- Create: `src/app/api/express/countdate/[date]/locations/[locations]/route.ts`

- [ ] **Step 1: Master locations proxy**

```ts
// src/app/api/express/locations/route.ts
import { NextResponse } from "next/server";
import { canAccessAdmin } from "@/lib/permissions";
import { fetchExpressLocations } from "@/services/express-api.service";
import { getServerSession } from "@/services/mock-session.service";

export async function GET() {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessAdmin(session.role)) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const result = await fetchExpressLocations();
  if ("error" in result) {
    const status = result.error.includes("not configured") ? 503 : 502;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json(result);
}
```

- [ ] **Step 2: Locations by countdate proxy**

Mirror pattern with `params.date` → `fetchExpressLocationsByCountDate(date)`.

- [ ] **Step 3: Count by locations proxy**

`params.date` + `params.locations` (comma-separated string) → split and call `fetchExpressCountDateByLocations`.

- [ ] **Step 4: Manual verify as admin**

```text
GET /api/express/locations
GET /api/express/locations/countdate/2026-07-09
GET /api/express/countdate/2026-07-09/locations/32F1,32G1
```

Expected: JSON lists / stock lines (or clear Express error).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/express/locations src/app/api/express/countdate
git commit -m "Add admin proxy routes for Express location APIs."
```

---

### Task 6: Rewrite express-sync.service for prefix + selected locations

**Files:**
- Modify: `src/services/express-sync.service.ts`
- Modify: all callers that still `include: { expressLocations }`

- [ ] **Step 1: Add preview types**

```ts
export type ExpressSyncLocationPreview = {
  locationCode: string;
  locationName?: string | null;
  prefix: string | null;
  mappedBranchId: string | null;
  mappedBranchCode: string | null;
  mappedBranchName: string | null;
  accessible: boolean;
  selectable: boolean;
  disabledReason: string | null;
};

export type ExpressSyncPreviewResult = {
  date: string;
  locations: ExpressSyncLocationPreview[];
};
```

- [ ] **Step 2: Build prefix lookup**

```ts
function buildPrefixBranchLookup(branches: Branch[]): Map<string, Branch> {
  const lookup = new Map<string, Branch>();
  for (const branch of branches) {
    const prefix = branch.expressLocationPrefix?.trim().toUpperCase();
    if (prefix) lookup.set(prefix, branch);
  }
  return lookup;
}

function resolveBranchByLocationCode(
  locationCode: string,
  byPrefix: Map<string, Branch>,
): Branch | undefined {
  const prefix = extractLocationPrefix(locationCode);
  if (!prefix) return undefined;
  return byPrefix.get(prefix);
}
```

Remove old `buildExpressBranchLookup` that used `expressLocationCodes`.

`loadBranchesForExpressLookup`:

```ts
const branches = await prisma.branch.findMany({ orderBy: { code: "asc" } });
return branches.map(mapBranch);
```

- [ ] **Step 3: Implement previewExpressCountDate**

```ts
export async function previewExpressCountDate(
  session: MockSession,
  countDate: string,
): Promise<ExpressSyncPreviewResult | { error: string }> {
  if (!canSyncExpress(session.role)) return { error: "Access denied" };
  if (!parseCountDate(countDate)) {
    return { error: "Invalid date format. Use yyyy-MM-dd" };
  }

  const expressResult = await fetchExpressLocationsByCountDate(countDate);
  if ("error" in expressResult) return { error: expressResult.error };

  const branches = await loadBranchesForExpressLookup();
  const byPrefix = buildPrefixBranchLookup(branches);

  const locations: ExpressSyncLocationPreview[] = expressResult.locations.map(
    (item) => {
      const locationCode = String(item.LocationCode ?? "").trim().toUpperCase();
      const prefix = extractLocationPrefix(locationCode);
      const branch = prefix ? byPrefix.get(prefix) : undefined;
      const accessible = branch
        ? canAccessBranch(session.role, session.branchIds, branch.id)
        : false;

      let disabledReason: string | null = null;
      if (!branch) disabledReason = "ยังไม่ตั้ง prefix สำหรับคลังนี้";
      else if (!accessible) disabledReason = "ไม่มีสิทธิ์สาขา";

      return {
        locationCode,
        locationName:
          typeof item.LocationName === "string" ? item.LocationName : null,
        prefix,
        mappedBranchId: branch?.id ?? null,
        mappedBranchCode: branch?.code ?? null,
        mappedBranchName: branch?.name ?? null,
        accessible,
        selectable: Boolean(branch && accessible),
        disabledReason,
      };
    },
  );

  locations.sort((a, b) => a.locationCode.localeCompare(b.locationCode));
  return { date: countDate, locations };
}
```

- [ ] **Step 4: Change syncExpressCountDate signature**

```ts
export async function syncExpressCountDate(
  session: MockSession,
  countDate: string,
  locationCodes: string[],
): Promise<ExpressSyncResult | { error: string }>
```

Validation:

1. `canSyncExpress`
2. date valid
3. `locationCodes` non-empty after normalize/unique uppercase
4. Re-run mapping; if **any** selected code is not selectable → `{ error: "..." }` (no partial sync)
5. `fetchExpressCountDateByLocations(countDate, selected)`
6. Group lines by resolved branch (prefix)
7. Existing `upsertImportedDocument` per branch
8. Audit log includes `locations: selected`

Remove use of `fetchExpressCountDate` from sync path.

- [ ] **Step 5: Fix remaining includes**

Update `count-document.service.ts`, `review.service.ts`, and any other `expressLocations` includes to plain `findUnique`/`findMany` on Branch. For list DTOs that expose `branchExpressLocationCodes`, change to expose prefix or empty array temporarily:

Preferred: replace field with `branchExpressLocationPrefix: string | null` in count/review types and UI that displayed location codes.

Search: `branchExpressLocationCodes` and update tablet header / review pages to show prefix if useful, or remove the parenthetical Express codes display.

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit` → expect clean.

- [ ] **Step 7: Commit**

```bash
git add src/services/express-sync.service.ts src/services/count-document.service.ts src/services/review.service.ts src/types/count.ts src/app/tablet src/app/supervisor
git commit -m "Sync Express by selected locations using branch prefix mapping."
```

---

### Task 7: Sync API route accepts locations[]

**Files:**
- Modify: `src/app/api/express/sync/route.ts`

- [ ] **Step 1: GET returns preview locations**

Keep GET `?date=`; return `previewExpressCountDate` result as-is (`{ date, locations }`).

- [ ] **Step 2: POST body**

```ts
const body = (await request.json()) as {
  date?: string;
  locations?: unknown;
};

if (!body.date) {
  return NextResponse.json({ error: "date is required" }, { status: 400 });
}

if (!Array.isArray(body.locations) || !body.locations.every((x) => typeof x === "string")) {
  return NextResponse.json(
    { error: "locations must be an array of strings" },
    { status: 400 },
  );
}

const result = await syncExpressCountDate(session, body.date, body.locations);
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/express/sync/route.ts
git commit -m "Require selected locations on Express sync POST."
```

---

### Task 8: Shared ExpressSyncPanel + wire tablet/admin pages

**Files:**
- Create: `src/components/ExpressSyncPanel.tsx`
- Modify: `src/app/tablet/documents/page.tsx`
- Modify: `src/app/admin/sync/page.tsx`

- [ ] **Step 1: Build ExpressSyncPanel**

Client component props:

```ts
type Props = {
  title?: string;
  onSynced?: () => void; // reload documents
};
```

State:
- `countDate` (default `todayDateKeyBangkok()`)
- `locations` from GET preview
- `selected: Record<string, boolean>`
- `loadingLocations`, `syncing`, `error`, `message`, `results`

Behavior:
1. On mount / date change / “โหลดคลัง” → `GET /api/express/sync?date=...`
2. Render checkboxes; disable when `!selectable`; show `disabledReason` + mapped branch badge
3. “เลือกทั้งหมดที่เลือกได้” toggles only selectable
4. Sync enabled when ≥1 selected and every selected is selectable
5. POST `{ date, locations: selectedCodes }`
6. Show created/updated/skipped summary; call `onSynced`

Use existing shadcn `Button`, `Input`, `Label`, `Alert`, `Checkbox` if present; otherwise use native checkbox styled like the app.

- [ ] **Step 2: Tablet documents page**

Replace inline sync date+button block with:

```tsx
<ExpressSyncPanel onSynced={() => void loadDocuments()} />
```

Keep document list/filters as-is.

- [ ] **Step 3: Admin sync page**

Replace redirect with PageShell + AdminNav + `ExpressSyncPanel`.

- [ ] **Step 4: Manual UI verify**

1. Set prefixes in Admin Branches
2. Open tablet documents → load locations → multi-select → sync
3. Staff user: other-branch locations disabled
4. Selecting only disabled locations: Sync button stays off
5. Admin `/admin/sync` works the same

- [ ] **Step 5: Commit**

```bash
git add src/components/ExpressSyncPanel.tsx src/app/tablet/documents/page.tsx src/app/admin/sync/page.tsx
git commit -m "Add multi-select Express sync panel for tablet and admin."
```

---

### Task 9: Docs + final cleanup

**Files:**
- Modify: `docs/EXPRESS_API_SETUP.md`
- Grep cleanup: `expressLocationCodes`, `BranchExpressLocation`, `expressLocations`

- [ ] **Step 1: Update EXPRESS_API_SETUP.md**

Document:
- Three new upstream URLs
- Three proxy routes
- Sync preview/POST with `locations`
- Prefix mapping rules (`32F1` → `32` → branch)
- Removal of per-location codes

- [ ] **Step 2: Repo-wide grep**

```bash
rg "expressLocationCodes|BranchExpressLocation|expressLocations" src prisma
```

Expected: no remaining production references (docs/history OK).

- [ ] **Step 3: Full build**

Run: `npm run build`  
Expected: success.

- [ ] **Step 4: Final commit + push**

```bash
git add docs/EXPRESS_API_SETUP.md
git commit -m "Document Express location APIs and prefix-based sync."
git push origin HEAD
```

---

## Spec coverage checklist

| Spec requirement | Task |
|------------------|------|
| Express API #1–#3 client | 4 |
| Admin proxies | 5 |
| Sync preview locations | 6–7 |
| Sync POST with multi locations | 6–7 |
| Prefix mapping Admin-editable | 2–3 |
| Remove expressLocationCodes | 1–3, 6, 9 |
| Multi-select UI tablet + admin | 8 |
| Block unmapped/unauthorized selection | 6, 8 |
| Merge locations per branch document | 6 (existing upsert) |
| Keep product field mapping | 6 (unchanged mapper) |

## Placeholder / consistency review

- Types use `expressLocationPrefix` consistently after Task 1.
- Sync POST always requires `locations: string[]`.
- Preview `selectable` is the single source of truth for UI disable + server reject.
- No TBD steps remaining.
