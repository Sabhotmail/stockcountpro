"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AdminNav } from "@/components/AdminNav";
import type { ExpressSyncBranchResult } from "@/services/express-sync.service";

type PreviewResult = {
  date: string;
  expressLineCount: number;
  locationCount: number;
  locations: Array<{ branchCode: string; lineCount: number }>;
};

function todayKey(): string {
  return new Date().toISOString().split("T")[0];
}

export default function AdminExpressSyncPage() {
  const router = useRouter();
  const [countDate, setCountDate] = useState(todayKey());
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [syncResults, setSyncResults] = useState<ExpressSyncBranchResult[] | null>(
    null,
  );
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleUnauthorized = useCallback(
    async (res: Response) => {
      if (res.status === 401) {
        router.push("/login");
        return true;
      }
      if (res.status === 403) {
        router.push("/tablet/documents");
        return true;
      }
      return false;
    },
    [router],
  );

  const handlePreview = useCallback(async () => {
    setLoadingPreview(true);
    setError(null);
    setMessage(null);
    setSyncResults(null);

    try {
      const res = await fetch(
        `/api/admin/express/sync?date=${encodeURIComponent(countDate)}`,
      );
      if (await handleUnauthorized(res)) return;

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Preview failed");

      setPreview(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preview failed");
      setPreview(null);
    } finally {
      setLoadingPreview(false);
    }
  }, [countDate, handleUnauthorized]);

  async function handleSync() {
    setSyncing(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch("/api/admin/express/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ date: countDate }),
      });
      if (await handleUnauthorized(res)) return;

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Sync failed");

      setSyncResults(data.results);
      setPreview({
        date: data.date,
        expressLineCount: data.expressLineCount,
        locationCount: data.results.length,
        locations: data.results.map((item: ExpressSyncBranchResult) => ({
          branchCode: item.branchCode,
          lineCount: item.lineCount ?? 0,
        })),
      });

      const created = data.results.filter(
        (item: ExpressSyncBranchResult) => item.status === "created",
      ).length;
      const updated = data.results.filter(
        (item: ExpressSyncBranchResult) => item.status === "updated",
      ).length;
      const skipped = data.results.filter(
        (item: ExpressSyncBranchResult) => item.status === "skipped",
      ).length;

      setMessage(
        `Sync สำเร็จ: สร้างใหม่ ${created}, อัปเดต ${updated}, ข้าม ${skipped}`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  useEffect(() => {
    void handlePreview();
  }, [handlePreview]);

  return (
    <div className="min-h-screen bg-slate-100 pb-8">
      <header className="border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-lg font-bold text-slate-900 sm:text-2xl">
              Sync ใบตรวจนับจาก Express
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
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-600">
            ดึงข้อมูลใบตรวจนับจาก Express API ตามวันที่ แล้วสร้าง/อัปเดตเอกสารสถานะ
            IMPORTED ใน PostgreSQL เท่านั้น — เอกสารที่เริ่มนับแล้วจะไม่ถูกทับ
          </p>

          <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end">
            <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
              วันที่ตรวจนับ
              <input
                type="date"
                value={countDate}
                onChange={(event) => setCountDate(event.target.value)}
                className="rounded-xl border border-slate-200 px-4 py-3 font-normal text-slate-900"
              />
            </label>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handlePreview}
                disabled={loadingPreview || syncing}
                className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                {loadingPreview ? "กำลังโหลด..." : "ดูสรุปจาก Express"}
              </button>
              <button
                type="button"
                onClick={handleSync}
                disabled={syncing || loadingPreview}
                className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {syncing ? "กำลัง Sync..." : "Sync เข้าระบบ"}
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-red-700">
            {error}
          </div>
        )}

        {message && (
          <div className="mt-4 rounded-lg bg-green-50 px-4 py-3 text-green-700">
            {message}
          </div>
        )}

        {preview && (
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">
              สรุป Express — {preview.date}
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              รายการทั้งหมด {preview.expressLineCount} บรรทัด ·{" "}
              {preview.locationCount} สาขา
            </p>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[480px] text-left text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-4 py-3 font-medium">รหัสสาขา</th>
                    <th className="px-4 py-3 font-medium">จำนวนบรรทัด</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.locations.map((location) => (
                    <tr
                      key={location.branchCode}
                      className="border-t border-slate-100"
                    >
                      <td className="px-4 py-3 font-mono text-slate-900">
                        {location.branchCode}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {location.lineCount}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {syncResults && (
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">
              ผลการ Sync
            </h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-4 py-3 font-medium">สาขา</th>
                    <th className="px-4 py-3 font-medium">สถานะ</th>
                    <th className="px-4 py-3 font-medium">เลขเอกสาร</th>
                    <th className="px-4 py-3 font-medium">บรรทัด</th>
                    <th className="px-4 py-3 font-medium">หมายเหตุ</th>
                  </tr>
                </thead>
                <tbody>
                  {syncResults.map((item) => (
                    <tr
                      key={`${item.branchCode}-${item.documentId ?? item.reason}`}
                      className="border-t border-slate-100"
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">
                          {item.branchCode}
                        </div>
                        {item.branchName && (
                          <div className="text-xs text-slate-500">
                            {item.branchName}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-medium ${
                            item.status === "created"
                              ? "bg-green-100 text-green-700"
                              : item.status === "updated"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-700">
                        {item.documentNo ?? "-"}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {item.lineCount ?? "-"}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {item.reason ?? "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="mt-4 text-sm text-slate-500">
              Staff สามารถเห็นเอกสารที่ sync แล้วได้ที่{" "}
              <Link href="/tablet/documents" className="text-blue-600">
                หน้ารายการใบตรวจนับ (Tablet)
              </Link>
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
