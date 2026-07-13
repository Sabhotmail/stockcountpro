# HQ Document History (Admin)

**Date:** 2026-07-13  
**Status:** Implemented  
**Goal:** Let **HQ / Admin** find any count document quickly and understand **what happened** (timeline + version compare) without raw IDs or jumping into Approve workflows.

## Decisions

| Topic | Choice |
|-------|--------|
| Approach | **B** — Admin document browser is primary; Audit Log is secondary/system-wide |
| Roles | **HQ + Admin** |
| Supervisor Approve | Unchanged |
| Detail page | **Read-only**, stays under `/admin/documents/...` |
| Visual style | Match existing Admin app (table desktop / cards mobile); minimal chrome |

## UX principles (revised)

1. **One primary job:** หาเอกสาร → เปิดดูประวัติ  
2. **Human search only:** เลขเอกสาร / คลัง / วันที่ — ไม่บังคับ `documentId`  
3. **Stay in Admin:** อย่าส่งไปหน้า Supervisor ที่มีปุ่ม Approve/ขอนับใหม่  
4. **Scan in seconds:** แถวคลิกได้ทั้งแถว; สถานะเป็น badge; เรียงวันที่ล่าสุดก่อน  
5. **Answer “ทำไมนับใหม่?” first:** ถ้ามี recount ให้โชว์เหตุผลด้านบนรายละเอียด

## Out of scope

- Staff tablet history  
- Mutating counts from Admin  
- Redesign of Supervisor Approve UI  

---

## 1. Admin → เอกสาร (`/admin/documents`) — primary

### Toolbar (หนึ่งแถว ใช้งานง่าย)

| Control | Behavior |
|---------|----------|
| **ค้นหา** (ช่องเดียว) | ค้นใน `documentNo`, `locationCode`, `locationName` พร้อมกัน |
| **วันที่** | `documentDate` (วันเดียว; default ว่าง = ทุกวัน) |
| **สถานะ** | Select: ทั้งหมด / แต่ละสถานะ |
| ล้างตัวกรอง | ปุ่ม outline |

ไม่แยกช่องเลขเอกสาร / คลัง / ชื่อคลัง — ลดความสับสน

### List

- Desktop: **ตาราง** (แบบ Supervisor) — คลิกทั้งแถวหรือปุ่ม **ดูประวัติ**  
- Mobile: การ์ดสั้น + ปุ่มเดียว **ดูประวัติ**  
- Sort: `documentDate` ใหม่ → เก่า, แล้วตาม `documentNo`  
- แสดง: เลขเอกสาร, วันที่, คลัง, Hub/HQ, สถานะ, Vn, นับแล้ว/ทั้งหมด  
- Empty state: “ไม่พบเอกสารตามเงื่อนไข” + แนะนำล้างตัวกรอง  

### Detail (`/admin/documents/[documentId]`)

Header: เลขเอกสาร · คลัง · วันที่ · status · Vn  

**บล็อกบน (ถ้ามี):** เหตุผลขอนับใหม่ล่าสุด (จาก recount / audit `REQUEST_RECOUNT`) — อ่านแล้วรู้ทันที  

**แท็บ 2 อัน (ไม่ใช่หลายการ์ดซ้อน):**

| Tab | Content |
|-----|---------|
| **ประวัติการทำงาน** | `AuditLogPanel` ของเอกสารนี้ (default tab) |
| **เปรียบเทียบเวอร์ชัน** | embed/reuse `VersionCompareTable` + compare controls **ในหน้า Admin** (ไม่ลิงก์ออกไป Supervisor) |

Actions: เฉพาะ **กลับรายการ** — ไม่มี Approve / ขอนับใหม่ / ลบ  

---

## 2. Admin → Audit Log (`/admin/audit-logs`) — secondary

บทบาท: ดู log ระดับระบบ / ข้ามหลายเอกสาร  

### Search (ทำให้สั้นลง)

| Control | Behavior |
|---------|----------|
| **ค้นหา** (ช่องเดียว) | จับคู่ `documentNo` หรือ `locationCode` → ดึง logs ของเอกสารที่ match |
| **วันที่เอกสาร** | optional |
| **ขั้นสูง** (collapsed) | `documentId` สำหรับ debug |

ปุ่ม: ค้นหา · ล้าง · ลิงก์ข้อความ “หาจากรายการเอกสาร →” ไป `/admin/documents`

ผลลัพธ์: ตาราง log เดิม; ถ้า match หลายเอกสาร แสดงได้สูงสุด ~500 รายการ + ข้อความเตือน  

---

## 3. APIs

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/admin/count-documents` | `q`, `documentDate`, `status` |
| GET | `/api/admin/count-documents/[documentId]` | meta + audit logs + latest recount reason |
| GET | `/api/admin/count-documents/[documentId]/versions` | list (หรือ reuse existing versions API ถ้า HQ เข้าได้แล้ว) |
| GET | `/api/admin/count-documents/[documentId]/versions/compare` | compare (หรือ reuse) |
| GET | `/api/admin/audit-logs` | `q`, `documentDate`, optional `documentId` |

---

## 4. Navigation

`AdminNav`: เพิ่ม **เอกสาร** ใกล้ **Audit Log**  
Label ชัด: **เอกสาร** = ประวัติเอกสารนับสต็อก  

---

## 5. Acceptance (UX)

1. HQ หาเอกสารด้วยคำว่า `2411` หรือเลขเอกสารในช่องเดียว แล้วเปิดดูประวัติได้  
2. หน้ารายละเอียดไม่ออกจาก Admin และไม่มีปุ่มอนุมัติ  
3. มี recount แล้วเห็นเหตุผลทันทีโดยไม่ต้องไล่ตาราง log  
4. Audit Log ค้นโดยไม่ต้องรู้ `documentId`  
5. Supervisor Approve เหมือนเดิม  

---

## UX self-check

- [x] งานหลักเหลือหนึ่งเส้นทาง (เอกสาร → รายละเอียด)  
- [x] ไม่พาไปหน้าที่มีปุ่มอันตราย (Approve)  
- [x] ลดช่องกรองที่ซ้ำซ้อน  
- [x] ตอบคำถาม “ทำไมนับใหม่” ก่อน  
- [x] ไม่เพิ่ม dashboard การ์ดเกินจำเป็น  
