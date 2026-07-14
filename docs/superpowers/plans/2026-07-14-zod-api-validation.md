# Zod API Request Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Zod as a direct dependency and validate JSON request bodies at Next.js Route Handlers without changing service-layer business rules.

**Architecture:** Shared `readJsonBody` + `parseWithSchema` helpers return either typed data or a 400 `NextResponse`. Endpoint schemas live in `src/lib/api/schemas.ts`. Handlers replace `as` casts / manual typeof checks with schema parse. Error shape stays `{ error: string }`.

**Tech Stack:** Zod 4, Next.js Route Handlers, node:assert tests (existing project style)

**Spec:** `docs/superpowers/specs/2026-07-14-zod-api-validation-design.html`

---

### Task 1: Install zod + body parse helpers (TDD)

**Files:**
- Create: `src/lib/api/parse-body.ts`
- Create: `src/lib/api/parse-body.test.ts`
- Modify: `package.json` (via npm install)

- [ ] **Step 1:** Write failing tests for `formatZodError`, `parseWithSchema` success/fail
- [ ] **Step 2:** Run `npx tsx src/lib/api/parse-body.test.ts` — expect fail
- [ ] **Step 3:** `npm install zod` and implement helpers
- [ ] **Step 4:** Re-run test — pass
- [ ] **Step 5:** Commit

### Task 2: Request schemas (TDD)

**Files:**
- Create: `src/lib/api/schemas.ts`
- Create: `src/lib/api/schemas.test.ts`

- [ ] **Step 1:** Tests for login, sync locations union, save entry, batch items
- [ ] **Step 2:** Implement schemas; run tests green
- [ ] **Step 3:** Commit

### Task 3: Wire handlers

**Files:** All routes under `src/app/api/**` that call `request.json()`

- [ ] Replace body parsing with helpers + schemas
- [ ] Preserve approve empty-body behavior
- [ ] Commit

### Task 4: Verify

- [ ] Run schema/helper tests
- [ ] `npm run build`
- [ ] Push + open PR
