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
      subtitle="ลบเอกสารในระบบและรายการนับใน Express ตามวันที่และรหัสคลัง"
      actions={<LogoutButton onClick={handleLogout} />}
      nav={<SupervisorNav />}
    >
      <ExpressDeletePanel />
    </PageShell>
  );
}
