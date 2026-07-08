"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { VersionCompareDetail } from "@/components/VersionCompareDetail";
import { VersionCompareTable } from "@/components/VersionCompareTable";
import type { CountVersion, VersionCompareResult } from "@/types/count";

export default function SupervisorVersionsPage() {
  const params = useParams<{ documentId: string }>();
  const router = useRouter();
  const documentId = params.documentId;

  const [versions, setVersions] = useState<CountVersion[]>([]);
  const [fromVersion, setFromVersion] = useState<number | null>(null);
  const [toVersion, setToVersion] = useState<number | null>(null);
  const [compare, setCompare] = useState<VersionCompareResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [comparing, setComparing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadVersions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/count-documents/${documentId}/versions`);
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      if (!res.ok) throw new Error("Failed to load versions");
      const data = await res.json();
      const list = data.versions as CountVersion[];
      setVersions(list);
      if (list.length >= 2) {
        setFromVersion(list[list.length - 2].versionNo);
        setToVersion(list[list.length - 1].versionNo);
      } else if (list.length === 1) {
        setFromVersion(list[0].versionNo);
        setToVersion(list[0].versionNo);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, [documentId, router]);

  useEffect(() => {
    loadVersions();
  }, [loadVersions]);

  const canCompare = useMemo(
    () =>
      fromVersion !== null &&
      toVersion !== null &&
      fromVersion !== toVersion,
    [fromVersion, toVersion],
  );

  async function handleCompare() {
    if (!canCompare || fromVersion === null || toVersion === null) return;

    setComparing(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/count-documents/${documentId}/versions/compare?from=${fromVersion}&to=${toVersion}`,
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Compare failed");
      }
      const data = await res.json();
      setCompare(data.compare);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Compare failed");
    } finally {
      setComparing(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <p className="text-slate-500">กำลังโหลดเวอร์ชัน...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 pb-8">
      <header className="border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <Link
            href={`/supervisor/review/${documentId}`}
            className="text-sm text-blue-600 hover:underline"
          >
            ← กลับหน้าตรวจสอบ
          </Link>
          <h1 className="mt-2 text-lg font-bold text-slate-900 sm:text-2xl">
            เปรียบเทียบเวอร์ชัน
          </h1>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-4 sm:px-6 sm:py-6">
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-red-700">
            {error}
          </div>
        )}

        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-base font-semibold text-slate-900">
            รายการเวอร์ชัน
          </h2>
          <VersionCompareTable versions={versions} />
        </section>

        {versions.length >= 2 && (
          <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-base font-semibold text-slate-900">
              เลือกเวอร์ชันเปรียบเทียบ
            </h2>
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-slate-600">จาก</span>
                <select
                  value={fromVersion ?? ""}
                  onChange={(e) =>
                    setFromVersion(Number.parseInt(e.target.value, 10))
                  }
                  className="rounded-lg border border-slate-200 px-3 py-2"
                >
                  {versions.map((version) => (
                    <option key={version.id} value={version.versionNo}>
                      V{version.versionNo}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-slate-600">เป็น</span>
                <select
                  value={toVersion ?? ""}
                  onChange={(e) =>
                    setToVersion(Number.parseInt(e.target.value, 10))
                  }
                  className="rounded-lg border border-slate-200 px-3 py-2"
                >
                  {versions.map((version) => (
                    <option key={version.id} value={version.versionNo}>
                      V{version.versionNo}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={handleCompare}
                disabled={!canCompare || comparing}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40"
              >
                {comparing ? "กำลังเปรียบเทียบ..." : "เปรียบเทียบ"}
              </button>
            </div>
          </section>
        )}

        {compare && (
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-base font-semibold text-slate-900">
              ผลการเปรียบเทียบ
            </h2>
            <VersionCompareDetail compare={compare} />
          </section>
        )}
      </main>
    </div>
  );
}
