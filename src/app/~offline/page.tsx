"use client";

import { WifiOffIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function OfflinePage() {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-muted/40 px-4 py-8 text-center">
      <div className="mx-auto flex w-full max-w-md flex-col items-center gap-6">
        <div className="flex size-16 items-center justify-center rounded-2xl bg-muted">
          <WifiOffIcon className="size-8 text-muted-foreground" aria-hidden />
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
            StockCount Pro
          </p>
          <h1 className="text-2xl font-bold tracking-tight">ไม่มีการเชื่อมต่อ</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            แอปต้องการการเชื่อมต่อเครือข่ายสำหรับเข้าสู่ระบบ ล็อกรายการ
            บันทึกอัตโนมัติ ตรวจสอบ ปริ้น และส่งข้อมูลไป Express
            การนับสต็อกแบบออฟไลน์ยังไม่รองรับ
          </p>
        </div>

        <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
          <Button
            type="button"
            className="min-h-11 bg-green-600 hover:bg-green-700"
            onClick={() => window.location.reload()}
          >
            ลองอีกครั้ง
          </Button>
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={() => {
              window.location.href = "/login";
            }}
          >
            กลับไปหน้าเข้าสู่ระบบ
          </Button>
        </div>
      </div>
    </div>
  );
}
