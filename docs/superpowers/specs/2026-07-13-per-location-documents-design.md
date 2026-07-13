# Per-Location Count Documents

**Date:** 2026-07-13  
**Status:** Approved — implementing  
**Goal:** After staff multi-select Express warehouses, create **one CountDocument per location code** (not one per Hub).

## Decisions

| Topic | Choice |
|-------|--------|
| Split rule | **1 location = 1 document** |
| Store location | Add `CountDocument.locationCode` |
| Hub / central | Keep `hubId` / `isCentral` for access + badges |
| Old hub-bundled docs | No auto-migrate; new syncs create per-location docs |

## Behavior

- Select `2411` + `2412` + `24GA` → 3 documents  
- Select `24G1` + `24D1` → 2 HQ documents (still central, separate docs)  
- Document id: `doc_{branchId}_{yyyyMMdd}_loc_{locationCode}`  
- Document no: `CNT-{branch}-{hubOrHQ}-{location}-{yyyyMMdd}`  
- Unique: one doc per `(branchId, documentDate, locationCode)`

## Access

Unchanged: staff see documents for assigned hubs; HQ/Admin see hubs + central.
