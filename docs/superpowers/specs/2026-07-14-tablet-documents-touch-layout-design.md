# Tablet documents page — touch-first layout

**Date:** 2026-07-14  
**Status:** Approved  
**Route:** `/tablet/documents`  
**Approach:** Touch-first layout (shared `ExpressSyncPanel` with responsive behavior)

## Goal

Make the tablet document list usable with fingers on typical tablet widths (~768–1024px portrait/landscape): large tap targets, stacked Sync actions, readable filters and document cards — without changing Sync/API behavior.

## Non-goals

- No API or Express Sync workflow changes
- No redesign of `/tablet/count/...` in this work
- No brand/color redesign
- No separate duplicate `TabletSyncPanel` component

## Current problems

- Sync controls sit in a dense horizontal row (date + three buttons) that is awkward on tablet
- Default button/checkbox/tab hit areas are desktop-sized
- Filter tabs can crowd
- Empty states use large vertical padding that wastes viewport
- Header/user chip layout is fine on desktop but should stay touch-friendly on tablet

## Design

### 1. Express Sync panel (`ExpressSyncPanel`)

Used on both tablet documents and Admin sync. Behavior:

| Viewport | Layout |
|----------|--------|
| Below `lg` (< 1024px) | Date field full width; action buttons stacked full-width, `size="lg"` (~44px min height) |
| `lg` and up (≥ 1024px) | Keep current side-by-side row (date left, buttons wrap right) |

Also:

- Location rows: taller padding (`py-4`), checkbox ~20px (`size-5`)
- Empty/error blocks: tighter vertical padding; keep existing copy and retry CTA
- Date field stays `DateInputDMY` (DD/MM/YYYY display); full width on tablet

Prefer CSS/responsive classes over a `variant="tablet"` prop unless Admin layout clearly breaks — then add an optional `dense` / `layout` prop with tablet page passing the touch layout.

### 2. Tablet documents page (`src/app/tablet/documents/page.tsx`)

- **Filter tabs:** full-width list where practical; triggers with larger min height / padding; allow horizontal scroll if labels overflow (`overflow-x-auto`) without wrapping into an ugly multi-line stack
- **Document cards:** on narrow widths, primary actions (เริ่มนับ / เปิด / ลบ) stack full-width under the title block; keep `size="lg"`
- **Empty state:** reduce padding (e.g. `py-6` instead of `py-10`); keep instruction pointing to Sync steps
- **Loading/error:** no behavior change; keep existing skeletons/alerts

### 3. Page shell / header (tablet only if needed)

- Do not break Admin/Supervisor pages
- If tablet needs denser header: pass `className` or a small `compact` option on `PageShell` **only if** required after Sync/tabs/cards changes; otherwise leave `PageShell` alone

## Out of scope files

- `src/app/tablet/count/[documentId]/page.tsx`
- `src/app/tablet/count/[documentId]/summary/page.tsx`
- Supervisor/Admin document lists (except incidental `ExpressSyncPanel` responsive CSS)

## Acceptance criteria

1. On ~768–1024px width, Sync date and primary actions are easy to tap without horizontal crowding
2. Filter tabs remain usable (full width or scroll) with larger taps
3. Document card open/delete actions are easy to hit with a finger
4. Admin `/admin/sync` still usable on desktop (existing horizontal layout on wide screens)
5. Sync load/select/sync behavior unchanged

## Implementation notes

- Prefer Tailwind responsive utilities already used in the repo (`sm:`, `md:`, `lg:`)
- Reuse existing `Button` sizes rather than inventing new components
- Visual QA: tablet documents empty + with locations + with document cards; Admin sync on wide desktop
