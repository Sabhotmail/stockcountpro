"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const links = [
  { href: "/admin/users", label: "ผู้ใช้" },
  { href: "/admin/branches", label: "สาขา" },
  { href: "/admin/audit-logs", label: "Audit Log" },
  { href: "/tablet/documents", label: "Tablet / Sync" },
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
          className={cn(
            buttonVariants({
              variant: pathname === link.href ? "default" : "secondary",
              size: "sm",
            }),
          )}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
