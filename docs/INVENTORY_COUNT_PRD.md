# Inventory Count System PRD

## 1. Project Goal

Create an Inventory Count System for warehouse/branch stock counting.

Users:

- Staff count products mainly on Tablet
- Supervisors review and approve on Computer
- Admin can manage and view all branches

The system should eventually connect to Express API, but the first phase must be Mock-first because the real Express API is not ready.

## 2. Current Development Mode

This project is currently in Prototype / Mock-first mode.

The goal is to see:

- Login flow
- Branch-based document list
- Tablet counting UI
- Auto Save mock
- Submit to supervisor
- Supervisor review
- Approve
- Request recount
- Basic version
- Basic audit log

Production-grade behavior can be added later.

## 3. Target Stack

- Next.js App Router
- TypeScript
- API Route Handlers
- Mock API first
- Later Prisma ORM
- Later PostgreSQL / SQL Server
- Later Auth.js / Microsoft Entra ID
- Later Dexie.js / IndexedDB
- Later Express API integration

## 4. Roles

Required roles:

| Role | Description |
|---|---|
| ADMIN | Can see all branches and manage system |
| HQ | Can view multiple branches |
| SUPERVISOR | Can review and approve own branch documents |
| BRANCH_MANAGER | Similar to supervisor |
| STAFF | Can count documents in own branch |
| COUNTER | Same as staff |
| VIEWER | Read-only |

Prototype minimum:

- ADMIN
- SUPERVISOR
- STAFF
- VIEWER

## 5. Branch Permission

Prototype behavior:

- ADMIN sees all branches
- SUPERVISOR sees own branch
- STAFF sees own branch

Production behavior later:

- Every API must check branch permission server-side
- Prevent IDOR by checking document branch against user branch
- Frontend permission is not enough

## 6. Mock Users

Create at least these users:

```text
Admin
- role: ADMIN
- branches: all

BKK1 Supervisor
- role: SUPERVISOR
- branch: BKK1

BKK1 Staff
- role: STAFF
- branch: BKK1

BKK2 Staff
- role: STAFF
- branch: BKK2
```

## 7. Mock Branches

Create:

```text
BKK1 - กรุงเทพ 1
BKK2 - กรุงเทพ 2
CHM  - เชียงใหม่
SRB  - สระบุรี
```

## 8. Document Status

Use:

```text
IMPORTED
COUNTING
SUBMITTED
REVIEWING
RECOUNT_REQUESTED
APPROVED
COMPLETED
```

Meaning:

| Status | Meaning |
|---|---|
| IMPORTED | Imported from Express/mock but not started |
| COUNTING | Staff is counting |
| SUBMITTED | Staff submitted to supervisor |
| REVIEWING | Supervisor is reviewing |
| RECOUNT_REQUESTED | Supervisor asked for recount |
| APPROVED | Supervisor approved |
| COMPLETED | Process finished, cannot edit |

Prototype can implement only the necessary subset first.

## 9. Version Status

Use:

```text
DRAFT
SUBMITTED
RECOUNT
APPROVED
LOCKED
```

Rules:

- Version 1 is created when counting starts
- Submit locks current version
- Recount creates a new version
- Prototype may copy entries into new version
- Later production should use delta version + resolveEffectiveEntries

## 10. Mock Count Documents

Create at least 5 sample documents:

```text
CNT-BKK1-001 | today | BKK1 | IMPORTED
CNT-BKK1-002 | today | BKK1 | COUNTING
CNT-BKK1-003 | today | BKK1 | SUBMITTED
CNT-BKK2-001 | today | BKK2 | IMPORTED
CNT-CHM-001  | today | CHM  | COMPLETED
```

Behavior:

- STAFF BKK1 sees only BKK1 non-completed documents
- STAFF BKK2 sees only BKK2 non-completed documents
- ADMIN sees all
- SUPERVISOR BKK1 sees BKK1 submitted/recount documents

## 11. Product Lines

Each document should have 10-20 product lines.

Fields:

```text
lineId
lineNo
productCode
productName
productImageUrl
barcode
unitCaseName
unitPackName
unitPieceName
caseRatio
packRatio
allowCase
allowPack
allowPiece
expectedQty
```

Unit examples:

