"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AdminNav } from "@/components/AdminNav";
import type { User } from "@/types/user";
import { UserRole } from "@/types/user";

const roleLabels: Record<UserRole, string> = {
  [UserRole.ADMIN]: "Admin",
  [UserRole.HQ]: "HQ",
  [UserRole.SUPERVISOR]: "Supervisor",
  [UserRole.BRANCH_MANAGER]: "ผู้จัดการสาขา",
  [UserRole.STAFF]: "พนักงาน",
  [UserRole.COUNTER]: "ผู้นับ",
  [UserRole.VIEWER]: "ดูอย่างเดียว",
};

export default function AdminUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/users");
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      if (res.status === 403) {
        router.push("/tablet/documents");
        return;
      }
      if (!res.ok) throw new Error("Failed to load users");
      const data = await res.json();
      setUsers(data.users);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

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
              จัดการผู้ใช้
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
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-4 py-3 font-medium">ชื่อ</th>
                    <th className="px-4 py-3 font-medium">Username</th>
                    <th className="px-4 py-3 font-medium">บทบาท</th>
                    <th className="px-4 py-3 font-medium">สาขา</th>
                    <th className="px-4 py-3 font-medium">ID</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-t border-slate-100">
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {user.name}
                      </td>
                      <td className="px-4 py-3 font-mono text-sm text-slate-700">
                        {user.username}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {roleLabels[user.role]}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {user.branchIds.length} สาขา
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">
                        {user.id}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <p className="mt-4 text-sm text-slate-500">
          Prototype — ยังไม่รองรับการแก้ไขผู้ใช้{" "}
          <Link href="/supervisor/documents" className="text-blue-600">
            ไปหน้า Supervisor
          </Link>
        </p>
      </main>
    </div>
  );
}
