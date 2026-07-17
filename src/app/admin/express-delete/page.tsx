"use client";

import { useRouter } from "next/navigation";
import { AdminNav } from "@/components/AdminNav";
import { ExpressDeletePanel } from "@/components/ExpressDeletePanel";
import { LogoutButton, PageShell } from "@/components/PageShell";

export default function AdminExpressDeletePage() {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <PageShell
      title="ลบรายการนับ Express"
      subtitle="ลบเอกสารในระบบและรายการนับใน Express ตามวันที่และรหัสคลัง"
      actions={<LogoutButton onClick={handleLogout} />}
      nav={<AdminNav />}
    >
      <ExpressDeletePanel />
    </PageShell>
  );
}
