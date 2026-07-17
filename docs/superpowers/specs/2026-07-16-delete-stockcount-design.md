# Delete Stock Count by Date and Location

**Date:** 2026-07-16  
**Status:** Approved design  
**Goal:** Add a separate menu for deleting a stock-count dataset from both Express and StockCount Pro by count date and location code.

## Access

- Allowed roles: `ADMIN`, `HQ`, `SUPERVISOR`
- Denied roles: `BRANCH_MANAGER`, `STAFF`, `COUNTER`, `VIEWER`
- Supervisor may delete only documents within existing branch/hub access.
- Permission is enforced by the server; hiding the menu is not sufficient.

## UI

Add a separate page:

```text
/admin/delete-stockcount
```

Menu label:

```text
Delete รายการนับสต็อก
```

The page contains:

1. Count-date input.
2. Location list loaded for that date using the existing Express location flow.
3. One selected location per delete action.
4. A preview of the matching StockCount Pro document and its status.
5. A destructive confirmation showing the count date and location code.
6. Success or error feedback.

The menu is visible only to `ADMIN`, `HQ`, and `SUPERVISOR`. Admin/HQ use `AdminNav`; Supervisor receives the same item in `SupervisorNav`.

## Delete Rules

- Delete is allowed for every document status except:
  - `APPROVED`
  - `COMPLETED`
- If a matching local document has either blocked status, no Express delete is attempted.
- If no matching local document exists, the action is rejected to avoid deleting Express data without a corresponding local record.
- The request identifies one dataset by exact `countDate` and `locationCode`.

## Data Flow

The browser calls one StockCount Pro API route. It never calls Express directly.

```text
UI
  -> StockCount Pro delete API
     -> authenticate and authorize role/location
     -> find local document by count date + location code
     -> reject APPROVED/COMPLETED
     -> DELETE Express dataset
     -> delete local document
     -> write deletion audit record
     -> return success
```

Express endpoint:

```text
DELETE /api/stockcount/countdate/{countdate}/locationcode/{locationcode}
```

Express is deleted first. The local document is deleted only after Express confirms success. This avoids a local deletion when the upstream record still exists.

## Local Deletion

Reuse the existing document deletion service and Prisma cascade behavior where possible. Extend its allowed-role and status checks only where required by this feature instead of creating a second deletion implementation.

The local lookup must match the exact document date and location code. It must not delete every document for a branch or date.

## Express Client

Add a minimal authenticated DELETE helper to the existing Express API service:

- Reuse base URL configuration and bearer-token caching.
- Retry once after `401`, matching existing GET/PUT behavior.
- Encode both path parameters.
- Treat any non-2xx response or `{ success: false }` response as failure.

## Error Handling

- `401`: unauthenticated
- `403`: role or location access denied
- `404`: no matching local document
- `409`: local document is `APPROVED` or `COMPLETED`
- `502`/`503`: Express unavailable or not configured
- Express failure leaves the local document untouched.
- Local deletion failure after a successful Express deletion returns an explicit partial-failure error so an operator can reconcile the local record.

## Audit

Use the existing `DELETE_DOCUMENT` audit action. Record the count date, location code, document number, prior status, and that the Express deletion succeeded.

## Testing

Minimum runnable checks:

1. Permission helper allows only Admin, HQ, and Supervisor.
2. Approved and Completed documents are rejected before Express is called.
3. Express failure does not delete the local document.
4. Successful Express deletion deletes the matching local document.
5. Route validates date and location code.

## Out of Scope

- Bulk deletion of multiple locations in one confirmation.
- Restoring deleted Express or local data.
- Deleting records without a matching local document.
- Allowing Branch Manager, Staff, Counter, or Viewer.
