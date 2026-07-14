# Tablet Documents Touch Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `/tablet/documents` touch-friendly below the `lg` breakpoint without changing Sync API behavior or the count pages.

**Architecture:** Responsive Tailwind in `ExpressSyncPanel` (stack actions below `lg`) plus tablet-page tweaks for tabs, cards, and empty state. No new components.

**Tech Stack:** Next.js App Router, React client components, Tailwind, existing `Button` / `Tabs` / `Card` UI.

**Spec:** `docs/superpowers/specs/2026-07-14-tablet-documents-touch-layout-design.md`

---

## File map

| File | Responsibility |
|------|----------------|
| `src/components/ExpressSyncPanel.tsx` | Sync panel responsive layout + touch-sized location rows |
| `src/app/tablet/documents/page.tsx` | Tabs, document cards, empty state for tablet |
| (optional) `src/components/PageShell.tsx` | Only if header needs compact tweak |

---

### Task 1: ExpressSyncPanel touch layout

**Files:**
- Modify: `src/components/ExpressSyncPanel.tsx`

- [x] **Step 1: Stack date + actions below `lg`**

Change the controls row so below `lg` the date is full width and buttons stack full width with `size="lg"`; at `lg+` keep the current horizontal layout.

```tsx
<div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
  <div className="grid w-full gap-2 lg:max-w-xs">
    {/* Label + DateInputDMY + hint */}
  </div>
  <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap lg:w-auto">
    <Button size="lg" className="w-full sm:w-auto lg:w-auto" ...>
      1. โหลดคลัง
    </Button>
    {/* same for select-all and sync */}
  </div>
</div>
```

Use: stacked full-width on default/tablet; allow `sm:flex-row` only if it still avoids crowding on ~768px — prefer **column until `lg`** for buttons:

```tsx
<div className="flex w-full flex-col gap-2 lg:w-auto lg:flex-row lg:flex-wrap">
  <Button type="button" size="lg" className="w-full lg:w-auto" ...>
```

- [ ] **Step 2: Enlarge location row hit targets**

- Checkbox: `className="mt-1 size-5 ..."`
- Label row: `px-4 py-4` (was `py-3`)
- Empty retry button: `size="lg"` (or at least default, not `sm`)

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`  
Expected: exit 0

- [ ] **Step 4: Commit**

```bash
git add src/components/ExpressSyncPanel.tsx
git commit -m "Make Express sync panel touch-friendly below lg."
```

---

### Task 2: Tablet documents page tabs + cards

**Files:**
- Modify: `src/app/tablet/documents/page.tsx`

- [ ] **Step 1: Touch-friendly filter tabs**

```tsx
<Tabs ... className="mb-4">
  <TabsList className="flex h-auto w-full flex-nowrap justify-start gap-1 overflow-x-auto p-1">
    <TabsTrigger value="all" className="min-h-11 flex-1 px-3 py-2.5">
      ทั้งหมด
    </TabsTrigger>
    {/* same min-h-11 / flex-1 for other triggers */}
  </TabsList>
</Tabs>
```

- [ ] **Step 2: Document cards — full-width actions on narrow**

```tsx
<CardHeader className="flex flex-col gap-4 space-y-0 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
  <div className="min-w-0">...</div>
  <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
    <Button ... size="lg" className="w-full sm:w-auto">ลบ</Button>
    <Button ... size="lg" className="w-full sm:w-auto">เริ่มนับ</Button>
  </div>
</CardHeader>
```

- [ ] **Step 3: Tighter empty state**

```tsx
<div className="rounded-lg border border-dashed px-4 py-6 text-center">
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`  
Expected: exit 0

- [ ] **Step 5: Commit**

```bash
git add src/app/tablet/documents/page.tsx
git commit -m "Improve tablet documents tabs and card touch targets."
```

---

### Task 3: Visual QA + skip PageShell unless needed

**Files:**
- Possibly modify: `src/components/PageShell.tsx` — **only if** header still feels broken after Tasks 1–2

- [ ] **Step 1: Decide on PageShell**

Default: **no change**. Leave header as-is unless title/logout still collide badly on ~768px.

- [ ] **Step 2: Final typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`  
Expected: exit 0

- [ ] **Step 3: Manual checklist**

1. Tablet documents ~768–1024: Sync buttons stacked, easy to tap
2. Tabs scroll/full width, large taps
3. Card actions full width on narrow
4. Admin `/admin/sync` at ≥1024: horizontal Sync layout still OK

---

## Spec coverage

| Spec item | Task |
|-----------|------|
| Sync stack below `lg`, lg+ horizontal | Task 1 |
| Location rows taller / checkbox larger | Task 1 |
| Filter tabs touch + scroll | Task 2 |
| Document card actions | Task 2 |
| Empty state tighter padding | Task 2 |
| PageShell only if needed | Task 3 |
| No count pages / no API change | (out of plan) |
