"use client";

import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { formatExpectedQtyForSupervisor } from "@/lib/express-expected-qty";
import type { ReviewLineItem } from "@/types/count";

interface RecountRequestModalProps {
  open: boolean;
  lines: ReviewLineItem[];
  onClose: () => void;
  onSubmit: (items: { lineId: string; reason: string }[]) => Promise<void>;
}

export function RecountRequestModal({
  open,
  lines,
  onClose,
  onSubmit,
}: RecountRequestModalProps) {
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedLines = lines.filter((line) => selected[line.lineId]);

  async function handleSubmit() {
    setError(null);
    const items = selectedLines.map((line) => ({
      lineId: line.lineId,
      reason: reasons[line.lineId]?.trim() ?? "",
    }));

    if (items.length === 0) {
      setError("กรุณาเลือกอย่างน้อย 1 รายการ");
      return;
    }

    if (items.some((item) => !item.reason)) {
      setError("กรุณาระบุเหตุผลสำหรับทุกรายการที่เลือก");
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(items);
      setSelected({});
      setReasons({});
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
      <DialogContent className="flex max-h-[90vh] max-w-3xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>ขอนับใหม่</DialogTitle>
          <DialogDescription>
            เลือกรายการที่ต้องการให้พนักงานนับใหม่และระบุเหตุผล
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[50vh] overflow-y-auto px-6 py-4">
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col gap-3">
            {lines.map((line) => (
              <Card key={line.lineId}>
                <CardContent className="pt-6">
                  <Label className="flex items-start gap-3 font-normal">
                    <input
                      type="checkbox"
                      checked={Boolean(selected[line.lineId])}
                      onChange={(e) =>
                        setSelected((prev) => ({
                          ...prev,
                          [line.lineId]: e.target.checked,
                        }))
                      }
                      className="mt-1 h-4 w-4 rounded border-input"
                    />
                    <div className="flex-1 space-y-2">
                      <p className="font-medium">
                        {line.productCode} — {line.productName}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        คาดหวัง {formatExpectedQtyForSupervisor(line.expectedQty)} · นับได้{" "}
                        {line.totalBaseQty ?? "—"} · ต่าง{" "}
                        {line.difference ?? "—"}
                      </p>
                      {selected[line.lineId] && (
                        <Input
                          value={reasons[line.lineId] ?? ""}
                          onChange={(e) =>
                            setReasons((prev) => ({
                              ...prev,
                              [line.lineId]: e.target.value,
                            }))
                          }
                          placeholder="เหตุผล เช่น จำนวนผิดปกติ"
                        />
                      )}
                    </div>
                  </Label>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <DialogFooter className="border-t px-6 py-4">
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
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? "กำลังส่ง..." : "ยืนยันขอนับใหม่"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
