# Full-Document Recount with Prior Values

**Date:** 2026-07-13  
**Status:** Implemented  
**Goal:** When supervisor requests recount, require recount of the **entire document**, with a **single reason**, and seed the new draft from the **previously submitted quantities**.

## Behavior

1. Supervisor opens recount dialog → enters one reason for the whole document.
2. System creates a new DRAFT version and copies all qty from the submitted base version into live `CountEntry`.
3. Staff/Supervisor reopen the document and edit from those prior values; all lines remain in scope.
4. Document status → `RECOUNT_REQUESTED`.

## API

`POST /api/supervisor/count-documents/:id/request-recount`

```json
{ "baseVersionId": "ver_...", "reason": "พบผลต่างหลายรายการ" }
```

Server expands to `RecountRequestItem` for every product line (same reason) for audit history.
