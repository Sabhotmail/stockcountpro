"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const links = [
  { href: "/supervisor/documents", label: "เอกสารรอตรวจ / Approve", exact: true },
  { href: "/tablet/documents", label: "Tablet / นับสต็อก", exact: false },
];

export function SupervisorNav() {
  const pathname = usePathname();

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
