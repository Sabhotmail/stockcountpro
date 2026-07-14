"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { DocumentStatusBadge } from "@/components/DocumentStatusBadge";
import { CountDocumentSkeleton } from "@/components/loading/PageSkeletons";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isCountDocumentEditable } from "@/lib/permissions";
import { formatCountQtyCasePiece } from "@/lib/count-qty";
import { filterCountableLines } from "@/lib/line-filter";
import { cn } from "@/lib/utils";
import { type CountSummary, type CountSummaryLine } from "@/types/count";

function formatLineQty(line: CountSummaryLine): string {
  return formatCountQtyCasePiece({
    qtyCase: line.qtyCase,
    qtyPack: line.qtyPack,
    qtyPiece: line.qtyPiece,
    allowCase: line.allowCase,
    allowPack: line.allowPack,
    allowPiece: line.allowPiece,
    unitCaseName: line.unitCaseName,
    unitPackName: line.unitPackName,
    unitPieceName: line.unitPieceName,
    isCounted: line.isCounted,
  });
}

function SummaryLineRow({ line }: { line: CountSummaryLine }) {
  return (
    <tr
      className={cn(
        "border-b border-border/60",
        !line.isCounted && "bg-amber-50/30",
      )}
    >
      <td className="whitespace-nowrap px-3 py-2.5 font-medium tabular-nums">
        {line.productCode}
      </td>
      <td className="max-w-[20rem] px-3 py-2.5 text-foreground/90">
        {line.productName}
      </td>
      <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">
        {formatLineQty(line)}
      </td>
      <td className="whitespace-nowrap px-3 py-2.5 text-right">
        {!line.isCounted ? (
          <span className="text-amber-700">ยังไม่นับ</span>
        ) : line.isZeroCount ? (
          <span className="text-muted-foreground">นับได้ 0</span>
        ) : (
          <span className="text-emerald-700">นับแล้ว</span>
        )}
      </td>
    </tr>
  );
}

