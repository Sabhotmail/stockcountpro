"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { mockUsers } from "@/mock/users";
import { MOCK_SESSION_STORAGE_KEY } from "@/lib/mock-session";

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin(userId: string) {
    setLoading(userId);
    setError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Login failed");
      }

      const data = await res.json();
      localStorage.setItem(
        MOCK_SESSION_STORAGE_KEY,
        JSON.stringify(data.session),
      );
      router.push("/tablet/documents");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <div className="w-full max-w-lg rounded-2xl bg-white p-8 shadow-lg">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-slate-900">StockCount Pro</h1>
          <p className="mt-2 text-slate-600">Mock Login — Prototype Only</p>
          <p className="mt-1 text-xs text-amber-600">
            TODO: Replace with Auth.js / Microsoft Entra ID
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-3">
          {mockUsers.map((user) => (
            <button
              key={user.id}
              type="button"
              disabled={loading !== null}
              onClick={() => handleLogin(user.id)}
              className="flex items-center justify-between rounded-xl border border-slate-200 px-5 py-4 text-left transition hover:border-blue-300 hover:bg-blue-50 disabled:opacity-50"
            >
              <div>
                <p className="font-semibold text-slate-900">{user.name}</p>
                <p className="text-sm text-slate-500">{user.role}</p>
              </div>
              <span className="text-sm text-blue-600">
                {loading === user.id ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ →"}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
