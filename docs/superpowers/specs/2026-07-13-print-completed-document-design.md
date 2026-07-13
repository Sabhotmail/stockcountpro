# Print Completed Count Document

**Date:** 2026-07-13  
**Status:** Implemented  
**Goal:** Print a completed inventory count document (A4) with product list and handwritten signature lines.

## Decisions

| Topic | Choice |
|-------|--------|
| Method | Browser print page + `window.print()` |
| Status | **COMPLETED** only |
| Who | HQ/Admin + Supervisor (document access required) |
| Columns | ลำดับ, รหัสสินค้า, ชื่อสินค้า, จำนวนที่นับ (ชิ้นฐาน) |
| Entry | Admin ประวัติเอกสาร + after Supervisor Approve (and open print URL anytime if COMPLETED) |

## Signature block (exact labels)

```
ตรวจนับโดย_____________วันที่_________               ร่วมตรวจโดย_____________วันที่___________
       (พนักงานธุรการ)                                                            (พนักงานขายหน่วยรถ)

                                                                          อนุมัติโดย_________________วันที่___________
                                                                                        (ผู้อนุมัติผลตรวจสอบ)
```

## Header fields

Document no, date, location code/name, hub or HQ central, version, status.

## Routes

- Page: `/print/documents/[documentId]`
- API: `GET /api/count-documents/[documentId]/print`
- UI: “พิมพ์เอกสาร” on Admin document detail when COMPLETED; after Approve redirect/open print page.