function SummaryLineCard({ line }: { line: CountSummaryLine }) {
  return (
    <div
      className={cn(
        "border-b border-border/70 px-1 py-3 last:border-b-0",
        !line.isCounted && "bg-amber-50/40",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium tabular-nums">{line.productCode}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {line.productName}
          </p>
        </div>
        {!line.isCounted ? (
          <span className="shrink-0 text-xs font-medium text-amber-700">
            ยังไม่นับ
          </span>
        ) : line.isZeroCount ? (
          <span className="shrink-0 text-xs text-muted-foreground">นับได้ 0</span>
        ) : (
          <span className="shrink-0 text-xs font-medium text-emerald-700">
            นับแล้ว
          </span>
        )}
      </div>
      <p className="mt-2 text-sm tabular-nums">
        <span className="text-muted-foreground">นับได้ </span>
        <span className="font-medium">{formatLineQty(line)}</span>
      </p>
    </div>
  );
}

export default function TabletSummaryPage() {
  const params = useParams<{ documentId: string }>();
  const router = useRouter();
  const documentId = params.documentId;

  const [summary, setSummary] = useState<CountSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [codeFilter, setCodeFilter] = useState("");
  const [nameFilter, setNameFilter] = useState("");
  const [showUncountedOnly, setShowUncountedOnly] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/count-documents/${documentId}/summary`);
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        if (!res.ok) throw new Error("Failed to load summary");
        const data = await res.json();
        if (!cancelled) setSummary(data.summary);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Load failed");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [documentId, router]);

  const filteredLines = useMemo(() => {
    if (!summary) return [];
    return filterCountableLines(summary.lines, {
      codeFilter,
      nameFilter,
      showUncountedOnly,
    });
  }, [summary, codeFilter, nameFilter, showUncountedOnly]);

  async function handleSubmit() {
    const versionId = summary?.document.currentVersionId;
    if (!versionId) return;

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/count-documents/${documentId}/versions/${versionId}/submit`,
        { method: "POST" },
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Submit failed");
      }
      router.push("/tablet/documents");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submit failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <CountDocumentSkeleton />;
  }

  if (!summary) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-muted/40">
        <p className="text-muted-foreground">ไม่พบเอกสาร</p>
        <Link
          href="/tablet/documents"
          className={buttonVariants({ variant: "link" })}
        >
          กลับรายการ
        </Link>
      </div>
    );
  }

  const { document } = summary;
  const isEditable = isCountDocumentEditable(
    document.status,
    document.version?.status,
  );
  const hasUncounted = summary.uncountedLines > 0;

  return (
    <div className="min-h-screen bg-muted/40 pb-28">
      <header className="sticky top-0 z-10 border-b bg-background px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-4 sm:px-6">
        <div className="mx-auto max-w-4xl">
          <Link
            href={`/tablet/count/${documentId}`}
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            ← กลับไปนับต่อ
          </Link>
          <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-lg font-bold tracking-tight sm:text-xl">
                สรุปก่อนส่ง — {document.documentNo}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {document.branchCode} · เวอร์ชัน {document.currentVersionNo}
              </p>
            </div>
            <DocumentStatusBadge status={document.status} compact />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-4 sm:px-6 sm:py-6">
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <section className="mb-5 flex flex-wrap items-end gap-x-8 gap-y-3 border-b border-border/70 pb-4">
          <div>
            <p className="text-[11px] font-medium tracking-wide text-muted-foreground">
              นับแล้ว
            </p>
            <p className="mt-0.5 text-2xl font-semibold tracking-tight tabular-nums">
              {summary.countedLines}
              <span className="text-base font-normal text-muted-foreground">
                /{summary.totalLines}
              </span>
            </p>
          </div>
          <div>
            <p className="text-[11px] font-medium tracking-wide text-muted-foreground">
              ยังไม่นับ
            </p>
            <p
              className={cn(
                "mt-0.5 text-2xl font-semibold tracking-tight tabular-nums",
                summary.uncountedLines > 0 ? "text-amber-700" : "text-foreground",
              )}
            >
              {summary.uncountedLines}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-medium tracking-wide text-muted-foreground">
              นับได้ 0
            </p>
            <p className="mt-0.5 text-2xl font-semibold tracking-tight tabular-nums">
              {summary.zeroCountLines}
            </p>
          </div>
        </section>

        {document.note && (
          <Alert className="mb-4 border-amber-200/80 bg-amber-50 text-amber-950">
            <AlertDescription>หมายเหตุ: {document.note}</AlertDescription>
          </Alert>
        )}

        {hasUncounted && isEditable && (
          <Alert className="mb-4 border-orange-200/80 bg-orange-50 text-orange-950">
            <AlertDescription>
              ยังมี {summary.uncountedLines} รายการที่ยังไม่นับ — ส่งได้
              แต่ควรตรวจสอบก่อน
            </AlertDescription>
          </Alert>
        )}

        <section className="mb-4 border-b border-border/70 pb-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="summary-code-filter">ค้นหารหัส</Label>
              <Input
                id="summary-code-filter"
                value={codeFilter}
                onChange={(e) => setCodeFilter(e.target.value)}
                placeholder="เช่น 101001"
                className="h-10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="summary-name-filter">ค้นหาชื่อ</Label>
              <Input
                id="summary-name-filter"
                value={nameFilter}
                onChange={(e) => setNameFilter(e.target.value)}
                placeholder="เช่น เจเล่"
                className="h-10"
              />
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground tabular-nums">
              แสดง {filteredLines.length} จาก {summary.lines.length} รายการ
            </p>
            <Button
              type="button"
              variant={showUncountedOnly ? "secondary" : "outline"}
              size="sm"
              className={
                showUncountedOnly
                  ? "bg-orange-100 text-orange-800 hover:bg-orange-100"
                  : undefined
              }
              onClick={() => setShowUncountedOnly((v) => !v)}
            >
              {showUncountedOnly ? "แสดงทั้งหมด" : "เฉพาะที่ยังไม่นับ"}
            </Button>
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="text-sm font-semibold tracking-tight">รายการสินค้า</h2>
            <p className="text-xs text-muted-foreground tabular-nums">
              {summary.lines.length} รายการ
            </p>
          </div>

          <div className="md:hidden">
            {filteredLines.map((line) => (
              <SummaryLineCard key={line.lineId} line={line} />
            ))}
            {filteredLines.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                ไม่พบรายการที่ตรงกับตัวกรอง
              </p>
            )}
          </div>

          <div className="hidden overflow-hidden rounded-lg border border-border/80 bg-background md:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[36rem] border-collapse text-sm">
                <thead>
                  <tr className="border-b text-left text-xs font-medium tracking-wide text-muted-foreground">
                    <th className="px-3 py-2.5 font-medium">รหัส</th>
                    <th className="px-3 py-2.5 font-medium">ชื่อสินค้า</th>
                    <th className="px-3 py-2.5 text-right font-medium">นับได้</th>
                    <th className="px-3 py-2.5 text-right font-medium">สถานะ</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLines.map((line) => (
                    <SummaryLineRow key={line.lineId} line={line} />
                  ))}
                </tbody>
              </table>
            </div>
            {filteredLines.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                ไม่พบรายการที่ตรงกับตัวกรอง
              </p>
            )}
          </div>
        </section>
      </main>

      <footer className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex max-w-4xl gap-2 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
          <Link
            href={`/tablet/count/${documentId}`}
            className={cn(
              buttonVariants({ variant: "outline", size: "lg" }),
              "min-h-11 flex-1",
            )}
          >
            แก้ไขการนับ
          </Link>
          <Button
            type="button"
            size="lg"
            className="min-h-11 flex-1 bg-emerald-600 hover:bg-emerald-700"
            onClick={handleSubmit}
            disabled={!isEditable || submitting}
          >
            {submitting ? "กำลังส่ง..." : "ยืนยันส่งให้หัวหน้างาน"}
          </Button>
        </div>
      </footer>
    </div>
  );
}
