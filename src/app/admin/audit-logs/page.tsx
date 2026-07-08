"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AdminNav } from "@/components/AdminNav";
import { AuditLogPanel } from "@/components/AuditLogPanel";
import type { AuditLog } from "@/types/audit";

export default function AdminAuditLogsPage() {
  const router = useRouter();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [documentId, setDocumentId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadLogs = useCallback(
    async (filterDocumentId?: string) => {
      setLoading(true);
      setError(null);
      try {
        const query = filterDocumentId
          ? `?documentId=${encodeURIComponent(filterDocumentId)}`
          : "";
        const res = await fetch(`/api/admin/audit-logs${query}`);
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        if (res.status === 403) {
          router.push("/tablet/documents");
          return;
        }
        if (!res.ok) throw new Error("Failed to load audit logs");
        const data = await res.json();
        setLogs(data.logs);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Load failed");
      } finally {
        setLoading(false);
      }
    },
    [router],
  );

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  function handleFilter(e: React.FormEvent) {
    e.preventDefault();
    loadLogs(documentId.trim() || undefined);
  }

  return (
    <div className="min-h-screen bg-slate-100 pb-8">
      <header className="border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-lg font-bold text-slate-900 sm:text-2xl">
              Audit Log
            </h1>
            <button
              type="button"
              onClick={handleLogout}
              className="text-sm text-slate-500 hover:text-slate-700"
            >
              ออกจากระบบ
            </button>
          </div>
          <div className="mt-4">
            <AdminNav />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-4 sm:px-6 sm:py-6">
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-red-700">
            {error}
          </div>
        )}

        <form
          onSubmit={handleFilter}
          className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
        >
          <label className="flex min-w-[200px] flex-1 flex-col gap-1 text-sm">
            <span className="font-medium text-slate-600">กรองตาม Document ID</span>
            <input
              type="text"
              value={documentId}
              onChange={(e) => setDocumentId(e.target.value)}
              placeholder="เช่น doc_bkk1_001"
              className="rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
          <button
            type="submit"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            กรอง
          </button>
          <button
            type="button"
            onClick={() => {
              setDocumentId("");
              loadLogs();
            }}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            แสดงทั้งหมด
          </button>
        </form>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          {loading ? (
            <p className="text-slate-500">กำลังโหลด...</p>
          ) : (
            <>
              <p className="mb-3 text-sm text-slate-500">
                แสดง {logs.length} รายการ
              </p>
              <AuditLogPanel logs={logs} />
            </>
          )}
        </section>

        <p className="mt-4 text-sm text-slate-500">
          <Link href="/admin/users" className="text-blue-600">
            กลับหน้าผู้ใช้
          </Link>
        </p>
      </main>
    </div>
  );
}
