# Nav Label & Role Consistency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thai-consistent nav labels and role-gated menus so Admin sees every item; other roles see only allowed pages.

**Architecture:** Extract a shared `buildAppNavGroups(role)` helper used by both `AdminNav` and `SupervisorNav`. Gate groups/items with existing `permissions.ts` helpers. No route renames.

**Tech Stack:** Next.js client components, existing `AppNav`, `UserRole`, `permissions.ts`.

## Global Constraints

- Thai labels per `docs/superpowers/specs/2026-07-20-nav-label-role-consistency-design.md`
- Admin sees full menu on every shell; HQ no ตั้งค่าระบบ; Branch Manager no Express delete
- Keep existing hrefs

---

## File map

| File | Responsibility |
|------|----------------|
| `src/lib/nav-groups.ts` (new) | Shared group builder by role |
| `src/components/AdminNav.tsx` | Load role → `buildAppNavGroups` |
| `src/components/SupervisorNav.tsx` | Same builder (Admin/HQ get full/HQ menu) |

---

### Task 1: Shared nav group builder

**Files:** create `src/lib/nav-groups.ts`

- [ ] Add `buildAppNavGroups(role: UserRole | null): AppNavGroup[]`
  - null → HQ-safe (งานหลัก + ปฏิบัติงาน, no ตั้งค่าระบบ) until role loads
  - Admin → all three groups
  - HQ (`canAccessAdmin` && !`canManageSystem`) → งานหลัก + ปฏิบัติงาน
  - Supervisor → ปฏิบัติงาน with Express delete
  - Branch Manager → ปฏิบัติงาน without Express delete
  - Labels: เอกสาร, บันทึกการใช้งาน, ศูนย์กระจาย, รออนุมัติ, นับสต็อก
  - Admin/HQ ปฏิบัติงาน order: รออนุมัติ · นับสต็อก · ลบ…; supervisor shell adds ภาพรวม first in ปฏิบัติงาน only when not showing งานหลัก (or always put ภาพรวม in งานหลัก for Admin/HQ and in ปฏิบัติงาน for supervisor-only)

**Dashboard hrefs:** Admin/HQ ภาพรวม → `/admin/dashboard`; Supervisor/BM → `/supervisor/dashboard`

- [ ] Verify TypeScript compiles for the new file

### Task 2: Wire AdminNav + SupervisorNav

**Files:** `AdminNav.tsx`, `SupervisorNav.tsx`

- [ ] Replace hard-coded groups with `buildAppNavGroups(role)`
- [ ] SupervisorNav: fetch role like AdminNav; use same builder (remove old ประวัติ group)
- [ ] AdminNav: `canAccessAdmin` gate still returns null for non-admin roles

### Task 3: Smoke check

- [ ] Confirm no remaining English nav labels in those two components
- [ ] `npx tsc --noEmit` (or project lint on touched files)

---

## Done when

Acceptance checklist in the design spec passes.
