# StockCount Express Variance Compare Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Supervisor+ fetch Express STTAK3 variance via a Next.js proxy and show side-by-side Express columns on the review page next to app count data.

**Architecture:** Add a server-only `express-variance.service.ts` that calls the FastAPI variance API with env token. Expose `GET /api/count-documents/[documentId]/express-variance` after session/document checks. Extend review UI with a fetch button and optional Express columns mapped by `productCode`.

**Tech Stack:** Next.js App Router, existing session/permissions helpers, FastAPI variance service (already running separately), Vitest/node test style used in repo (`node --test` / assert files).

## Global Constraints

- Browser never receives `EXPRESS_VARIANCE_API_TOKEN`; only Next server calls FastAPI.
- Use document `documentDate` (yyyy-MM-dd) + `locationCode` for the FastAPI path.
- Map rows by exact `productCode` (trim/uppercase normalize on both sides).
- Keep existing app `difference` / counted qty behavior; Express columns appear only after a successful fetch.
- No auto-fetch on page load.
- Roles: same as supervise/review access (`canSupervise` / document access) — mirror `canPushToExpress` eligibility.
- Missing `locationCode` → 400 with Thai-friendly error.
- FastAPI 404 → surface as “ไม่พบข้อมูลผลต่างใน Express สำหรับวันที่และคลังนี้”.
- Env: `EXPRESS_VARIANCE_API_BASE_URL`, `EXPRESS_VARIANCE_API_TOKEN`.

## File map

| File | Responsibility |
|------|----------------|
| `src/services/express-variance.service.ts` | Fetch + normalize FastAPI response; authz for document |
| `src/services/express-variance.service.test.ts` | Unit tests for mapping / error mapping |
| `src/app/api/count-documents/[documentId]/express-variance/route.ts` | GET proxy |
| `src/types/express-variance.ts` | Shared types for API/UI |
| `src/components/ReviewLineList.tsx` | Table/card columns for Express |
| `src/app/supervisor/review/[documentId]/page.tsx` | Button + state + pass props |
| `.env.example` | Document new env vars |

---

### Task 1: Types + pure mapping helpers (TDD)

**Files:**
- Create: `src/types/express-variance.ts`
- Create: `src/lib/express-variance-map.ts`
- Create: `src/lib/express-variance-map.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `ExpressVarianceLine` `{ PhysicalBalance, LocationBalance, DifferentQty, CountFlag }`
  - `ExpressVarianceFetchResult` `{ success: true; countDate; locationCode; fetchedAt; varianceByProductCode: Record<string, ExpressVarianceLine> }`
  - `normalizeProductCode(code: string): string` — trim + uppercase
  - `indexVarianceByProductCode(rows: Array<{ ProductCode: string } & ExpressVarianceLine>): Record<string, ExpressVarianceLine>`

- [ ] **Step 1: Write failing test**

```typescript
import assert from "node:assert/strict";
import {
  indexVarianceByProductCode,
  normalizeProductCode,
} from "@/lib/express-variance-map";

assert.equal(normalizeProductCode(" 1010010001 "), "1010010001");

const indexed = indexVarianceByProductCode([
  {
    ProductCode: "1010010001",
    PhysicalBalance: 72,
    LocationBalance: 72,
    DifferentQty: 0,
    CountFlag: "3",
  },
  {
    ProductCode: " 1060010004 ",
    PhysicalBalance: 3648,
    LocationBalance: 3600,
    DifferentQty: 48,
    CountFlag: "3",
  },
]);
assert.equal(indexed["1060010004"]?.DifferentQty, 48);
assert.equal(indexed["missing"], undefined);
console.log("express-variance-map.test: OK");
```

- [ ] **Step 2: Run test — expect fail**

```powershell
npx tsx src/lib/express-variance-map.test.ts
```

Expected: cannot find module / export.

- [ ] **Step 3: Implement types + map helpers**

`src/types/express-variance.ts`:

```typescript
export type ExpressVarianceLine = {
  PhysicalBalance: number | null;
  LocationBalance: number | null;
  DifferentQty: number | null;
  CountFlag: string;
};

