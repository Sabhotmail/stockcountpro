"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface CountQtyConfirmDialogProps {
  open: boolean;
  productCode: string;
  productName: string;
  fieldLabel: string;
  value: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export function CountQtyConfirmDialog({
  open,
  productCode,
  productName,
  fieldLabel,
  value,
  onConfirm,
  onCancel,
}: CountQtyConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onCancel();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>ยืนยันบันทึกจำนวน</DialogTitle>
          <DialogDescription>
            คุณต้องการบันทึกจำนวน{" "}
            <span className="font-semibold text-foreground">{value}</span> (
            {fieldLabel}) สำหรับสินค้า{" "}
            <span className="font-semibold text-foreground">{productCode}</span>{" "}
            {productName} ใช่หรือไม่?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={onCancel}>
            ยกเลิก
          </Button>
          <Button type="button" onClick={onConfirm}>
            ยืนยัน
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
