# Push Count Results to Express — Design

**Date:** 2026-07-14

## Goal

Allow Supervisor / Branch Manager / HQ / Admin to push completed count results back to Express via a dedicated button (not automatic on approve).

## Express API

```text
PUT /api/stockcount/countdate/{countdate}/locationcode/{locationcode}
Authorization: Bearer {token}
Body: { "details": [ { LocationCode, ProductCode, CountDate, CaseQty, CaseUnitFactor, PieceQty, PhysicalBalance, CountFlag, UserID, ChangedDate } ] }
```

## Rules

| Rule | Value |
|------|-------|
| When | Manual button only, document status `COMPLETED` |
| Who | `SUPERVISOR`, `BRANCH_MANAGER`, `HQ`, `ADMIN` + document access |
| Lines | Only counted lines (`isEntryCounted`) |
| `UserID` | Session user's `username`, truncated to **8** chars |
| `CountFlag` | `"3"` (per Express sample) |
| `ChangedDate` | Today `YYYY-MM-DD` (Asia/Bangkok) |
| `PhysicalBalance` | `totalBaseQty` (or computed from case/pack/piece) |
| `CaseUnitFactor` | `productLine.caseRatio` (same as sync inbound `CaseUnitFactor`) |
| Re-send | Allowed; each attempt logged |

## App surface

- `POST /api/count-documents/[documentId]/push-express`
- Button on Admin document detail / list (COMPLETED) and Supervisor completed tab
- Audit action `PUSH_TO_EXPRESS`

## Out of scope (MVP)

- Auto-push on Approve always (without checkbox)
- Bulk push of documents already pushed successfully
- Background job queue

## Related

- Optional approve checkbox + bulk UI: see `2026-07-14-bulk-and-auto-push-express-design.md`