export type ExpressVarianceFetchResult = {
  success: true;
  countDate: string;
  locationCode: string;
  fetchedAt: string;
  varianceByProductCode: Record<string, ExpressVarianceLine>;
};
```

`src/lib/express-variance-map.ts` — implement `normalizeProductCode` and `indexVarianceByProductCode` as specified.

- [ ] **Step 4: Re-run test — expect pass**

- [ ] **Step 5: Commit**

```bash
git add src/types/express-variance.ts src/lib/express-variance-map.ts src/lib/express-variance-map.test.ts
git commit -m "Add Express variance product-code mapping helpers."
```

---

### Task 2: Server service + API route

**Files:**
- Create: `src/services/express-variance.service.ts`
- Create: `src/services/express-variance.service.test.ts` (mock `fetch`)
- Create: `src/app/api/count-documents/[documentId]/express-variance/route.ts`
- Modify: `.env.example`

**Interfaces:**
- Consumes: `getServerSession`, `canSupervise` / `getDocumentForSession` (or existing document access helper), `indexVarianceByProductCode`, Prisma document fields
- Produces: `fetchExpressVarianceForDocument(session, documentId): Promise<ExpressVarianceFetchResult | { error: string; status: number }>`

- [ ] **Step 1: Write service test with mocked fetch**

Test cases:
1. Missing env → `{ error: "ยังไม่ได้ตั้ง EXPRESS_VARIANCE_API_BASE_URL", status: 503 }` (or include token message)
2. Document without `locationCode` → 400 Thai message about missing warehouse
3. FastAPI returns 404 → mapped Thai not-found message
4. FastAPI 200 → indexed `varianceByProductCode` + `fetchedAt` ISO string

Use `mock.method(globalThis, "fetch", ...)` or assign `global.fetch` and restore.

- [ ] **Step 2: Run test — expect fail**

- [ ] **Step 3: Implement service**

Pseudocode:

```typescript
export async function fetchExpressVarianceForDocument(session, documentId) {
  if (!canSupervise(session.role)) return { error: "Access denied", status: 403 };
  const base = process.env.EXPRESS_VARIANCE_API_BASE_URL?.replace(/\/$/, "");
  const token = process.env.EXPRESS_VARIANCE_API_TOKEN;
  if (!base || !token) return { error: "ยังไม่ได้ตั้งค่า Express variance API", status: 503 };

  const doc = await getDocumentForSession(...); // same pattern as review route
  if (!doc) return { error: "Not found", status: 404 };
  if (!doc.locationCode?.trim()) {
    return { error: "เอกสารนี้ไม่มีรหัสคลัง Express — ดึงผลต่างไม่ได้", status: 400 };
  }

  const countDate = formatDateKey(doc.documentDate); // existing datetime helper
  const locationCode = doc.locationCode.trim().toUpperCase();
  const url = `${base}/api/stockcount/variance/countdate/${encodeURIComponent(countDate)}/locations/${encodeURIComponent(locationCode)}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    cache: "no-store",
  });
  if (res.status === 404) {
    return { error: "ไม่พบข้อมูลผลต่างใน Express สำหรับวันที่และคลังนี้", status: 404 };
  }
  if (!res.ok) {
    return { error: "โหลดผลต่างจาก Express ไม่สำเร็จ", status: 502 };
  }
  const body = await res.json();
  // expect body.varianceData array
  return {
    success: true,
    countDate,
    locationCode,
    fetchedAt: new Date().toISOString(),
    varianceByProductCode: indexVarianceByProductCode(body.varianceData ?? []),
  };
}
```

Follow existing Express client style in `express-api.service.ts` for fetch/error handling where practical, but keep a **separate base URL** (do not reuse Pode stockcount login).

- [ ] **Step 4: Implement route**

```typescript
// GET handler
const session = await getServerSession();
if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
const result = await fetchExpressVarianceForDocument(session, documentId);
if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
return NextResponse.json(result);
```

- [ ] **Step 5: Update `.env.example`**

```env
# FastAPI Express variance compare (server-side only)
# EXPRESS_VARIANCE_API_BASE_URL=http://127.0.0.1:8090
# EXPRESS_VARIANCE_API_TOKEN=change-me
```

- [ ] **Step 6: Run tests — expect pass; commit**

```bash
git add src/services/express-variance.service.ts src/services/express-variance.service.test.ts src/app/api/count-documents/[documentId]/express-variance/route.ts .env.example
git commit -m "Add Next proxy to fetch Express variance for a count document."
```

---

### Task 3: Review UI — button + side-by-side columns

**Files:**
- Modify: `src/components/ReviewLineList.tsx`
- Modify: `src/app/supervisor/review/[documentId]/page.tsx`
- Optionally mirror on admin document review if the same table is reused (only if admin page already uses `ReviewLineTable`; otherwise supervisor only per spec primary surface)

**Interfaces:**
- Consumes: `ExpressVarianceLine` map from Task 1/2
- Produces: UI props `expressVarianceByProductCode?: Record<string, ExpressVarianceLine> | null` and `expressVarianceMeta?: { fetchedAt: string } | null`

- [ ] **Step 1: Extend `ReviewLineTable` / `ReviewLineCard`**

When `expressVarianceByProductCode` is `null`/`undefined` → current columns only (plus show app `difference` if easy from `line.difference` / `totalBaseQty` as in design mockup).

When map is present (object, possibly empty):
- Add columns: `ยอดนับ Express`, `คงเหลือ Express`, `ผลต่าง Express`
- Lookup `expressVarianceByProductCode[normalizeProductCode(line.productCode)]`
- Missing → show text `ไม่พบใน Express`
- Format numbers with `tabular-nums`; color positive/negative diffs like design

Widen `min-w-[…]` so horizontal scroll works on tablet.

- [ ] **Step 2: Wire supervisor review page**

State:
```typescript
const [expressVariance, setExpressVariance] = useState<Record<string, ExpressVarianceLine> | null>(null);
const [expressFetchedAt, setExpressFetchedAt] = useState<string | null>(null);
const [expressLoading, setExpressLoading] = useState(false);
const [expressError, setExpressError] = useState<string | null>(null);
```

Button label: `ดึงผลต่างจาก Express` / disabled `กำลังดึง…`

On click:
```typescript
const res = await fetch(`/api/count-documents/${documentId}/express-variance`);
```

On success set map + fetchedAt; on error set Thai message from `data.error`.

Show badge: `อัปเดตล่าสุด {formatted local time}` when `expressFetchedAt` set.

Disable button when `!review?.document.locationCode` and show inline hint.

- [ ] **Step 3: Manual verify**

1. FastAPI running against `240BKK3`
2. Next `.env.local` has variance URL/token
3. Open a BKK3 document for `2411` / `2026-11-26`
4. Click button → columns populate; Network tab shows only Next API call (no token to :8090 from browser)

- [ ] **Step 4: Commit**

```bash
git add src/components/ReviewLineList.tsx src/app/supervisor/review/[documentId]/page.tsx
git commit -m "Show side-by-side Express variance columns on supervisor review."
```

---

### Task 4: Verification + handoff

- [ ] **Step 1: Run unit tests added in Tasks 1–2**

- [ ] **Step 2: `npm run build` or project’s usual typecheck if used in CI**

- [ ] **Step 3: Tick design checklist** from `docs/superpowers/specs/2026-11-27-stockcount-express-variance-compare-design.html`

- [ ] **Step 4: Push branch / open PR as requested by user**

---

## Spec coverage

| Spec item | Task |
|-----------|------|
| Side-by-side columns | Task 3 |
| Manual button fetch | Task 3 |
| Next proxy + env token | Task 2 |
| Map by productCode | Task 1–3 |
| Missing Express SKU label | Task 3 |
| No locationCode error | Task 2–3 |
| Keep app difference | Task 3 |
| No auto-fetch | Task 3 |

## Placeholder scan

No TBD; admin page reuse is explicitly optional and gated on existing `ReviewLineTable` usage.
