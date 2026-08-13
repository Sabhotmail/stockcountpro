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
      subtitle="ลบได้เฉพาะเอกสารที่เพิ่งดึงมาและยังไม่เริ่มนับ เช่น เจอรหัสสินค้าซ้ำ"
      actions={<LogoutButton onClick={handleLogout} />}
      nav={<AdminNav />}
    >
      <ExpressDeletePanel />
    </PageShell>
  );
}
