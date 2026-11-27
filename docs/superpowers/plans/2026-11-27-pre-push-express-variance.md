# Pre-Push Express Variance Compare Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let supervisors compare app counted qty (what will be pushed) against live Express `STLOC.LOCBAL` before sending counts to Express.

**Architecture:** Extend FastAPI with a balances-only endpoint reading `STLOC`. Next.js proxies per document, maps by `productCode`, and computes `projectedDiff = appQty − LocationBalance`. New standalone page under `/supervisor/documents/[id]/pre-push-variance` with a distinct list button.

**Tech Stack:** FastAPI + dbfread (existing variance API package), Next.js App Router, existing session/document access helpers.

## Global Constraints

- Formula: `projectedDiff = appCountedQty − live LOCBAL` (not PHYBAL − LOCBAL).
- App counted qty = effective entry `totalBaseQty` (same basis as Express push PHYBAL).
- Live LOCBAL from `STLOC.DBF` via FastAPI; Bearer token server-side only.
- No auto-fetch on page load.
- Button label: `เทียบก่อนส่ง Express` (list) / `ดึงคงเหลือ Express` (page).
- Page copy must state this is **before push** and does **not** write Express.
- Keep post-push STTAK3 report as a separate button/page.
- Missing STLOC SKU → show ไม่พบคงเหลือ, projectedDiff `null`.
- Uncounted app line → app qty empty, projectedDiff `null`.
- Prefer bringing `external/express-variance-api` onto this branch from `feature/fastapi-express-variance` if missing, then add balances endpoint.

---

### Task 1: FastAPI STLOC balances endpoint (TDD)

**Files:**
- Ensure package present: `external/express-variance-api/` (copy/merge from `feature/fastapi-express-variance` if needed)
- Modify: `external/express-variance-api/app/variance.py` — add `load_location_balances`
- Modify: `external/express-variance-api/app/main.py` — route
- Create/Modify: `external/express-variance-api/tests/test_balances.py` (or extend `test_api.py`)

**Interfaces:**
- Produces: `GET /api/stockcount/locations/{locationCode}/balances` →  
  `{ success, locationCode, fetchedAt, balances: [{ ProductCode, LocationBalance }] }`
- Auth: same Bearer as variance

- [ ] **Step 1: Write failing tests**

Cases:
1. Valid location → rows with ProductCode uppercase/trimmed, LocationBalance float
2. Unknown location / empty STLOC filter → `success: true`, `balances: []` (200)
3. Missing auth → 401
4. Invalid location segment → 400

- [ ] **Step 2: Implement `load_location_balances(db_path, location_code)`**

Reuse `_open_dbf`, `_as_str`, `_as_float` from variance.py. Read STLOC only; filter `LOCCOD`.

- [ ] **Step 3: Wire route + run pytest**

```powershell
cd external/express-variance-api
.\.venv\Scripts\Activate.ps1
pytest tests/ -q
```

- [ ] **Step 4: Commit**

```bash
git add external/express-variance-api
git commit -m "Add FastAPI endpoint for live Express STLOC balances."
```

---

### Task 2: Next types + map helpers + service

**Files:**
- Modify: `src/types/express-variance.ts` — add pre-push types
- Create: `src/lib/pre-push-variance.ts` — `projectedDiff(appQty, locBal)`, `indexBalancesByProductCode`
- Create: `src/lib/pre-push-variance.test.ts`
- Create: `src/services/pre-push-variance.service.ts`
- Create: `src/app/api/count-documents/[documentId]/pre-push-variance/route.ts` (POST or GET with `?balances=1` — prefer **two endpoints** below)

**Recommended API split (matches “no auto-fetch”):**
1. Reuse / mirror report context: lines + document header  
   - Can reuse `getExpressVarianceReportContext` **or** rename/share as generic document count lines for compare
2. `GET /api/count-documents/[documentId]/pre-push-balances`  
   - Calls FastAPI balances for doc.locationCode  
   - Returns `{ success, locationCode, fetchedAt, balanceByProductCode, projectedByProductCode? }`  
   - Or return balances only; UI computes diff

**Interfaces:**
```ts
projectedDiff(appQty: number | null, locBal: number | null): number | null
// null if either side null

type PrePushBalancesResult = {
  success: true;
  locationCode: string;
  fetchedAt: string;
  balanceByProductCode: Record<string, number | null>;
};
```

- [ ] **Step 1: Unit tests for `projectedDiff` + index helpers**
- [ ] **Step 2: Implement service** calling  
  `{BASE}/api/stockcount/locations/{code}/balances` with Bearer
- [ ] **Step 3: Route + 503 if env missing; 400 if no locationCode**
- [ ] **Step 4: Commit**

```bash
git commit -m "Add Next proxy for live Express balances before push."
```

---

### Task 3: Pre-push UI page + list buttons

**Files:**
- Create: `src/components/PrePushVarianceTable.tsx`
- Create: `src/app/supervisor/documents/[documentId]/pre-push-variance/page.tsx`
- Modify: `src/app/supervisor/documents/page.tsx`
- Modify: `src/components/SupervisorDocumentRow.tsx`

**Page:**
- Hint (amber): เทียบยอดนับในแอปที่จะส่ง กับ LOCBAL สด — ยังไม่เขียน Express
- Load document lines via existing express-variance-report context API **or** shared helper (do not use recount review page)
- Button `ดึงคงเหลือ Express` → balances API
- Columns: รหัส, ชื่อ, นับได้(ที่จะส่ง), คงเหลือ LOCBAL, ผลต่างที่คาด
- Nav: `← กลับรายการเอกสาร`

**List buttons:**
- Add `เทียบก่อนส่ง Express` → `/supervisor/documents/${id}/pre-push-variance`
- Keep `รายงานผลต่าง Express` (post-push) separate
- Show on completed tab; also on pending SUBMITTED if easy (spec allows ทั้งรอตรวจ/เสร็จสิ้น)

- [ ] **Step 1: Build table + page**
- [ ] **Step 2: Wire list buttons**
- [ ] **Step 3: Manual smoke** with FastAPI on 8090 + BKK3 UNC against a completed doc
- [ ] **Step 4: Commit**

```bash
git commit -m "Add pre-push Express balance compare page and list entry points."
```

---

### Task 4: Verify

- [ ] FastAPI pytest green
- [ ] `npx tsc --noEmit`
- [ ] Spot-check 3 SKUs: API LOCBAL == DBF
- [ ] Confirm post-push report page still reachable with different label
- [ ] Push branch / finishing-a-development-branch options

## Spec coverage

| Spec item | Task |
|-----------|------|
| FastAPI balances | Task 1 |
| Next proxy + formula | Task 2 |
| Pre-push page + copy | Task 3 |
| Separate list button | Task 3 |
| No auto-fetch | Task 3 |
| Keep post-push report | Task 3–4 |
