"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AdminNav } from "@/components/AdminNav";
import type { Branch } from "@/types/user";

export default function AdminBranchesPage() {
  const router = useRouter();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadBranches = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/branches");
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      if (res.status === 403) {
        router.push("/tablet/documents");
        return;
      }
      if (!res.ok) throw new Error("Failed to load branches");
      const data = await res.json();
      setBranches(data.branches);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadBranches();
  }, [loadBranches]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <div className="min-h-screen bg-slate-100 pb-8">
      <header className="border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-lg font-bold text-slate-900 sm:text-2xl">
              จัดการสาขา
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

        {loading ? (
          <p className="text-slate-500">กำลังโหลด...</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {branches.map((branch) => (
              <div
                key={branch.id}
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <p className="text-lg font-bold text-slate-900">{branch.code}</p>
                <p className="mt-1 text-slate-600">{branch.name}</p>
                {branch.expressLocationCode && (
                  <p className="mt-2 text-sm text-slate-500">
                    Express:{" "}
                    <span className="font-mono">{branch.expressLocationCode}</span>
                  </p>
                )}
                <p className="mt-3 font-mono text-xs text-slate-400">
                  {branch.id}
                </p>
              </div>
            ))}
          </div>
        )}

        <p className="mt-4 text-sm text-slate-500">
          Prototype — ยังไม่รองรับการแก้ไขสาขา{" "}
          <Link href="/admin/users" className="text-blue-600">
            กลับหน้าผู้ใช้
          </Link>
        </p>
      </main>
    </div>
  );
}
