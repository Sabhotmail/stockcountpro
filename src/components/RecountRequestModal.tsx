"use client";

import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface RecountRequestModalProps {
  open: boolean;
  lineCount: number;
  onClose: () => void;
  onSubmit: (reason: string) => Promise<void>;
}

export function RecountRequestModal({
  open,
  lineCount,
  onClose,
  onSubmit,
}: RecountRequestModalProps) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);
    const trimmed = reason.trim();
    if (!trimmed) {
      setError("กรุณาระบุเหตุผลการขอนับใหม่");
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(trimmed);
      setReason("");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setSubmitting(false);
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && !submitting) {
      onClose();
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>ขอนับใหม่ทั้งเอกสาร</DialogTitle>
          <DialogDescription>
            จะเปิดให้นับใหม่ทั้ง {lineCount} รายการ โดยใช้ค่าที่ส่งมาในรอบก่อนเป็นจุดเริ่มต้น
            (แก้ไขได้)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="grid gap-2">
            <Label htmlFor="recount-reason">เหตุผล</Label>
            <textarea
              id="recount-reason"
              rows={3}
              className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="เช่น พบผลต่างหลายรายการ ต้องการทวนนับทั้งเอกสาร"
              disabled={submitting}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={submitting}
          >
            ยกเลิก
          </Button>
          <Button
            type="button"
            className="bg-orange-600 hover:bg-orange-700"
            onClick={() => void handleSubmit()}
            disabled={submitting}
          >
            {submitting ? "กำลังส่ง..." : "ยืนยันขอนับใหม่ทั้งเอกสาร"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
