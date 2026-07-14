"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type BulkItemResult =
  | { documentId: string; status: "pushed"; lineCount?: number; locationCode?: string }
  | { documentId: string; status: "skipped"; reason?: string; error?: string }
  | { documentId: string; status: "failed"; error: string };

type BulkResponse = {
  summary: {
    requested: number;
    pushed: number;
    skipped: number;
    failed: number;
  };
  results: BulkItemResult[];
  error?: string;
};

const SKIP_LABEL: Record<string, string> = {
  already_pushed: "ส่งแล้วก่อนหน้า",
  not_completed: "ยังไม่เสร็จสิ้น",
  access_denied: "ไม่มีสิทธิ์",
  not_found: "ไม่พบเอกสาร",
};

export function BulkPushExpressToolbar({
  selectedIds,
  eligibleCount,
  onSelectAllEligible,
  onClearSelection,
  onComplete,
  labels,
}: {
  selectedIds: string[];
  eligibleCount: number;
  onSelectAllEligible: () => void;
  onClearSelection: () => void;
  onComplete: (pushedIds: string[]) => void;
  labels?: Record<string, string>;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [resultOpen, setResultOpen] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [bulkResult, setBulkResult] = useState<BulkResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedCount = selectedIds.length;
  const disabled = selectedCount === 0 || pushing;

  async function runBulk() {
    setConfirmOpen(false);
    setPushing(true);
    setError(null);
    try {
      const res = await fetch("/api/count-documents/push-express-bulk", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentIds: selectedIds }),
      });
      const data = (await res.json()) as BulkResponse;
      if (!res.ok) {
        setError(data.error ?? "ส่ง Express แบบชุดไม่สำเร็จ");
        setResultOpen(true);
        return;
      }
      setBulkResult(data);
      setResultOpen(true);
      const pushedIds = data.results
        .filter((r) => r.status === "pushed")
        .map((r) => r.documentId);
      onComplete(pushedIds);
    } catch {
      setError("ส่ง Express แบบชุดไม่สำเร็จ");
      setResultOpen(true);
    } finally {
      setPushing(false);
    }
  }

  const resultLines = useMemo(() => {
    if (!bulkResult) return [];
    return bulkResult.results.map((item) => {
      const name = labels?.[item.documentId] ?? item.documentId;
      if (item.status === "pushed") {
        return `✓ ${name} · ${item.lineCount ?? 0} รายการ · ${item.locationCode ?? ""}`;
      }
      if (item.status === "skipped") {
        return `– ${name} · ข้าม (${SKIP_LABEL[item.reason ?? ""] ?? item.reason ?? "skipped"})`;
      }
      return `✗ ${name} · ${item.error}`;
    });
  }, [bulkResult, labels]);

  if (eligibleCount === 0) return null;

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onSelectAllEligible}
          disabled={pushing}
        >
          เลือกที่ยังไม่ส่ง ({eligibleCount})
        </Button>
        {selectedCount > 0 && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={onClearSelection}
            disabled={pushing}
          >
            ล้างการเลือก
          </Button>
        )}
        <div className="flex-1" />
        <Button
          type="button"
          size="sm"
          disabled={disabled}
          onClick={() => setConfirmOpen(true)}
        >
          {pushing
            ? "กำลังส่ง..."
            : `ส่ง Express ที่เลือก (${selectedCount})`}
        </Button>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>ส่ง Express แบบชุด</DialogTitle>
            <DialogDescription>
              จะส่งเฉพาะเอกสารที่ยังไม่เคยส่งสำเร็จ · เลือกไว้ {selectedCount}{" "}
              รายการ
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmOpen(false)}
            >
              ยกเลิก
            </Button>
            <Button type="button" onClick={() => void runBulk()}>
              ยืนยันส่ง
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={resultOpen} onOpenChange={setResultOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>ผลการส่ง Express แบบชุด</DialogTitle>
            <DialogDescription>
              {error
                ? error
                : bulkResult
                  ? `สำเร็จ ${bulkResult.summary.pushed} · ข้าม ${bulkResult.summary.skipped} · ล้มเหลว ${bulkResult.summary.failed}`
                  : "—"}
            </DialogDescription>
          </DialogHeader>
          {resultLines.length > 0 && (
            <ul className="max-h-64 space-y-1 overflow-auto rounded-lg border bg-muted/40 p-3 text-xs">
              {resultLines.map((line) => (
                <li key={line} className="font-mono leading-relaxed">
                  {line}
                </li>
              ))}
            </ul>
          )}
          <DialogFooter>
            <Button type="button" onClick={() => setResultOpen(false)}>
              ปิด
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