- Product A: case / pack / piece
- Product B: pack / piece
- Product C: piece only

If productImageUrl is missing, show No Image fallback.

## 12. Quantity Rules

Fields:

```text
qtyCase
qtyPack
qtyPiece
totalBaseQty
```

Formula:

```text
totalBaseQty =
  qtyCase * caseRatio +
  qtyPack * packRatio +
  qtyPiece
```

Rules:

- Show only available unit inputs
- Quantity must be integer
- Quantity must not be negative
- null = not counted yet
- 0 = counted but not found
- Do not default uncounted values to 0

## 13. expectedQty

`expectedQty` is the system quantity.

Prototype:

- STAFF should not see expectedQty in UI
- SUPERVISOR can see expectedQty

Production later:

- STAFF must not receive expectedQty from API at all

## 14. Tablet Pages

Create:

```text
/tablet/documents
/tablet/count/[documentId]
/tablet/count/[documentId]/summary
```

### Tablet Document List

Show cards with:

- document number
- document date
- branch
- status
- current version
- total lines
- counted lines
- open/start button

Filters:

- All
- Not started
- Counting
- Recount requested

### Tablet Count Page

Show one product card at a time.

Product card:

- product image
- product code
- product name
- barcode
- qty case input if allowed
- qty pack input if allowed
- qty piece input if allowed
- note
- save/sync status

Buttons:

- Previous
- Next
- Uncounted items
- Save
- Submit to supervisor

## 15. Auto Save Mock

API:

```text
PATCH /api/count-documents/:documentId/versions/:versionId/entries/:lineId
```

Payload:

```json
{
  "qtyCase": 1,
  "qtyPack": 2,
  "qtyPiece": 3,
  "note": "optional note",
  "baseRevision": 1,
  "clientMutationId": "optional-in-prototype"
}
```

Prototype behavior:

1. Get mock current user
2. Check basic branch permission
3. Check document is not completed
4. Check version is editable
5. Validate units
6. Calculate totalBaseQty
7. Upsert count entry into mock state
8. Increment revision
9. Create audit log via service
10. Return `{ status: "SAVED" }`

UI statuses:

- Saving...
- Saved
- Save failed
- Waiting sync
- Conflict, later

## 16. Submit Mock

API:

```text
POST /api/count-documents/:documentId/versions/:versionId/submit
```

Behavior:

1. Check user and permission
2. Change version status to SUBMITTED
3. Change document status to SUBMITTED
4. Create audit log
5. Return success

Prototype can skip strict offline sync validation for now.

Add TODO:

- Block submit if pending offline sync exists

## 17. Supervisor Pages

Create:

```text
/supervisor/documents
/supervisor/review/[documentId]
/supervisor/review/[documentId]/versions
```

### Supervisor Document List

Show documents with status:

- SUBMITTED
- RECOUNT_REQUESTED
- REVIEWING

Fields:

- document number
- branch
- latest version
- submitted by
- submitted time
- total lines
- note count
- review button

### Supervisor Review Page

Show table:

- product code
- product name
- expectedQty
- counted totalBaseQty
- difference
- note
- version
- checkbox for recount

Buttons:

- Approve and complete
- Request recount
- View audit log
- View version compare

## 18. Approve Mock

API:

```text
POST /api/supervisor/count-documents/:documentId/approve
```

Behavior:

1. Check user is supervisor/admin
2. Change document status to COMPLETED
3. Change version status to APPROVED
4. Create audit log
5. Return success

Add TODO:

- Create final snapshot on completion

## 19. Request Recount Mock

API:

```text
POST /api/supervisor/count-documents/:documentId/request-recount
```

Payload:

```json
{
  "baseVersionId": "ver_001",
  "items": [
    {
      "lineId": "line_001",
      "reason": "จำนวนผิดปกติ"
    }
  ]
}
```

Behavior:

1. Check supervisor permission
2. Create new version, such as V2
3. Link baseVersionId
4. Set document status to RECOUNT_REQUESTED
5. Store recount request items
6. Create audit log
7. Return new version

Prototype may copy prior entries into new version.

Add TODO:

- Implement delta version and resolveEffectiveEntries later

## 20. Audit Log Mock

Actions:

