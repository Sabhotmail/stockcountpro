# Bulk Express Push + Optional Auto-Push on Approve — Design

**Date:** 2026-07-14

## Goal

1. Let Supervisor / Admin push many **COMPLETED** documents to Express in one action.
2. Let Supervisor optionally push to Express when approving (checkbox, default off).

## Decisions

| Topic | Choice |
|-------|--------|
| Architecture | Server-owned; reuse `pushDocumentToExpress` |
| Bulk eligibility | COMPLETED + access OK + **never successfully pushed** (`PUSH_TO_EXPRESS` detail starts with `ok;`) |
| Bulk execution | Sequential per document; per-item results |
| Approve + push | Checkbox 「ส่ง Express ด้วย」 **default off** |
| Push failure after approve | Approve still succeeds; return/warn push error (manual retry OK) |
| Out of scope | Background queue; block approve on Express failure; bulk re-push of already-sent docs |

## Bulk API

```text
POST /api/count-documents/push-express-bulk
Body: { "documentIds": string[] }
Auth: session with canPushToExpress + document access
```

Response:

```json
{
  "summary": { "requested": 3, "pushed": 1, "skipped": 1, "failed": 1 },
  "results": [
    { "documentId": "...", "status": "pushed", "lineCount": 15, "locationCode": "2411", "userIdSent": "chmstaff", "expressResponse": {} },
    { "documentId": "...", "status": "skipped", "reason": "already_pushed" },
    { "documentId": "...", "status": "failed", "error": "..." }
  ]
}
```

Skip reasons: `already_pushed`, `not_completed`, `not_found` / access denied, `empty_selection`.

Cap: max **50** IDs per request.

## Approve API change

```text
POST /api/supervisor/count-documents/:documentId/approve
Body (optional): { "pushToExpress": boolean }
```

Flow:

1. Run existing approve (→ COMPLETED).
2. If `pushToExpress === true`, call `pushDocumentToExpress`.
3. Response: `{ success: true, expressPush?: { ok: true, ... } | { ok: false, error: string } }`

## UI

### Bulk (Supervisor completed tab + Admin documents)

- Row checkboxes (completed + not yet pushed selectable; already pushed disabled or excluded).
- Toolbar: 「ส่ง Express ที่เลือก (N)」 + select-all eligible.
- Confirm dialog → progress/result dialog (pushed / skipped / failed).

### Approve (Supervisor review)

- Replace `window.confirm` with app dialog.
- Checkbox 「ส่ง Express ด้วย」 default **unchecked**.
- On success with failed push: navigate as today but show alert / query note that Express failed.

## Audit

Unchanged: each successful/failed single push still logs `PUSH_TO_EXPRESS`. Bulk is N calls of the same helper.
