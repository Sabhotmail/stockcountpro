"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/admin/users", label: "ผู้ใช้" },
  { href: "/admin/branches", label: "สาขา" },
  { href: "/admin/audit-logs", label: "Audit Log" },
  { href: "/supervisor/documents", label: "Supervisor" },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-2">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={`rounded-lg px-3 py-2 text-sm font-medium ${
            pathname === link.href
              ? "bg-blue-600 text-white"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
