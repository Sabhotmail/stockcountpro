# Cursor Start Prompt

ให้อ่านไฟล์เหล่านี้ก่อนเริ่มเขียนโค้ด:

- `.cursor/rules/inventory-count-system.mdc`
- `docs/INVENTORY_COUNT_PRD.md`
- `docs/PRODUCTION_HARDENING_TODO.md`

ตอนนี้ให้ทำแบบ Prototype / Mock-first ก่อน เพราะ Express API จริงยังไม่พร้อม

เป้าหมายรอบแรก:

1. สร้าง Types และ Enum หลัก
2. สร้าง Mock Users / Branches / Documents / Product Lines
3. สร้าง Mock Login
4. สร้างหน้า `/tablet/documents`
5. สร้างหน้า `/tablet/count/[documentId]`
6. สร้าง Mock API:
   - `GET /api/count-documents`
   - `GET /api/count-documents/:documentId`
   - `POST /api/count-documents/:documentId/start`
   - `PATCH /api/count-documents/:documentId/versions/:versionId/entries/:lineId`
   - `POST /api/count-documents/:documentId/versions/:versionId/submit`
7. สร้างหน้า `/supervisor/documents`
8. สร้างหน้า `/supervisor/review/[documentId]`
9. สร้าง Mock API:
   - `GET /api/supervisor/count-documents`
   - `GET /api/supervisor/count-documents/:documentId/review`
   - `POST /api/supervisor/count-documents/:documentId/approve`
   - `POST /api/supervisor/count-documents/:documentId/request-recount`
10. สร้าง Audit Log mock ผ่าน service

แนวทาง:

- ยังไม่ต้องทำ Production Security เต็มรูปแบบ
- ยังไม่ต้องต่อ Express API จริง
- ยังไม่ต้องทำ Offline Draft เต็มรูปแบบ
- ยังไม่ต้องใช้ Prisma ถ้ายังไม่จำเป็น
- ใช้ mock data ก่อน
- ห้าม hardcode mock data ใน component
- แยก business logic ไว้ใน services
- ทำ UI ให้ใช้งานง่ายบน Tablet
- STAFF ไม่ต้องเห็น expectedQty บน UI
- SUPERVISOR เห็น expectedQty ได้
- null = ยังไม่นับ
- 0 = นับแล้วแต่ไม่พบสินค้า

เริ่มจากสร้างโครงสร้างไฟล์และโค้ดรอบแรกให้หน้าเว็บเปิดดู Flow ได้ก่อน
