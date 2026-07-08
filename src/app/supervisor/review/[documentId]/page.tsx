"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AuditLogPanel } from "@/components/AuditLogPanel";
import { DocumentStatusBadge } from "@/components/DocumentStatusBadge";
import { RecountRequestModal } from "@/components/RecountRequestModal";
import { VersionCompareTable } from "@/components/VersionCompareTable";
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
  const [showVersions, setShowVersions] = useState(false);

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

  const { document, reviewLines, versions, auditLogs } = review;
  const canApprove = document.status === DocumentStatus.SUBMITTED;
  const canRecount =
    document.status === DocumentStatus.SUBMITTED ||
    document.status === DocumentStatus.REVIEWING;

  return (
    <div className="min-h-screen bg-slate-100 pb-8">
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="mx-auto max-w-6xl">
          <Link
            href="/supervisor/documents"
            className="text-sm text-blue-600 hover:underline"
          >
            ← กลับรายการ
          </Link>
          <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-bold text-slate-900">
                  {document.documentNo}
                </h1>
                <DocumentStatusBadge status={document.status} />
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
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setShowAuditLog((v) => !v)}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                {showAuditLog ? "ซ่อน Audit Log" : "ดู Audit Log"}
              </button>
              <button
                type="button"
                onClick={() => setShowVersions((v) => !v)}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                {showVersions ? "ซ่อนเวอร์ชัน" : "ดูเวอร์ชัน"}
              </button>
              <button
                type="button"
                onClick={() => setShowRecountModal(true)}
                disabled={!canRecount || actionLoading}
                className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-2 text-sm font-medium text-orange-700 hover:bg-orange-100 disabled:opacity-40"
              >
                ขอนับใหม่
              </button>
              <button
                type="button"
                onClick={handleApprove}
                disabled={!canApprove || actionLoading}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-40"
              >
                {actionLoading ? "กำลังดำเนินการ..." : "อนุมัติและปิดเอกสาร"}
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-6">
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-red-700">
            {error}
          </div>
        )}

        {showAuditLog && (
          <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-lg font-semibold text-slate-900">
              Audit Log
            </h2>
            <AuditLogPanel logs={auditLogs} />
          </section>
        )}

        {showVersions && (
          <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-lg font-semibold text-slate-900">
              เปรียบเทียบเวอร์ชัน
            </h2>
            <VersionCompareTable versions={versions} />
          </section>
        )}

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium">รหัส</th>
                <th className="px-4 py-3 font-medium">ชื่อสินค้า</th>
                <th className="px-4 py-3 font-medium text-right">คาดหวัง</th>
                <th className="px-4 py-3 font-medium text-right">นับได้</th>
                <th className="px-4 py-3 font-medium text-right">ต่าง</th>
                <th className="px-4 py-3 font-medium text-center">เวอร์ชัน</th>
                <th className="px-4 py-3 font-medium text-center">สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {reviewLines.map((line) => (
                <tr key={line.lineId} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {line.productCode}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{line.productName}</td>
                  <td className="px-4 py-3 text-right text-slate-700">
                    {line.expectedQty}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-700">
                    {line.totalBaseQty ?? "—"}
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-medium ${
                      line.difference === null
                        ? "text-slate-400"
                        : line.difference === 0
                          ? "text-green-600"
                          : line.difference > 0
                            ? "text-blue-600"
                            : "text-red-600"
                    }`}
                  >
                    {line.difference ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-center text-slate-600">
                    V{line.versionNo}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {line.isCounted ? (
                      <span className="text-green-600">นับแล้ว</span>
                    ) : (
                      <span className="text-amber-600">ยังไม่นับ</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
