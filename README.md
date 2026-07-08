# Cursor Inventory Count Files

ไฟล์ชุดนี้สำหรับวางในโปรเจกต์ Next.js เพื่อให้ Cursor อ่านก่อนเริ่มสร้างระบบตรวจนับสินค้า

## วิธีใช้

1. แตกไฟล์ zip นี้
2. Copy โฟลเดอร์/ไฟล์ทั้งหมดไปไว้ที่ root ของโปรเจกต์ Next.js
3. เปิด Cursor
4. พิมพ์ใน Cursor Chat:

```text
อ่าน .cursor/rules/inventory-count-system.mdc และ docs/INVENTORY_COUNT_PRD.md แล้วเริ่มทำตาม docs/CURSOR_START_PROMPT.md
```

## ไฟล์ที่มี

```text
.cursor/rules/inventory-count-system.mdc
docs/INVENTORY_COUNT_PRD.md
docs/CURSOR_START_PROMPT.md
docs/PRODUCTION_HARDENING_TODO.md
AGENTS.md
```

## โหมดปัจจุบัน

Prototype / Mock-first

เป้าหมายคือเห็นหน้าเว็บและ Flow ก่อน ยังไม่ต้องทำ Production เต็มรูปแบบ
