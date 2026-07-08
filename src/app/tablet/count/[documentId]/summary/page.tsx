"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { DocumentStatusBadge } from "@/components/DocumentStatusBadge";
import {
  DocumentStatus,
  VersionStatus,
  type CountSummary,
} from "@/types/count";

export default function TabletSummaryPage() {
  const params = useParams<{ documentId: string }>();
  const router = useRouter();
  const documentId = params.documentId;

  const [summary, setSummary] = useState<CountSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSummary = useCallback(async () => {
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
      setSummary(data.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, [documentId, router]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

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
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <p className="text-slate-500">กำลังโหลดสรุป...</p>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-100">
        <p className="text-slate-500">ไม่พบเอกสาร</p>
        <Link href="/tablet/documents" className="text-blue-600">
          กลับรายการ
        </Link>
      </div>
    );
  }

  const { document } = summary;
  const isEditable =
    document.status === DocumentStatus.COUNTING &&
    document.version?.status === VersionStatus.DRAFT;
  const hasUncounted = summary.uncountedLines > 0;

  return (
    <div className="min-h-screen bg-slate-100 pb-24">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-4 shadow-sm sm:px-6">
        <div className="mx-auto max-w-4xl">
          <Link
            href={`/tablet/count/${documentId}`}
            className="text-sm text-blue-600 hover:underline"
          >
            ← กลับไปนับต่อ
          </Link>
          <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-lg font-bold text-slate-900 sm:text-xl">
                สรุปก่อนส่ง — {document.documentNo}
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                {document.branchCode} · เวอร์ชัน {document.currentVersionNo}
              </p>
            </div>
            <DocumentStatusBadge status={document.status} compact />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-4 sm:px-6 sm:py-6">
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-red-700">
            {error}
          </div>
        )}

        <section className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "ทั้งหมด", value: summary.totalLines },
            { label: "นับแล้ว", value: summary.countedLines },
            { label: "ยังไม่นับ", value: summary.uncountedLines },
            { label: "นับได้ 0", value: summary.zeroCountLines },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-xl border border-slate-200 bg-white p-4 text-center shadow-sm"
            >
              <p className="text-2xl font-bold text-slate-900">{item.value}</p>
              <p className="mt-1 text-sm text-slate-500">{item.label}</p>
            </div>
          ))}
        </section>

        {document.note && (
          <section className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            หมายเหตุเอกสาร: {document.note}
          </section>
        )}

        {hasUncounted && isEditable && (
          <section className="mb-4 rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-800">
            ยังมี {summary.uncountedLines} รายการที่ยังไม่นับ — สามารถส่งได้
            แต่ควรตรวจสอบก่อน
          </section>
        )}

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-medium">รหัส</th>
                  <th className="px-4 py-3 font-medium">ชื่อสินค้า</th>
                  <th className="px-4 py-3 font-medium text-right">นับได้</th>
                  <th className="px-4 py-3 font-medium text-center">สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {summary.lines.map((line) => (
                  <tr key={line.lineId} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {line.productCode}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {line.productName}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-700">
                      {line.totalBaseQty ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {!line.isCounted ? (
                        <span className="text-amber-600">ยังไม่นับ</span>
                      ) : line.isZeroCount ? (
                        <span className="text-slate-600">นับได้ 0</span>
                      ) : (
                        <span className="text-green-600">นับแล้ว</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Link
            href={`/tablet/count/${documentId}`}
            className="flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            แก้ไขการนับ
          </Link>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!isEditable || submitting}
            className="rounded-xl bg-green-600 px-4 py-3 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-40"
          >
            {submitting ? "กำลังส่ง..." : "ยืนยันส่งให้หัวหน้างาน"}
          </button>
        </div>
      </main>
    </div>
  );
}
