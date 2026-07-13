# Admin & Menu UX Polish

**Date:** 2026-07-13  
**Status:** Implemented  
**Goal:** Make Admin/HQ navigation scannable and consistent across Admin, Tablet, and Approve.

## Changes

1. **Grouped nav (`AppNav`)** — sections with small labels instead of one long pill row  
2. **AdminNav groups:** งานหลัก (เอกสาร, Audit) · ตั้งค่าระบบ · ปฏิบัติงาน (Tablet, Approve)  
3. **SupervisorNav** — same pattern; HQ/Admin see Admin shortcuts  
4. **PageShell** — show brand `StockCount Pro` above page title; nav separated by a light divider  
5. **Login home for HQ/Admin** → `/admin/documents` (primary work: document history)

## Out of scope

- Full sidebar layout  
- Redesign of individual admin CRUD forms  
