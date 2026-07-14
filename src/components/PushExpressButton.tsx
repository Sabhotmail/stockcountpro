"use client";

import { useState, type MouseEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type DialogPhase = "closed" | "confirm" | "pushing" | "success" | "error";

type SuccessPayload = {
  message: string;
  lineCount: number;
  locationCode: string;
  userIdSent: string;
  countDate?: string;
  expressResponse: unknown;
  expressRequest?: unknown;
};

function formatExpressResponse(value: unknown): string {
  if (value == null) return "(ไม่มี body จาก Express)";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function PushExpressButton({
  documentId,
  className,
  fullWidth,
  variant = "outline",
  size = "sm",
  label,
  pendingLabel = "กำลังส่ง...",
  alreadyPushed = false,
  onPushed,
}: {
  documentId: string;
  className?: string;
  fullWidth?: boolean;
  variant?: "default" | "outline" | "secondary";
  size?: "default" | "sm" | "lg";
  label?: string;
  pendingLabel?: string;
  alreadyPushed?: boolean;
  onPushed?: (message: string) => void;
}) {
  const [phase, setPhase] = useState<DialogPhase>("closed");
  const [success, setSuccess] = useState<SuccessPayload | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const buttonLabel =
    label ?? (alreadyPushed ? "ส่งซ้ำ" : "ส่ง Express");
  const open = phase !== "closed";

  function openConfirm(event: MouseEvent) {
    event.stopPropagation();
    setSuccess(null);
    setErrorMessage(null);
    setPhase("confirm");
  }

  async function executePush() {
    setPhase("pushing");
    setSuccess(null);
    setErrorMessage(null);

    try {
      const res = await fetch(
        `/api/count-documents/${documentId}/push-express`,
        {
          method: "POST",
          credentials: "same-origin",
        },
      );
      const data = (await res.json()) as {
        error?: string;
        lineCount?: number;
        locationCode?: string;
        userIdSent?: string;
        countDate?: string;
        expressResponse?: unknown;
        expressRequest?: unknown;
      };

      if (!res.ok) {
        setErrorMessage(data.error ?? "ส่งกลับ Express ไม่สำเร็จ");
        setPhase("error");
        return;
      }

      const message = `ส่งกลับ Express สำเร็จ · ${data.lineCount ?? 0} รายการ · คลัง ${data.locationCode ?? "—"} · UserID ${data.userIdSent ?? "—"}`;
      onPushed?.(message);
      setSuccess({
        message,
        lineCount: data.lineCount ?? 0,
        locationCode: data.locationCode ?? "—",
        userIdSent: data.userIdSent ?? "—",
        countDate: data.countDate,
        expressResponse: data.expressResponse,
        expressRequest: data.expressRequest,
      });
      setPhase("success");
    } catch {
      setErrorMessage("ส่งกลับ Express ไม่สำเร็จ");
      setPhase("error");
    }
  }

  return (
    <>
      <Button
        type="button"
        variant={alreadyPushed ? "secondary" : variant}
        size={size}
        disabled={phase === "pushing"}
        className={cn(fullWidth && "w-full", "shrink-0", className)}
        onClick={openConfirm}
      >
        {phase === "pushing" ? pendingLabel : buttonLabel}
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next && phase !== "pushing") setPhase("closed");
        }}
      >
        <DialogContent
          className="sm:max-w-lg"
          onClick={(event) => event.stopPropagation()}
        >
          {phase === "confirm" && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {alreadyPushed
                    ? "ส่งผลการนับกลับ Express อีกครั้ง?"
                    : "ส่งผลการนับกลับ Express"}
                </DialogTitle>
                <DialogDescription>
                  จะส่งเฉพาะรายการที่นับแล้วของเอกสารนี้ ไปอัปเดตใน Express
                </DialogDescription>
              </DialogHeader>

              <div className="rounded-lg border bg-muted/40 px-3 py-2.5 text-sm text-muted-foreground">
                กดยืนยันเมื่อพร้อม — สามารถส่งซ้ำได้ภายหลัง
              </div>

              <DialogFooter className="gap-2 sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setPhase("closed")}
                >
                  ยกเลิก
                </Button>
                <Button type="button" onClick={() => void executePush()}>
                  ยืนยันส่ง Express
                </Button>
              </DialogFooter>
            </>
          )}

          {phase === "pushing" && (
            <>
              <DialogHeader>
                <DialogTitle>กำลังส่งไป Express…</DialogTitle>
                <DialogDescription>
                  กรุณารอสักครู่ อย่าปิดหน้าต่างนี้
                </DialogDescription>
              </DialogHeader>
              <div className="flex items-center gap-3 rounded-lg border bg-muted/40 px-4 py-6">
                <span className="inline-block size-5 animate-spin rounded-full border-2 border-foreground/30 border-t-foreground" />
                <p className="text-sm text-muted-foreground">
                  กำลังอัปเดตผลการนับใน Express
                </p>
              </div>
            </>
          )}

          {phase === "success" && success && (
            <>
              <DialogHeader>
                <DialogTitle className="text-emerald-700 dark:text-emerald-400">
                  ส่ง Express สำเร็จ
                </DialogTitle>
                <DialogDescription>
                  ระบบบันทึกการส่งแล้ว และได้รับ response จาก Express ตามด้านล่าง
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3">
                <dl className="grid grid-cols-2 gap-2 rounded-lg border border-emerald-200 bg-emerald-50/80 px-3 py-2.5 text-sm dark:border-emerald-900 dark:bg-emerald-950/40">
                  <div>
                    <dt className="text-xs text-muted-foreground">คลัง</dt>
                    <dd className="font-medium">{success.locationCode}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">รายการ</dt>
                    <dd className="font-medium">{success.lineCount}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">UserID</dt>
                    <dd className="font-medium">{success.userIdSent}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">วันที่นับ</dt>
                    <dd className="font-medium">{success.countDate ?? "—"}</dd>
                  </div>
                </dl>

                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">
                    Request ที่ส่งไป Express
                  </p>
                  <pre className="max-h-64 overflow-auto rounded-lg border bg-muted/50 p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap break-all">
                    {formatExpressResponse(success.expressRequest)}
                  </pre>
                </div>

                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">
                    Response จาก Express
                  </p>
                  <pre className="max-h-64 overflow-auto rounded-lg border bg-muted/50 p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap break-all">
                    {formatExpressResponse(success.expressResponse)}
                  </pre>
                </div>
              </div>

              <DialogFooter>
                <Button type="button" onClick={() => setPhase("closed")}>
                  ปิด
                </Button>
              </DialogFooter>
            </>
          )}

          {phase === "error" && (
            <>
              <DialogHeader>
                <DialogTitle className="text-destructive">
                  ส่ง Express ไม่สำเร็จ
                </DialogTitle>
                <DialogDescription>
                  ตรวจสอบข้อความด้านล่าง แล้วลองใหม่อีกครั้งได้
                </DialogDescription>
              </DialogHeader>

              <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
                {errorMessage}
              </div>

              <DialogFooter className="gap-2 sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setPhase("closed")}
                >
                  ปิด
                </Button>
                <Button type="button" onClick={() => void executePush()}>
                  ลองอีกครั้ง
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
