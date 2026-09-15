# Changelog

## 1.0.6 — 2026-09-15

### Added

- สคริปต์ NSSM ติดตั้งบริการห้อง Test (`StockCountPro-Test` พอร์ต 3001) และห้อง NKR (`StockCountPro-NKR` พอร์ต 3002)
- เปิด Windows Firewall inbound TCP 3001 และ 3002 (`scripts\open-firewall-rooms.bat` และตอนติดตั้ง NSSM)

## 1.0.5 — 2026-09-15

### Added

- ห้องสาขาชั่วคราว NKR แยกทั้งชุด: พอร์ต 3002 / Express 8082 / ฐาน `stockcountpro_nkr`
- แถบสีฟ้า “สาขาชั่วคราว · NKR — ข้อมูลนี้ไม่ใช่ของจริง” และชื่อแท็บ `NKR · StockCount Pro`
- คุกกี้ `stockcount_session_nkr` คนละชื่อของจริงและ Test
- ปฏิเสธการสตาร์ทถ้าห้อง NKR ชี้ฐานหรือ Express ของห้องอื่น (หรือกลับกัน)
- ไฟล์ตัวอย่าง `.env.nkr.example` และคำสั่ง `npm run start:nkr`, `dev:nkr`, `db:create:nkr`, `db:deploy:nkr`, `db:bootstrap-admin:nkr`

## 1.0.4 — 2026-09-02

### Added

- แยกห้อง Test กับของจริงบนเครื่องเดียวกัน: ของจริงพอร์ต 3000 / Express 8080 / ฐาน `stockcountpro`, ห้อง Test พอร์ต 3001 / Express 8081 / ฐาน `stockcountpro_test`
- ห้อง Test แสดงแถบสีส้ม “ห้องทดสอบ — ข้อมูลนี้ไม่ใช่ของจริง” และชื่อแท็บ `TEST · StockCount Pro`
- คุกกี้เข้าสู่ระบบคนละชื่อกันของจริง กันล็อกอินห้องหนึ่งทับอีกห้องบน IP เดียวกัน
- ปฏิเสธการสตาร์ทถ้าห้อง Test ชี้ฐานหรือ Express ของจริง (หรือกลับกัน)
- ไฟล์ตัวอย่าง `.env.test.example` และคำสั่ง `npm run start:test`, `dev:test`, `db:create:test`, `db:deploy:test`, `db:bootstrap-admin:test`

## 1.0.3 — 2026-08-28

### Added

- หน้าแอดมิน “ผู้ที่กำลังใช้งาน” แสดงคนที่ขยับในระบบช่วง 5 นาทีล่าสุด พร้อมหน้าที่อยู่และเอกสารนับถ้ามี

### Fixed

- Prisma client หลังเพิ่มโมเดล `UserPresence` ไม่ค้างเวอร์ชันเก่าใน `next dev` (แก้ 500 `userPresence.deleteMany`)

## 1.0.2 — 2026-08-28

### Added

- หน้านับแท็บเล็ตกรองสินค้าได้ 3 แบบ: ทั้งหมด / ยังไม่นับ / นับแล้ว

## 1.0.1 — 2026-08-28

### Changed

- หน้านับใช้ line lock เฉพาะเมื่อมีคนอื่นอยู่ในเอกสารใบเดียวกัน คนเดียวไม่จองรายการ
- หน้า login จัดกึ่งกลาง จอเข้ม ปุ่มชัดขึ้น ข้อความผิดพลาดเป็นภาษาไทย

### Fixed

- Prisma client หลังเพิ่มโมเดลใหม่ไม่ค้างเวอร์ชันเก่าใน `next dev` (แก้ 500 `countDocumentPresence.upsert`)

## 1.0.0 — 2026-08-27

รุ่นพร้อมใช้งานจริง

### Added

- สคริปต์เคลียร์ข้อมูลนับสต็อก `npm run db:clear-operational` โดยเก็บ User และ master data ไว้
- ส่ง Express ครบทุก SKU ในเอกสาร รายการที่ยังไม่นับถูกส่งเป็น 0
- แสดงเลขเวอร์ชันแอปบนหน้าเว็บ

### Fixed

- Session ต่ออายุอัตโนมัติตอนยังใช้งาน เพื่อไม่ให้แท็บเล็ต / Firefox เด้งกลับหน้า login กลางงาน
- Cookie มี `Expires` คู่กับ `Max-Age` ให้เบราว์เซอร์เก่ารักษา session ได้ดีขึ้น
- โพลล์หน้านับไม่พาไป login เมื่อได้ 401 ชั่วคราว
