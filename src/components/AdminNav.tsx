"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const links = [
  { href: "/admin/users", label: "ผู้ใช้" },
  { href: "/admin/branches", label: "สาขา" },
  { href: "/admin/hubs", label: "Hub" },
  { href: "/admin/settings", label: "ตั้งค่า" },
  { href: "/admin/documents", label: "เอกสาร" },
  { href: "/admin/audit-logs", label: "Audit Log" },
  { href: "/tablet/documents", label: "Tablet / Sync" },
  { href: "/supervisor/documents", label: "Supervisor" },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-2">
      {links.map((link) => {
        const active =
          pathname === link.href ||
          (link.href !== "/admin/users" &&
            pathname.startsWith(`${link.href}/`));
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              buttonVariants({
                variant: active ? "default" : "secondary",
                size: "sm",
              }),
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
