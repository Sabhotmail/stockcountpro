"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AuditLogPanel } from "@/components/AuditLogPanel";
import { DocumentStatusBadge } from "@/components/DocumentStatusBadge";
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
import { cn } from "@/lib/utils";
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

  async function handleApprove() {
    if (!review) return;
    if (!confirm("ยืนยันอนุมัติและปิดเอกสารนี้?")) return;

    setActionLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/supervisor/count-documents/${documentId}/approve`,
        { method: "POST" },
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Approve failed");
      }
      router.push("/supervisor/documents");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Approve failed");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRequestRecount(
    items: { lineId: string; reason: string }[],
  ) {
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
          items,
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
        <p className="py-12 text-center text-muted-foreground">
          กำลังโหลดข้อมูลตรวจสอบ...
        </p>
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
  const canRecount =
    document.status === DocumentStatus.SUBMITTED ||
    document.status === DocumentStatus.REVIEWING;

  const subtitle = `${document.branchCode} ${document.branchName} · เวอร์ชัน ${document.currentVersionNo} · นับแล้ว ${document.countedLines}/${document.totalLines}`;

  return (
    <PageShell
      title={document.documentNo}
      subtitle={subtitle}
      nav={
        <div className="space-y-3">
          <Link
            href="/supervisor/documents"
            className={cn(buttonVariants({ variant: "link" }), "h-auto p-0")}
          >
            ← กลับรายการ
          </Link>
          <SupervisorNav />
        </div>
      }
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <DocumentStatusBadge status={document.status} compact />
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
            onClick={handleApprove}
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

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

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
        lines={reviewLines}
        onClose={() => setShowRecountModal(false)}
        onSubmit={handleRequestRecount}
      />
    </PageShell>
  );
}
