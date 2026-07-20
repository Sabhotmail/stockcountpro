# Nav Label & Role Consistency

**Date:** 2026-07-20  
**Status:** Implemented  
**Extends:** `2026-07-13-admin-menu-ux-design.md`

## Goal

Make Admin and Supervisor navigation **language-consistent (Thai)** and **structurally aligned**, while showing menus by role:

- **Admin** sees every nav item.
- **Other roles** see only pages their permissions allow.

Routes and API authorization stay as today; this change is primarily **nav labels + visibility**.

## Thai labels (shared)

| Previous | New |
|----------|-----|
| Audit Log | บันทึกการใช้งาน |
| Hub | ศูนย์กระจาย |
| Approve | รออนุมัติ |
| นับสต็อก (Tablet) | นับสต็อก |
| เอกสาร / ประวัติ | เอกสาร |

Unchanged: ภาพรวม, ผู้ใช้, สาขา, ตั้งค่า, ลบรายการนับ Express, งานหลัก, ตั้งค่าระบบ, ปฏิบัติงาน.

## Group structure

### Admin (`AdminNav`)

1. **งานหลัก** — ภาพรวม · เอกสาร · บันทึกการใช้งาน  
2. **ตั้งค่าระบบ** — ผู้ใช้ · สาขา · ศูนย์กระจาย · ตั้งค่า  
3. **ปฏิบัติงาน** — รออนุมัติ · นับสต็อก · ลบรายการนับ Express  

Admin always gets all three groups and every item above.

### HQ (`AdminNav`, no system group)

Same as Admin **except** omit **ตั้งค่าระบบ** (`canManageSystem` = false).

1. **งานหลัก** — ภาพรวม · เอกสาร · บันทึกการใช้งาน  
2. **ปฏิบัติงาน** — รออนุมัติ · นับสต็อก · ลบรายการนับ Express  

### SupervisorNav (used on `/supervisor/*` and tablet for supervising roles)

Admin must see every page from every shell. Build groups by role:

| Role | Groups shown |
|------|----------------|
| **Admin** | Same full menu as `AdminNav` (งานหลัก + ตั้งค่าระบบ + ปฏิบัติงาน) |
| **HQ** | Same as HQ on `AdminNav` (งานหลัก + ปฏิบัติงาน, no ตั้งค่าระบบ) |
| **Supervisor** | **ปฏิบัติงาน** only — ภาพรวม · รออนุมัติ · นับสต็อก · ลบรายการนับ Express |
| **Branch Manager** | **ปฏิบัติงาน** only — ภาพรวม · รออนุมัติ · นับสต็อก (no Express delete) |

Prefer a shared group builder so Admin/HQ labels and order never drift between `AdminNav` and `SupervisorNav`.

### Staff / Counter / Viewer

No Admin/Supervisor chrome. Home remains tablet (`/tablet/documents`). No change to tablet chrome in this spec.

## Visibility matrix

| Item | Admin | HQ | Supervisor | Branch Manager | Staff/Counter |
|------|:-----:|:--:|:----------:|:--------------:|:-------------:|
| ภาพรวม | ✓ | ✓ | ✓ | ✓ | — |
| เอกสาร | ✓ | ✓ | — | — | — |
| บันทึกการใช้งาน | ✓ | ✓ | — | — | — |
| ผู้ใช้ / สาขา / ศูนย์กระจาย / ตั้งค่า | ✓ | — | — | — | — |
| รออนุมัติ | ✓ | ✓ | ✓ | ✓ | — |
| นับสต็อก | ✓ | ✓ | ✓ | ✓ | ✓ (home) |
| ลบรายการนับ Express | ✓ | ✓ | ✓ | — | — |

Permission helpers already in `permissions.ts`:

- `canManageSystem` → Admin only (ตั้งค่าระบบ)
- `canAccessAdmin` → Admin + HQ (งานหลัก admin pages)
- `canSupervise` → Admin, HQ, Supervisor, Branch Manager
- `canDeleteExpressStockCount` → Admin, HQ, Supervisor (not Branch Manager)

## Implementation notes

1. Extract shared nav group builders (or shared label constants) so Admin/HQ menus stay identical in `AdminNav` and `SupervisorNav`.  
2. Update all nav labels to Thai per table above.  
3. Reorder `ปฏิบัติงาน` to: รออนุมัติ → นับสต็อก → ลบรายการนับ Express (ภาพรวม first only on supervisor-only shell).  
4. Gate Express-delete with `canDeleteExpressStockCount(role)`.  
5. Gate ตั้งค่าระบบ with `canManageSystem(role)`.  
6. Keep existing `href`s; do not rename routes.

## Out of scope

- Sidebar layout redesign  
- Middleware / API permission changes beyond existing helpers  
- Renaming English terms inside page body copy (forms, toasts) — nav only unless trivial  
- Tablet-specific nav chrome  

## Acceptance

- Admin on admin **and** supervisor/tablet shells sees all three groups and every item in the matrix.  
- HQ has no ตั้งค่าระบบ.  
- Supervisor has only ปฏิบัติงาน including Express delete.  
- Branch Manager has ปฏิบัติงาน without Express delete.  
- No English-only nav labels remaining in AdminNav / SupervisorNav (`Audit Log`, `Hub`, `Approve`, `(Tablet)`).  
