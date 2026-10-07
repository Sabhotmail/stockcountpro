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
  submitting?: boolean;
  error?: string | null;
  onConfirm: (input: { reason: string; confirmDocumentNo: string }) => void;
  onCancel: () => void;
}

export function ResetDocumentDialog({
  open,
  documentNo,
  submitting = false,
  error = null,
  onConfirm,
  onCancel,
}: ResetDocumentDialogProps) {
  const [reason, setReason] = useState("");
  const [confirmDocumentNo, setConfirmDocumentNo] = useState("");

  useEffect(() => {
    if (open) {
      setReason("");
      setConfirmDocumentNo("");
    }
  }, [open]);

  const canSubmit =
    reason.trim().length > 0 &&
    confirmDocumentNo.trim() === documentNo &&
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
            เอกสาร {documentNo} จะกลับเป็นสถานะยังไม่เริ่ม
            เพื่อให้ Sync จาก Express ได้อีกครั้ง
          </DialogDescription>
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
            <Label htmlFor="reset-confirm-no">
              พิมพ์รหัสเอกสารเพื่อยืนยัน: {documentNo}
            </Label>
            <Input
              id="reset-confirm-no"
              value={confirmDocumentNo}
              disabled={submitting}
              onChange={(event) => setConfirmDocumentNo(event.target.value)}
              autoComplete="off"
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
                confirmDocumentNo: confirmDocumentNo.trim(),
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
