# HQ Document History (Admin)

**Date:** 2026-07-13  
**Status:** Pending user review  
**Goal:** Let **HQ / Admin** browse all accessible count documents (any status) and inspect history (audit + version compare), plus search Audit Log without needing raw `documentId`.

## Decisions

| Topic | Choice |
|-------|--------|
| Approach | **B** — new Admin document browser + improved Audit Log search |
| Roles | **HQ + Admin** only for these Admin pages |
| Supervisor Approve | Unchanged — still only pending review statuses |
| Detail page actions | **Read-only** — no Approve / Request recount |
| Reuse | AuditLogPanel + existing version compare APIs/UI |

## Out of scope

- Staff tablet history view
- Changing recount / count workflow
- Editing quantities from Admin history pages

## 1. Admin → เอกสาร (`/admin/documents`)

### List

- Show count documents the caller can access (HQ/Admin: all branches; same `canAccessDocument` rules for hub/central).
- Include **all statuses** (IMPORTED, COUNTING, SUBMITTED, RECOUNT_REQUESTED, REVIEWING, COMPLETED).
- Filters (client and/or query params):
  - text: `documentNo`, `locationCode`, `locationName`
  - `documentDate` (exact or from/to)
  - `status`
- Columns / card fields: document no, date, location, hub/HQ badge, status, version no, counted/total lines.

### Detail (`/admin/documents/[documentId]`)

- Header: document meta + status badge.
- Sections:
  1. **Audit Log** (document-scoped) — reuse `AuditLogPanel`
  2. Link **เปรียบเทียบเวอร์ชัน** → `/supervisor/review/[documentId]/versions` (same page/APIs HQ already can open; no duplicate admin versions page in v1)
- No mutate buttons (approve / recount / delete).

## 2. Admin → Audit Log (enhance existing `/admin/audit-logs`)

Keep current “all logs” view. Add search fields:

| Field | Behavior |
|-------|----------|
| เลขเอกสาร (`documentNo`) | Resolve matching document id(s), then filter logs |
| รหัสคลัง (`locationCode`) | Match documents by location, then filter logs |
| วันที่เอกสาร (`documentDate`) | Match documents by count date, then filter logs |
| `documentId` (optional advanced) | Keep as today for exact id |

If multiple documents match text/location/date filters, show logs for all matches (cap / note if result set is large, e.g. first 500 logs). Empty filters = recent global logs as today.

## 3. APIs

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/admin/count-documents` | List + optional query filters; HQ/Admin only |
| GET | `/api/admin/count-documents/[documentId]` | Detail + audit logs (read-only); access-checked |
| GET | `/api/admin/audit-logs` | Extend query: `documentNo`, `locationCode`, `documentDate`, existing `documentId` |

Version list/compare: reuse existing `/api/count-documents/[id]/versions` (+ compare) if already allowed for HQ; otherwise gate via admin session check consistently.

## 4. Navigation

- Add **เอกสาร** to `AdminNav` (between Sync/Settings and Audit Log as fits).
- Existing Supervisor / Tablet links unchanged.

## 5. Acceptance

1. HQ opens Admin → เอกสาร, sees completed and in-progress docs.
2. Opens a doc → sees audit timeline and can open version compare.
3. Admin → Audit Log: search by document no or location code returns relevant logs without pasting internal id.
4. Supervisor Approve list behavior unchanged.
