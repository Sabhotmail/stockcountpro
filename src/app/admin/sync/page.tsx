"use client";

import { useRouter } from "next/navigation";
import { AdminNav } from "@/components/AdminNav";
import { ExpressSyncPanel } from "@/components/ExpressSyncPanel";
import { LogoutButton, PageShell } from "@/components/PageShell";

export default function AdminSyncPage() {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <PageShell
      title="Sync Express"
      subtitle="ดึงใบตรวจนับจาก Express ตามคลังที่เลือก"
      actions={<LogoutButton onClick={handleLogout} />}
      nav={<AdminNav />}
    >
      <ExpressSyncPanel title="Sync ใบตรวจนับจาก Express" />
    </PageShell>
  );
}