```text
LOGIN
OPEN_DOCUMENT
START_COUNT
AUTO_SAVE_COUNT
SUBMIT_TO_SUPERVISOR
CREATE_VERSION
REQUEST_RECOUNT
APPROVE_VERSION
COMPLETE_DOCUMENT
```

Prototype:

- Store in mock state
- Write through service
- Components must not write audit log directly

Production later:

- Make append-only
- Store userId, branchId, documentId, versionId, lineId, action, oldValue, newValue, ipAddress, userAgent, requestId, clientMutationId, createdAt

## 21. Offline Draft

Prototype:

- Optional
- Can be skipped at first

Later:

- Use Dexie.js / IndexedDB
- Store per userId, branchId, documentId, versionId, lineId
- Block submit if pending sync exists
- Use clientMutationId for idempotency

## 22. Express API Integration

Prototype:

- Do not connect real Express API yet
- Use mock sync / mock documents / mock products

Later:

- Server-side only
- Tablet must not call Express API directly
- Sync must be idempotent
- Re-sync must not overwrite documents that already started counting

## 23. API Routes

Implement mock APIs with production-like paths.

Auth:

```text
GET /api/me
POST /api/auth/mock-login
POST /api/auth/mock-logout
```

Count documents:

```text
GET  /api/count-documents
GET  /api/count-documents/:documentId
POST /api/count-documents/:documentId/start
```

Count entries:

```text
PATCH /api/count-documents/:documentId/versions/:versionId/entries/:lineId
POST  /api/count-documents/:documentId/versions/:versionId/entries/batch
```

Submit:

```text
POST /api/count-documents/:documentId/versions/:versionId/submit
```

Supervisor:

```text
GET  /api/supervisor/count-documents
GET  /api/supervisor/count-documents/:documentId/review
POST /api/supervisor/count-documents/:documentId/approve
POST /api/supervisor/count-documents/:documentId/request-recount
```

Version:

```text
GET /api/count-documents/:documentId/versions
GET /api/count-documents/:documentId/versions/:versionId
GET /api/count-documents/:documentId/versions/compare?from=1&to=2
```

Audit:

```text
GET /api/audit-logs?documentId=xxx
```

## 24. Suggested File Structure

```text
src/
  app/
    login/
    tablet/
      documents/
      count/[documentId]/
      count/[documentId]/summary/
    supervisor/
      documents/
      review/[documentId]/
      review/[documentId]/versions/
    admin/
      users/
      branches/
      audit-logs/
    api/
      count-documents/
      supervisor/
      audit-logs/
      auth/
      express/
      offline-sync/

  components/
    ProductCard.tsx
    QtyInput.tsx
    ProductImage.tsx
    DocumentStatusBadge.tsx
    SyncStatusBadge.tsx
    VersionCompareTable.tsx
    RecountRequestModal.tsx

  lib/
    mock-session.ts
    permissions.ts
    unit-converter.ts
    audit-log.ts
    data-source.ts

  mock/
    users.ts
    branches.ts
    count-documents.ts
    products.ts
    count-versions.ts
    count-entries.ts
    audit-logs.ts
    mock-db.ts

  services/
    count-document.service.ts
    count-version.service.ts
    count-entry.service.ts
    review.service.ts
    audit-log.service.ts
    mock-session.service.ts

  types/
    count.ts
    user.ts
    express.ts
    audit.ts
```

## 25. Prototype Build Order

Build in this order:

1. Types and enums
2. Mock data
3. Mock session
4. Mock login page
5. Tablet document list
6. Tablet count page
7. Start count API
8. Auto save API
9. Submit API
10. Supervisor document list
11. Supervisor review page
12. Approve API
13. Request recount API
14. Audit log API
15. Version compare mock
16. Optional offline draft

## 26. Production Hardening Later

Do later after UI/Flow is approved:

- Real Auth
- Strict server-side permission
- IDOR protection on every API
- STAFF API must not receive expectedQty
- Offline Draft with Dexie
- Block submit if sync is not complete
- clientMutationId
- Delta version
- resolveEffectiveEntries
- Final snapshot on completed
- Express sync safety
- Mutable mock state moved to dev DB
- Append-only audit log
- Export Excel/PDF
