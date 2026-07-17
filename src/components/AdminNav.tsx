"use client";

import { useEffect, useState } from "react";
import { AppNav, type AppNavGroup } from "@/components/AppNav";
import { canAccessAdmin, canManageSystem } from "@/lib/permissions";
import { UserRole } from "@/types/user";

const workGroups: AppNavGroup[] = [
  {
    label: "งานหลัก",
    items: [
      { href: "/admin/documents", label: "เอกสาร / ประวัติ" },
      { href: "/admin/audit-logs", label: "Audit Log" },
    ],
  },
  {
    label: "ปฏิบัติงาน",
    items: [
      { href: "/tablet/documents", label: "นับสต็อก (Tablet)" },
      { href: "/supervisor/documents", label: "Approve", exact: true },
      { href: "/admin/express-delete", label: "ลบรายการนับ Express" },
    ],
  },
];

const systemGroup: AppNavGroup = {
  label: "ตั้งค่าระบบ",
  items: [
    { href: "/admin/users", label: "ผู้ใช้" },
    { href: "/admin/branches", label: "สาขา" },
    { href: "/admin/hubs", label: "Hub" },
    { href: "/admin/settings", label: "ตั้งค่า" },
  ],
};

export function AdminNav() {
  const [role, setRole] = useState<UserRole | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadRole() {
      try {
        const res = await fetch("/api/me");
        if (!res.ok) return;
        const data = (await res.json()) as { user?: { role?: UserRole } };
        if (!cancelled && data.user?.role) {
          setRole(data.user.role);
        }
      } catch {
        // keep default HQ-safe nav until role loads
      }
    }

    void loadRole();
    return () => {
      cancelled = true;
    };
  }, []);

  // Before role loads, show HQ-safe menus only (no system management).
  const showSystem = role ? canManageSystem(role) : false;
  const showNav = role ? canAccessAdmin(role) : true;

  if (!showNav) return null;

  const groups = showSystem
    ? [workGroups[0], systemGroup, workGroups[1]]
    : workGroups;

  return <AppNav groups={groups} />;
}
