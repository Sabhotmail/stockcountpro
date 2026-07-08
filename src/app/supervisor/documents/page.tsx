"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { DocumentStatusBadge } from "@/components/DocumentStatusBadge";
import type { SupervisorDocumentListItem } from "@/types/count";

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
    await fetch("/api/auth/login", { method: "DELETE" });
    router.push("/login");
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              ตรวจสอบเอกสารนับสต็อก
            </h1>
            <p className="text-sm text-slate-500">Supervisor — รายการรอตรวจ</p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            ออกจากระบบ
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-6">
        {loading && (
          <p className="py-12 text-center text-slate-500">กำลังโหลด...</p>
        )}
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-red-700">
            {error}
          </div>
        )}

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
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
                  <td className="px-4 py-3 font-semibold text-slate-900">
                    {doc.documentNo}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {doc.branchCode} {doc.branchName}
                  </td>
                  <td className="px-4 py-3">
                    <DocumentStatusBadge status={doc.status} />
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    V{doc.currentVersionNo || "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {doc.submittedByName ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {doc.submittedAt
                      ? new Date(doc.submittedAt).toLocaleString("th-TH")
                      : "—"}
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
                      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                    >
                      ตรวจสอบ
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {!loading && documents.length === 0 && (
            <p className="py-12 text-center text-slate-500">
              ไม่มีเอกสารรอตรวจ
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
