"use client";

import { useRouter } from "next/navigation";
import { ExpressDeletePanel } from "@/components/ExpressDeletePanel";
import { LogoutButton, PageShell } from "@/components/PageShell";
import { SupervisorNav } from "@/components/SupervisorNav";

export default function SupervisorExpressDeletePage() {
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
      nav={<SupervisorNav />}
    >
      <ExpressDeletePanel />
    </PageShell>
  );
}
