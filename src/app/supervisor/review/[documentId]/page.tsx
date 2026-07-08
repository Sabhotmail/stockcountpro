"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AuditLogPanel } from "@/components/AuditLogPanel";
import { DocumentStatusBadge } from "@/components/DocumentStatusBadge";
import { RecountRequestModal } from "@/components/RecountRequestModal";
import {
  ReviewLineCard,
  ReviewLineTable,
} from "@/components/ReviewLineList";
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

  const loadReview = useCallback(async () => {
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
      setReview(data.review);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, [documentId, router]);

  useEffect(() => {
    loadReview();
  }, [loadReview]);

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
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <p className="text-slate-500">กำลังโหลดข้อมูลตรวจสอบ...</p>
      </div>
    );
  }

  if (!review) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-100">
        <p className="text-slate-500">ไม่พบเอกสาร</p>
        <Link href="/supervisor/documents" className="text-blue-600">
          กลับรายการ
        </Link>
      </div>
    );
  }

  const { document, reviewLines, auditLogs } = review;
  const canApprove = document.status === DocumentStatus.SUBMITTED;
  const canRecount =
    document.status === DocumentStatus.SUBMITTED ||
    document.status === DocumentStatus.REVIEWING;

  const actionButtonClass =
    "rounded-xl px-4 py-3 text-sm font-medium transition sm:py-2";

  return (
    <div className="min-h-screen bg-slate-100 pb-8">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-4 shadow-sm sm:px-6">
        <div className="mx-auto max-w-6xl">
          <Link
            href="/supervisor/documents"
            className="text-sm text-blue-600 hover:underline"
          >
            ← กลับรายการ
          </Link>
          <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <h1 className="text-lg font-bold text-slate-900 sm:text-2xl">
                  {document.documentNo}
                </h1>
                <DocumentStatusBadge status={document.status} compact />
              </div>
              <p className="mt-1 text-sm text-slate-500">
                {document.branchCode} {document.branchName} · เวอร์ชัน{" "}
                {document.currentVersionNo} · นับแล้ว {document.countedLines}/
                {document.totalLines}
              </p>
              {document.note && (
                <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  หมายเหตุเอกสาร: {document.note}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap lg:justify-end">
              <button
                type="button"
                onClick={() => setShowAuditLog((v) => !v)}
                className={`${actionButtonClass} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50`}
              >
                {showAuditLog ? "ซ่อน Log" : "Audit Log"}
              </button>
              <Link
                href={`/supervisor/review/${documentId}/versions`}
                className={`${actionButtonClass} border border-slate-200 bg-white text-center text-slate-700 hover:bg-slate-50`}
              >
                เปรียบเทียบเวอร์ชัน
              </Link>
              <button
                type="button"
                onClick={() => setShowRecountModal(true)}
                disabled={!canRecount || actionLoading}
                className={`${actionButtonClass} border border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100 disabled:opacity-40`}
              >
                ขอนับใหม่
              </button>
              <button
                type="button"
                onClick={handleApprove}
                disabled={!canApprove || actionLoading}
                className={`${actionButtonClass} col-span-2 bg-green-600 font-semibold text-white hover:bg-green-700 disabled:opacity-40 sm:col-span-1`}
              >
                {actionLoading ? "กำลังดำเนินการ..." : "อนุมัติและปิดเอกสาร"}
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-4 sm:px-6 sm:py-6">
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-red-700">
            {error}
          </div>
        )}

        {showAuditLog && (
          <section className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:mb-6">
            <h2 className="mb-3 text-base font-semibold text-slate-900 sm:text-lg">
              Audit Log
            </h2>
            <AuditLogPanel logs={auditLogs} />
          </section>
        )}

        <section>
          <h2 className="mb-3 text-base font-semibold text-slate-900 sm:text-lg">
            รายการสินค้า ({reviewLines.length})
          </h2>

          <div className="flex flex-col gap-3 md:hidden">
            {reviewLines.map((line) => (
              <ReviewLineCard key={line.lineId} line={line} />
            ))}
          </div>

          <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:block">
            <ReviewLineTable lines={reviewLines} />
          </div>
        </section>
      </main>

      <RecountRequestModal
        open={showRecountModal}
        lines={reviewLines}
        onClose={() => setShowRecountModal(false)}
        onSubmit={handleRequestRecount}
      />
    </div>
  );
}
