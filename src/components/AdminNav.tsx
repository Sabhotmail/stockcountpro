"use client";

import { AppNav, type AppNavGroup } from "@/components/AppNav";

const groups: AppNavGroup[] = [
  {
    label: "งานหลัก",
    items: [
      { href: "/admin/documents", label: "เอกสาร / ประวัติ" },
      { href: "/admin/audit-logs", label: "Audit Log" },
    ],
  },
  {
    label: "ตั้งค่าระบบ",
    items: [
      { href: "/admin/users", label: "ผู้ใช้" },
      { href: "/admin/branches", label: "สาขา" },
      { href: "/admin/hubs", label: "Hub" },
      { href: "/admin/settings", label: "ตั้งค่า" },
    ],
  },
  {
    label: "ปฏิบัติงาน",
    items: [
      { href: "/tablet/documents", label: "นับสต็อก (Tablet)" },
      { href: "/supervisor/documents", label: "Approve", exact: true },
    ],
  },
];

export function AdminNav() {
  return <AppNav groups={groups} />;
}
