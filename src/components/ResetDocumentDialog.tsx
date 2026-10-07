"use client";

import { useEffect, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ResetDocumentDialogProps {
  open: boolean;
  documentNo: string;
  /** Short code to type (usually location code). */
  confirmCode: string;
  submitting?: boolean;
  error?: string | null;
  onConfirm: (input: { reason: string; confirmCode: string }) => void;
  onCancel: () => void;
}

export function ResetDocumentDialog({
  open,
  documentNo,
  confirmCode,
  submitting = false,
  error = null,
  onConfirm,
  onCancel,
}: ResetDocumentDialogProps) {
  const [reason, setReason] = useState("");
  const [typedCode, setTypedCode] = useState("");

  useEffect(() => {
    if (open) {
      setReason("");
      setTypedCode("");
    }
  }, [open]);

  const canSubmit =
    reason.trim().length > 0 &&
    typedCode.trim() === confirmCode &&
    !submitting;

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !submitting) onCancel();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>รีเซ็ตเอกสาร?</DialogTitle>
          <DialogDescription>
            เอกสารนี้จะกลับเป็นสถานะยังไม่เริ่ม เพื่อให้ Sync จาก Express ได้อีกครั้ง
          </DialogDescription>
          <p className="break-words text-sm font-medium text-foreground">
            {documentNo}
          </p>
        </DialogHeader>

        <Alert variant="destructive">
          <AlertDescription>
            จำนวนที่นับไว้ทั้งหมดจะถูกลบ และไม่สามารถกู้คืนได้
          </AlertDescription>
        </Alert>

        <div className="space-y-4 py-1">
          <div className="space-y-2">
            <Label htmlFor="reset-reason">เหตุผล (บังคับ)</Label>
            <textarea
              id="reset-reason"
              className="min-h-20 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              value={reason}
              disabled={submitting}
              onChange={(event) => setReason(event.target.value)}
              placeholder="เช่น Express ส่งรายการสินค้าผิด"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reset-confirm-code">
              พิมพ์รหัสคลังเพื่อยืนยัน:{" "}
              <span className="font-semibold text-foreground">{confirmCode}</span>
            </Label>
            <Input
              id="reset-confirm-code"
              value={typedCode}
              disabled={submitting}
              onChange={(event) => setTypedCode(event.target.value)}
              autoComplete="off"
              placeholder={confirmCode}
            />
          </div>
          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : null}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            disabled={submitting}
            onClick={onCancel}
          >
            ยกเลิก
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={!canSubmit}
            onClick={() =>
              onConfirm({
                reason: reason.trim(),
                confirmCode: typedCode.trim(),
              })
            }
          >
            {submitting ? "กำลังรีเซ็ต..." : "ยืนยันรีเซ็ต"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
