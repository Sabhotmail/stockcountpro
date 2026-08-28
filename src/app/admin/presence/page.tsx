"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AdminNav } from "@/components/AdminNav";
import { FormCardsSkeleton } from "@/components/loading/PageSkeletons";
import { LogoutButton, PageShell } from "@/components/PageShell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ROLE_LABEL } from "@/lib/role-labels";
import { formatDateTimeShortTH } from "@/lib/datetime";
import { ADMIN_PRESENCE_POLL_MS } from "@/lib/user-presence";
import type { UserRole } from "@/types/user";

type PresenceRow = {
  userId: string;
  userName: string;
  role: UserRole;
  lastSeenAt: string;
  activity: string;
};

export default function AdminPresencePage() {
  const router = useRouter();
  const [users, setUsers] = useState<PresenceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/presence", {
        credentials: "same-origin",
      });
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      if (res.status === 403) {
        router.push("/admin/documents");
        return;
      }
      if (!res.ok) throw new Error("โหลดรายชื่อไม่สำเร็จ");
      const data = (await res.json()) as { users: PresenceRow[] };
      setUsers(data.users);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "โหลดไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void load();
    const intervalId = setInterval(() => {
      void load();
    }, ADMIN_PRESENCE_POLL_MS);
    return () => clearInterval(intervalId);
  }, [load]);

  async function handleLogout() {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "same-origin",
    });
    router.push("/login");
  }

  return (
    <PageShell
      title="ผู้ที่กำลังใช้งาน"
      subtitle="คนที่ขยับในระบบช่วง 5 นาทีล่าสุด"
      nav={<AdminNav />}
      actions={<LogoutButton onClick={handleLogout} />}
    >
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <FormCardsSkeleton cards={2} />
      ) : users.length === 0 ? (
        <p className="py-12 text-center text-muted-foreground">
          ตอนนี้ยังไม่มีใครกำลังใช้งาน
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="py-2 pr-4 font-medium">ชื่อ</th>
                <th className="py-2 pr-4 font-medium">บทบาท</th>
                <th className="py-2 pr-4 font-medium">กำลังทำอะไร</th>
                <th className="py-2 font-medium">ใช้งานล่าสุด</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.userId} className="border-b border-border/70">
                  <td className="py-3 pr-4 font-medium">{user.userName}</td>
                  <td className="py-3 pr-4 text-muted-foreground">
                    {ROLE_LABEL[user.role]}
                  </td>
                  <td className="py-3 pr-4">{user.activity}</td>
                  <td className="py-3 text-muted-foreground tabular-nums">
                    {formatDateTimeShortTH(user.lastSeenAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PageShell>
  );
}
