# Express API Setup

StockCount Pro calls the Express/Pode API **server-side only** (Next.js Route Handlers).

## Auth flow

1. `POST {BASE_URL}/api/login`
   - Body: `{ "username": "...", "password": "..." }`
   - Response: `{ "success": true, "token": "...", "expire": "..." }`

2. `GET {BASE_URL}/api/stockcount/countdate/{yyyy-MM-dd}`
   - Header: `Authorization: Bearer {token}`
   - Response: `{ "success": true, "stockCountData": [...] }`

## Local configuration

Copy `.env.example` to `.env.local` and set:

```env
EXPRESS_API_BASE_URL=http://100.95.113.104:8080
EXPRESS_API_USERNAME=admin
EXPRESS_API_PASSWORD=your-password
```

Restart `npm run dev` after changing env.

## Prototype proxy endpoint

Admin only:

```text
GET /api/express/countdate/2026-03-11
GET /api/express/countdate/2026-03-11?summary=1
```

`summary=1` returns location counts only (no full product list).

## Field mapping (for future sync)

| Express | App |
|---------|-----|
| `LocationCode` | Branch code |
| `ProductCode` | `productCode` |
| `ProductName` | `productName` |
| `CaseQty` / `PieceQty` | `qtyCase` / `qtyPiece` |
| `CaseUnitFactor` | `caseRatio` |
| `TransactionValue` | `expectedQty` (supervisor only) |
| `CountDate` | `documentDate` |
