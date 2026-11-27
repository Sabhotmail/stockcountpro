# Express Variance Document Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move Express variance compare off the supervisor review table onto a dedicated per-document report page with clearer copy.

**Architecture:** Keep `GET /api/count-documents/[documentId]/express-variance` unchanged. Add `…/express-variance/page.tsx` that loads review lines + optional Express map. Strip Express fetch UI from the review page and replace with a nav link. Prefer a dedicated table component for the report so review stays simple.

**Tech Stack:** Next.js App Router client pages, existing review API, existing Express variance proxy, shared UI primitives (`Alert`, `Button`, `PageShell`).

## Global Constraints

- Copy must state this is Express-side report (PHYBAL/LOCBAL), **not** pre-push validation.
- Button label: `ดึงรายงานผลต่างจาก Express` / loading `กำลังดึง…`
- Nav link from review: `รายงานผลต่าง Express`
- No auto-fetch on page load.
- No new sidebar menu.
- Reuse existing proxy; do not change FastAPI formula.
- Review page must not show Express columns or fetch button.

---

### Task 1: Extract report table component

**Files:**
- Create: `src/components/ExpressVarianceReportTable.tsx`
- Modify: `src/components/ReviewLineList.tsx` — remove Express-specific props/columns from review table/card (keep app difference column)

**Interfaces:**
- Consumes: `ReviewLineItem[]`, `Record<string, ExpressVarianceLine> | null`
- Produces: `ExpressVarianceReportTable({ lines, expressVarianceByProductCode })` with grouped headers ฝั่งแอป / ฝั่ง Express

- [ ] **Step 1: Create `ExpressVarianceReportTable`**

Move formatting helpers as needed (`formatNumber`, `DiffValue`, `lookupExpress`, counted qty). Table headers:

```text
รหัส | ชื่อ | ฝั่งแอป: นับได้, ผลต่างแอป | ฝั่ง Express: ยอดนับ, คงเหลือ, ผลต่าง
```

When `expressVarianceByProductCode === null` → show empty state row or message “ยังไม่ได้ดึงรายงาน” (no Express cells filled). When map is object → fill cells; missing SKU → `ไม่พบใน Express`.

- [ ] **Step 2: Simplify `ReviewLineList`**

Remove `showExpressColumns` / `expressVarianceByProductCode` from `ReviewLineCard` and `ReviewLineTable`. Keep `ผลต่างแอป` column on review table/card.

- [ ] **Step 3: Quick typecheck / ensure no broken imports**

```powershell
npx tsc --noEmit -p tsconfig.json
```

Fix any call sites still passing Express props.

- [ ] **Step 4: Commit**

```bash
git add src/components/ExpressVarianceReportTable.tsx src/components/ReviewLineList.tsx
git commit -m "Extract Express variance report table from review list."
```

---

### Task 2: Add dedicated report page

**Files:**
- Create: `src/app/supervisor/review/[documentId]/express-variance/page.tsx`

**Interfaces:**
- Consumes: review API `GET /api/supervisor/count-documents/${documentId}/review`, variance API `GET /api/count-documents/${documentId}/express-variance`
- Produces: client page with hint banner, fetch button, timestamp, error + retry

- [ ] **Step 1: Scaffold page**

Mirror patterns from supervisor review page (`PageShell`, session 401 → login, `DetailSkeleton`).

Header content:
- Title: `รายงานผลต่าง Express`
- Subtitle: `{locationName|locationCode} · วันที่ {documentDate}`
- Nav: `← กลับหน้ารีวิว` → `/supervisor/review/${documentId}`

Hint (`Alert` or muted box) Thai copy from spec:

> หน้านี้แสดงยอดที่อยู่ใน Express แล้ว (ยอดนับ = PHYBAL, คงเหลือ = LOCBAL, ผลต่าง = PHYBAL − LOCBAL) ไม่ใช่ขั้นตอนตรวจก่อนส่งยอดจากแอปเข้า Express

- [ ] **Step 2: Wire fetch + table**

State: `review`, `expressVariance`, `fetchedAt`, `loading`, `expressLoading`, `error`, `expressError`.

Button disabled when `!document.locationCode?.trim()` or loading.

On success set map + `fetchedAt`; render `ExpressVarianceReportTable`.

Optional filters (code/name) — nice-to-have; skip unless quick copy from review.

- [ ] **Step 3: Manual smoke**

Open `/supervisor/review/doc_branch_bkk3_20261126_loc_2425/express-variance`, click fetch, confirm columns + hint.

- [ ] **Step 4: Commit**

```bash
git add src/app/supervisor/review/[documentId]/express-variance/page.tsx
git commit -m "Add per-document Express variance report page."
```

---

### Task 3: Clean review page + link

**Files:**
- Modify: `src/app/supervisor/review/[documentId]/page.tsx`

- [ ] **Step 1: Remove Express state and handlers**

Delete `expressVariance`, `expressFetchedAt`, `expressLoading`, `expressError`, `fetchExpressVariance`, related UI (button, badges, alerts).

- [ ] **Step 2: Add nav link**

In the review `nav` links next to versions:

```tsx
<Link href={`/supervisor/review/${documentId}/express-variance`}>
  รายงานผลต่าง Express
</Link>
```

- [ ] **Step 3: Pass only lines to `ReviewLineCard` / `ReviewLineTable`**

- [ ] **Step 4: Commit**

```bash
git add src/app/supervisor/review/[documentId]/page.tsx
git commit -m "Move Express variance entry point off the review table."
```

---

### Task 4: Verify

- [ ] **Step 1: `npx tsc --noEmit -p tsconfig.json`**
- [ ] **Step 2: Confirm review page has no Express columns; report page works**
- [ ] **Step 3: Push branch / finish per finishing-a-development-branch**

## Spec coverage

| Spec item | Task |
|-----------|------|
| Separate route | Task 2 |
| Hint not pre-push | Task 2 |
| Grouped app/Express headers | Task 1 |
| Remove from review | Task 3 |
| Link from review | Task 3 |
| Same API | Task 2 |
