"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AuditLogPanel } from "@/components/AuditLogPanel";
import { DocumentStatusBadge } from "@/components/DocumentStatusBadge";
import { DetailSkeleton } from "@/components/loading/PageSkeletons";
import { PageShell } from "@/components/PageShell";
import { RecountRequestModal } from "@/components/RecountRequestModal";
import {
  ReviewLineCard,
  ReviewLineTable,
} from "@/components/ReviewLineList";
import { SupervisorNav } from "@/components/SupervisorNav";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
      router.push(
        `/supervisor/documents${qs ? `?${qs}` : ""}`,
      );
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

  const subtitle = `${document.branchCode} ${document.branchName} · เวอร์ชัน ${document.currentVersionNo} · นับแล้ว ${document.countedLines}/${document.totalLines}`;

  return (
    <PageShell
      title={document.documentNo}
      subtitle={subtitle}
      nav={
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href="/supervisor/documents"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            ← กลับหน้ารายการ Approve
          </Link>
          <SupervisorNav />
        </div>
      }
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <DocumentStatusBadge status={document.status} compact />
          {canPrint && (
            <Link
              href={`/print/documents/${documentId}`}
              className={buttonVariants({ size: "sm" })}
              target="_blank"
              rel="noreferrer"
            >
              พิมพ์เอกสาร
            </Link>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowAuditLog((v) => !v)}
          >
            {showAuditLog ? "ซ่อน Log" : "Audit Log"}
          </Button>
          <Link
            href={`/supervisor/review/${documentId}/versions`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            เปรียบเทียบเวอร์ชัน
          </Link>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100"
            onClick={() => setShowRecountModal(true)}
            disabled={!canRecount || actionLoading}
          >
            ขอนับใหม่
          </Button>
          <Button
            type="button"
            size="sm"
            className="bg-green-600 hover:bg-green-700"
            onClick={() => {
              setPushToExpress(false);
              setApproveOpen(true);
            }}
            disabled={!canApprove || actionLoading}
          >
            {actionLoading ? "กำลังดำเนินการ..." : "อนุมัติและปิดเอกสาร"}
          </Button>
        </div>
      }
    >
      {document.note && (
        <Alert className="mb-4 border-amber-200 bg-amber-50 text-amber-900">
          <AlertDescription>หมายเหตุเอกสาร: {document.note}</AlertDescription>
        </Alert>
      )}

      {isPostExpressRecount && (
        <Alert className="mb-4 border-orange-200 bg-orange-50 text-orange-900">
          <AlertDescription>
            เอกสารปิดแล้ว — ถ้าตรวจใน Express แล้วพบผลต่าง กด「ขอนับใหม่」ได้เลย
            ไม่ต้อง Sync จาก Express ใหม่ ระบบใช้รายการเดิมและค่าที่ส่งไปรอบก่อน
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

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
              className="bg-green-600 hover:bg-green-700"
              disabled={actionLoading}
              onClick={() => void confirmApprove()}
            >
              {actionLoading ? "กำลังดำเนินการ..." : "ยืนยันอนุมัติ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {showAuditLog && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Audit Log</CardTitle>
          </CardHeader>
          <CardContent>
            <AuditLogPanel logs={auditLogs} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            รายการสินค้า ({reviewLines.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 md:space-y-0 md:p-0">
          <div className="flex flex-col gap-3 md:hidden">
            {reviewLines.map((line) => (
              <ReviewLineCard key={line.lineId} line={line} />
            ))}
          </div>
          <div className="hidden md:block">
            <ReviewLineTable lines={reviewLines} />
          </div>
        </CardContent>
      </Card>

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
