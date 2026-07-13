"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { canAccessAdmin } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { UserRole } from "@/types/user";

const baseLinks = [
  { href: "/supervisor/documents", label: "เอกสารรอตรวจ / Approve", exact: true },
  { href: "/tablet/documents", label: "Tablet / นับสต็อก", exact: false },
];

export function SupervisorNav() {
  const pathname = usePathname();
  const [showAdmin, setShowAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadRole() {
      try {
        const res = await fetch("/api/me");
        if (!res.ok) return;
        const data = (await res.json()) as { user?: { role?: UserRole } };
        if (!cancelled && data.user?.role) {
          setShowAdmin(canAccessAdmin(data.user.role));
        }
      } catch {
        // ignore — nav still works without Admin link
      }
    }

    void loadRole();
    return () => {
      cancelled = true;
    };
  }, []);

  const links = showAdmin
    ? [
        { href: "/admin/documents", label: "กลับ Admin", exact: false },
        ...baseLinks,
      ]
    : baseLinks;

  return (
    <nav className="flex flex-wrap gap-2">
      {links.map((link) => {
        const active = link.exact
          ? pathname === link.href
          : pathname === link.href || pathname.startsWith(`${link.href}/`);

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
