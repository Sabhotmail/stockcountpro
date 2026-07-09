"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { DocumentStatusBadge } from "@/components/DocumentStatusBadge";
import { formatDateTimeShortTH } from "@/lib/datetime";
import type { SupervisorDocumentListItem } from "@/types/count";

function DocumentCard({ doc }: { doc: SupervisorDocumentListItem }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-base font-semibold text-slate-900">{doc.documentNo}</p>
          <p className="mt-1 text-sm text-slate-500">
            {doc.branchCode} · {doc.branchName}
          </p>
        </div>
        <DocumentStatusBadge status={doc.status} compact />
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <div>
          <dt className="text-slate-500">เวอร์ชัน</dt>
          <dd className="font-medium text-slate-800">
            V{doc.currentVersionNo || "—"}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">รายการ</dt>
          <dd className="font-medium text-slate-800">
            {doc.countedLines}/{doc.totalLines}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">ส่งโดย</dt>
          <dd className="font-medium text-slate-800">
            {doc.submittedByName ?? "—"}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">หมายเหตุ</dt>
          <dd className="font-medium text-slate-800">
            {doc.hasDocumentNote ? "มี" : "—"}
          </dd>
        </div>
        <div className="col-span-2">
          <dt className="text-slate-500">ส่งเมื่อ</dt>
          <dd className="font-medium text-slate-800">
            {formatDateTimeShortTH(doc.submittedAt)}
          </dd>
        </div>
      </dl>

      <Link
        href={`/supervisor/review/${doc.id}`}
        className="mt-4 flex w-full items-center justify-center rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700"
      >
        ตรวจสอบ
      </Link>
    </div>
  );
}

export default function SupervisorDocumentsPage() {
  const router = useRouter();
  const [documents, setDocuments] = useState<SupervisorDocumentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/supervisor/count-documents");
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      if (res.status === 403) {
        router.push("/tablet/documents");
        return;
      }
      if (!res.ok) throw new Error("Failed to load documents");
      const data = await res.json();
      setDocuments(data.documents);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <div className="min-h-screen bg-slate-100 pb-8">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-4 shadow-sm sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-slate-900 sm:text-2xl">
              ตรวจสอบเอกสารนับสต็อก
            </h1>
            <p className="mt-0.5 text-sm text-slate-500">
              Supervisor — รายการรอตรวจ
            </p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="shrink-0 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            ออกจากระบบ
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-4 sm:px-6 sm:py-6">
        {loading && (
          <p className="py-12 text-center text-slate-500">กำลังโหลด...</p>
        )}
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-red-700">
            {error}
          </div>
        )}

        {!loading && documents.length === 0 && (
          <p className="py-12 text-center text-slate-500">ไม่มีเอกสารรอตรวจ</p>
        )}

        <div className="flex flex-col gap-3 md:hidden">
          {documents.map((doc) => (
            <DocumentCard key={doc.id} doc={doc} />
          ))}
        </div>

        <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm md:block">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium">เลขเอกสาร</th>
                <th className="px-4 py-3 font-medium">สาขา</th>
                <th className="px-4 py-3 font-medium">สถานะ</th>
                <th className="px-4 py-3 font-medium">เวอร์ชัน</th>
                <th className="px-4 py-3 font-medium">ส่งโดย</th>
                <th className="px-4 py-3 font-medium">ส่งเมื่อ</th>
                <th className="px-4 py-3 font-medium">รายการ</th>
                <th className="px-4 py-3 font-medium">หมายเหตุ</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => (
                <tr key={doc.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {doc.documentNo}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                    {doc.branchCode} {doc.branchName}
                  </td>
                  <td className="px-4 py-3">
                    <DocumentStatusBadge status={doc.status} compact />
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    V{doc.currentVersionNo || "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {doc.submittedByName ?? "—"}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-500">
                    {formatDateTimeShortTH(doc.submittedAt)}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {doc.countedLines}/{doc.totalLines}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {doc.hasDocumentNote ? "มี" : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/supervisor/review/${doc.id}`}
                      className="inline-flex min-w-[5.5rem] items-center justify-center whitespace-nowrap rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                    >
                      ตรวจสอบ
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
