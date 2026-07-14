"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AuditLogPanel } from "@/components/AuditLogPanel";
import { DocumentStatusBadge } from "@/components/DocumentStatusBadge";
import { DetailSkeleton } from "@/components/loading/PageSkeletons";
import { PageShell } from "@/components/PageShell";
import { RecountRequestModal } from "@/components/RecountRequestModal";
import {
  ReviewLineCard,
  ReviewLineTable,
} from "@/components/ReviewLineList";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { canRequestRecount } from "@/lib/permissions";
import { filterCountableLines } from "@/lib/line-filter";
import { DocumentStatus, type ReviewDetail } from "@/types/count";

export default function SupervisorReviewPage() {
  const params = useParams<{ documentId: string }>();
  const router = useRouter();
  const documentId = params.documentId;

  const [review, setReview] = useState<ReviewDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [showRecountModal, setShowRecountModal] = useState(false);
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);
  const [pushToExpress, setPushToExpress] = useState(false);
  const [codeFilter, setCodeFilter] = useState("");
  const [nameFilter, setNameFilter] = useState("");
  const [showUncountedOnly, setShowUncountedOnly] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/supervisor/count-documents/${documentId}/review`,
        );
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error ?? "Failed to load review");
        }
        const data = await res.json();
        if (!cancelled) setReview(data.review);
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
    if (!review) return [];
    return filterCountableLines(review.reviewLines, {
      codeFilter,
      nameFilter,
      showUncountedOnly,
    });
  }, [review, codeFilter, nameFilter, showUncountedOnly]);

  async function confirmApprove() {
    if (!review) return;

    setApproveOpen(false);
    setActionLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/supervisor/count-documents/${documentId}/approve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pushToExpress }),
        },
      );
      const data = (await res.json()) as {
        error?: string;
        expressPush?: { ok: boolean; error?: string; lineCount?: number };
      };
      if (!res.ok) {
        throw new Error(data.error ?? "Approve failed");
      }

      const params = new URLSearchParams();
      if (pushToExpress && data.expressPush?.ok === false) {
        params.set(
          "expressPushError",
          data.expressPush.error ?? "ส่ง Express ไม่สำเร็จ",
        );
      } else if (pushToExpress && data.expressPush?.ok) {
        params.set("expressPushOk", "1");
      }
      const qs = params.toString();
      router.push(`/supervisor/documents${qs ? `?${qs}` : ""}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Approve failed");
    } finally {
      setActionLoading(false);
      setPushToExpress(false);
    }
  }

  async function handleRequestRecount(reason: string) {
    if (!review?.document.version) {
      throw new Error("Version not found");
    }

    const res = await fetch(
      `/api/supervisor/count-documents/${documentId}/request-recount`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseVersionId: review.document.version.id,
          reason,
        }),
      },
    );

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error ?? "Request recount failed");
    }

    router.push("/supervisor/documents");
  }

  if (loading) {
    return (
      <PageShell title="กำลังโหลด..." subtitle="ข้อมูลตรวจสอบ">
        <DetailSkeleton />
      </PageShell>
    );
  }

  if (!review) {
    return (
      <PageShell title="ไม่พบเอกสาร">
        <div className="flex flex-col items-center gap-4 py-12">
          <p className="text-muted-foreground">ไม่พบเอกสาร</p>
          <Link
            href="/supervisor/documents"
            className={buttonVariants({ variant: "link" })}
          >
            กลับรายการ
          </Link>
        </div>
      </PageShell>
    );
  }

  const { document, reviewLines, auditLogs } = review;
  const canApprove = document.status === DocumentStatus.SUBMITTED;
  const canRecount = canRequestRecount(document.status);
  const canPrint = document.status === DocumentStatus.COMPLETED;
  const isPostExpressRecount =
    document.status === DocumentStatus.COMPLETED;
  const counted = document.countedLines ?? 0;
  const total = document.totalLines ?? reviewLines.length;
  const uncounted = Math.max(total - counted, 0);

  return (
    <PageShell
      title={document.documentNo}
      brand={null}
      subtitle={`${document.branchCode} ${document.branchName} · เวอร์ชัน ${document.currentVersionNo}`}
      actions={<DocumentStatusBadge status={document.status} compact />}
      nav={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link
            href="/supervisor/documents"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            ← รายการรออนุมัติ
          </Link>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <button
              type="button"
              className="text-muted-foreground transition-colors hover:text-foreground"
              onClick={() => setShowAuditLog((v) => !v)}
            >
              {showAuditLog ? "ซ่อนประวัติ" : "ประวัติการทำงาน"}
            </button>
            <Link
              href={`/supervisor/review/${documentId}/versions`}
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              เปรียบเทียบเวอร์ชัน
            </Link>
            {canPrint && (
              <Link
                href={`/print/documents/${documentId}`}
                target="_blank"
                rel="noreferrer"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                พิมพ์
              </Link>
            )}
          </div>
        </div>
      }
    >
      <div className="pb-28">
        {document.note && (
          <Alert className="mb-4 border-amber-200/80 bg-amber-50 text-amber-950">
            <AlertDescription>หมายเหตุ: {document.note}</AlertDescription>
          </Alert>
        )}

        {isPostExpressRecount && (
          <Alert className="mb-4 border-orange-200/80 bg-orange-50 text-orange-950">
            <AlertDescription>
              เอกสารปิดแล้ว — พบผลต่างใน Express กด「ขอนับใหม่」ได้โดยไม่ต้อง Sync
              ใหม่
            </AlertDescription>
          </Alert>
        )}

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
              {counted}
              <span className="text-base font-normal text-muted-foreground">
                /{total}
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
                uncounted > 0 ? "text-amber-700" : "text-foreground",
              )}
            >
              {uncounted}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-medium tracking-wide text-muted-foreground">
              สถานที่
            </p>
            <p className="mt-1 text-sm font-medium">
              {document.locationName ?? document.locationCode ?? "—"}
            </p>
          </div>
        </section>

        <Dialog
          open={approveOpen}
          onOpenChange={(open) => {
            if (!actionLoading) setApproveOpen(open);
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>อนุมัติและปิดเอกสาร</DialogTitle>
              <DialogDescription>
                เอกสารจะเปลี่ยนเป็นสถานะเสร็จสิ้น และพิมพ์ได้ทันที
              </DialogDescription>
            </DialogHeader>

            <label className="flex cursor-pointer items-start gap-3 rounded-lg border bg-muted/40 px-3 py-2.5 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 size-4"
                checked={pushToExpress}
                onChange={(e) => setPushToExpress(e.target.checked)}
              />
              <span>
                <span className="font-medium">ส่ง Express ด้วย</span>
                <span className="mt-0.5 block text-muted-foreground">
                  ถ้าส่งไม่สำเร็จ เอกสารยังอนุมัติได้ — ส่งมือทีหลังได้จากแท็บเสร็จสิ้น
                </span>
              </span>
            </label>

            <DialogFooter className="gap-2 sm:justify-end">
              <Button
                type="button"
                variant="outline"
                disabled={actionLoading}
                onClick={() => setApproveOpen(false)}
              >
                ยกเลิก
              </Button>
              <Button
                type="button"
                className="bg-emerald-600 hover:bg-emerald-700"
                disabled={actionLoading}
                onClick={() => void confirmApprove()}
              >
                {actionLoading ? "กำลังดำเนินการ..." : "ยืนยันอนุมัติ"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {showAuditLog && (
          <section className="mb-6 border-b border-border/70 pb-5">
            <h2 className="mb-3 text-sm font-semibold tracking-tight">
              ประวัติการทำงาน
            </h2>
            <AuditLogPanel logs={auditLogs} />
          </section>
        )}

        <section>
          <div className="mb-4 border-b border-border/70 pb-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="review-code-filter">ค้นหารหัส</Label>
                <Input
                  id="review-code-filter"
                  value={codeFilter}
                  onChange={(e) => setCodeFilter(e.target.value)}
                  placeholder="เช่น 101001"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="review-name-filter">ค้นหาชื่อ</Label>
                <Input
                  id="review-name-filter"
                  value={nameFilter}
                  onChange={(e) => setNameFilter(e.target.value)}
                  placeholder="เช่น เจเล่"
                />
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground tabular-nums">
                แสดง {filteredLines.length} จาก {reviewLines.length} รายการ
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
          </div>

          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="text-sm font-semibold tracking-tight">รายการสินค้า</h2>
            <p className="text-xs text-muted-foreground tabular-nums">
              {reviewLines.length} รายการ
            </p>
          </div>

          <div className="md:hidden">
            {filteredLines.map((line) => (
              <ReviewLineCard key={line.lineId} line={line} />
            ))}
            {filteredLines.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                ไม่พบรายการที่ตรงกับตัวกรอง
              </p>
            )}
          </div>
          <div className="hidden overflow-hidden rounded-lg border border-border/80 bg-background md:block">
            <ReviewLineTable lines={filteredLines} />
            {filteredLines.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                ไม่พบรายการที่ตรงกับตัวกรอง
              </p>
            )}
          </div>
        </section>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-end gap-2 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
          <Button
            type="button"
            variant="outline"
            className="border-orange-200 text-orange-800 hover:bg-orange-50"
            onClick={() => setShowRecountModal(true)}
            disabled={!canRecount || actionLoading}
          >
            ขอนับใหม่
          </Button>
          <Button
            type="button"
            className="min-w-[10rem] bg-emerald-600 hover:bg-emerald-700"
            onClick={() => {
              setPushToExpress(false);
              setApproveOpen(true);
            }}
            disabled={!canApprove || actionLoading}
          >
            {actionLoading ? "กำลังดำเนินการ..." : "อนุมัติและปิดเอกสาร"}
          </Button>
        </div>
      </div>

      <RecountRequestModal
        open={showRecountModal}
        lineCount={reviewLines.length}
        completedDocument={isPostExpressRecount}
        onClose={() => setShowRecountModal(false)}
        onSubmit={handleRequestRecount}
      />
    </PageShell>
  );
}
