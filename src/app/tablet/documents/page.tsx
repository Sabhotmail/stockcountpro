"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DocumentStatusBadge } from "@/components/DocumentStatusBadge";
import type { ExpressSyncBranchResult } from "@/services/express-sync.service";
import { DocumentStatus, type CountDocumentListItem } from "@/types/count";

type FilterKey = "all" | "not_started" | "counting" | "recount";

const filters: { key: FilterKey; label: string }[] = [
  { key: "all", label: "ทั้งหมด" },
  { key: "not_started", label: "ยังไม่เริ่ม" },
  { key: "counting", label: "กำลังนับ" },
  { key: "recount", label: "ขอนับใหม่" },
];

function todayKey(): string {
  return new Date().toISOString().split("T")[0];
}

export default function TabletDocumentsPage() {
  const router = useRouter();
  const [documents, setDocuments] = useState<CountDocumentListItem[]>([]);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [countDate, setCountDate] = useState(todayKey());
  const [syncing, setSyncing] = useState(false);
  const [startingId, setStartingId] = useState<string | null>(null);

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/count-documents");
      if (res.status === 401) {
        router.push("/login");
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

  const filtered = useMemo(() => {
    return documents.filter((doc) => {
      if (filter === "all") return true;
      if (filter === "not_started") return doc.status === DocumentStatus.IMPORTED;
      if (filter === "counting") return doc.status === DocumentStatus.COUNTING;
      if (filter === "recount")
        return doc.status === DocumentStatus.RECOUNT_REQUESTED;
      return true;
    });
  }, [documents, filter]);

  async function handleSync() {
    setSyncing(true);
    setError(null);
    setSyncMessage(null);

    try {
      const res = await fetch("/api/express/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ date: countDate }),
      });

      if (res.status === 401) {
        router.push("/login");
        return;
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Sync failed");

      const created = data.results.filter(
        (item: ExpressSyncBranchResult) => item.status === "created",
      ).length;
      const updated = data.results.filter(
        (item: ExpressSyncBranchResult) => item.status === "updated",
      ).length;
      const skipped = data.results.filter(
        (item: ExpressSyncBranchResult) => item.status === "skipped",
      ).length;

      setSyncMessage(
        `Sync สำเร็จ: สร้างใหม่ ${created}, อัปเดต ${updated}, ข้าม ${skipped}`,
      );
      await loadDocuments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  async function handleOpen(doc: CountDocumentListItem) {
    if (
      doc.status === DocumentStatus.IMPORTED ||
      doc.status === DocumentStatus.RECOUNT_REQUESTED
    ) {
      setStartingId(doc.id);
      try {
        const res = await fetch(`/api/count-documents/${doc.id}/start`, {
          method: "POST",
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error ?? "Cannot start document");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Start failed");
        setStartingId(null);
        return;
      }
      setStartingId(null);
    }
    router.push(`/tablet/count/${doc.id}`);
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">เอกสารนับสต็อก</h1>
            <p className="text-sm text-slate-500">Tablet — รายการเอกสาร</p>
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

      <main className="mx-auto max-w-5xl px-6 py-6">
        <div className="mb-6 rounded-2xl border border-blue-100 bg-blue-50 p-5">
          <h2 className="text-lg font-semibold text-slate-900">
            Sync ใบตรวจนับจาก Express
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            ดึงใบตรวจนับของสาขาที่คุณมีสิทธิ์เข้าถึง — เอกสารที่เริ่มนับแล้วจะไม่ถูกทับ
          </p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
              วันที่ตรวจนับ
              <input
                type="date"
                value={countDate}
                onChange={(event) => setCountDate(event.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-3 font-normal text-slate-900"
              />
            </label>
            <button
              type="button"
              onClick={handleSync}
              disabled={syncing || loading}
              className="rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {syncing ? "กำลัง Sync..." : "Sync จาก Express"}
            </button>
          </div>
        </div>

        {syncMessage && (
          <div className="mb-4 rounded-lg bg-green-50 px-4 py-3 text-green-700">
            {syncMessage}
          </div>
        )}

        <div className="mb-6 flex flex-wrap gap-2">
          {filters.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`rounded-full px-4 py-2 text-sm font-medium ${
                filter === f.key
                  ? "bg-blue-600 text-white"
                  : "bg-white text-slate-600 border border-slate-200"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {loading && (
          <p className="text-center text-slate-500 py-12">กำลังโหลด...</p>
        )}
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-red-700">
            {error}
          </div>
        )}

        <div className="grid gap-4">
          {filtered.map((doc) => (
            <div
              key={doc.id}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">
                    {doc.documentNo}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {doc.documentDate} · {doc.branchCode} {doc.branchName}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <DocumentStatusBadge status={doc.status} />
                    <span className="text-sm text-slate-600">
                      เวอร์ชัน {doc.currentVersionNo || "—"}
                    </span>
                    <span className="text-sm text-slate-600">
                      นับแล้ว {doc.countedLines}/{doc.totalLines} รายการ
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={startingId === doc.id}
                  onClick={() => handleOpen(doc)}
                  className="rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {startingId === doc.id
                    ? "กำลังเปิด..."
                    : doc.status === DocumentStatus.IMPORTED ||
                        doc.status === DocumentStatus.RECOUNT_REQUESTED
                      ? "เริ่มนับ"
                      : "เปิดเอกสาร"}
                </button>
              </div>
            </div>
          ))}

          {!loading && filtered.length === 0 && (
            <p className="py-12 text-center text-slate-500">ไม่มีเอกสาร</p>
          )}
        </div>
      </main>
    </div>
  );
}
