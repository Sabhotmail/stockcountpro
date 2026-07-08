"use client";

import { useState } from "react";
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

  if (!open) return null;

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-bold text-slate-900">ขอนับใหม่</h2>
          <p className="mt-1 text-sm text-slate-500">
            เลือกรายการที่ต้องการให้พนักงานนับใหม่และระบุเหตุผล
          </p>
        </div>

        <div className="max-h-[50vh] overflow-y-auto px-6 py-4">
          {error && (
            <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-3">
            {lines.map((line) => (
              <div
                key={line.lineId}
                className="rounded-xl border border-slate-200 p-4"
              >
                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={Boolean(selected[line.lineId])}
                    onChange={(e) =>
                      setSelected((prev) => ({
                        ...prev,
                        [line.lineId]: e.target.checked,
                      }))
                    }
                    className="mt-1 h-4 w-4"
                  />
                  <div className="flex-1">
                    <p className="font-medium text-slate-900">
                      {line.productCode} — {line.productName}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      คาดหวัง {line.expectedQty} · นับได้{" "}
                      {line.totalBaseQty ?? "—"} · ต่าง{" "}
                      {line.difference ?? "—"}
                    </p>
                    {selected[line.lineId] && (
                      <input
                        type="text"
                        value={reasons[line.lineId] ?? ""}
                        onChange={(e) =>
                          setReasons((prev) => ({
                            ...prev,
                            [line.lineId]: e.target.value,
                          }))
                        }
                        placeholder="เหตุผล เช่น จำนวนผิดปกติ"
                        className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      />
                    )}
                  </div>
                </label>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
          >
            {submitting ? "กำลังส่ง..." : "ยืนยันขอนับใหม่"}
          </button>
        </div>
      </div>
    </div>
  );
}
