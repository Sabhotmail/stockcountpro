"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export type AppNavItem = {
  href: string;
  label: string;
  /** Match pathname exactly (no prefix). */
  exact?: boolean;
};

export type AppNavGroup = {
  label: string;
  items: AppNavItem[];
};

function isActive(pathname: string, item: AppNavItem): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function AppNav({ groups }: { groups: AppNavGroup[] }) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col gap-2 sm:gap-2.5">
      {groups.map((group) => (
        <section
          key={group.label}
          className="rounded-xl border border-border/80 bg-muted/25 px-2 py-2 sm:px-2.5"
        >
          <p className="px-2 text-[11px] font-semibold tracking-wide text-muted-foreground">
            {group.label}
          </p>
          <nav className="mt-1 flex flex-wrap gap-1">
            {group.items.map((item) => {
              const active = isActive(pathname, item);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "inline-flex min-h-11 items-center rounded-lg px-3 text-sm transition-colors",
                    active
                      ? "bg-background font-semibold text-foreground shadow-sm ring-1 ring-border"
                      : "text-muted-foreground hover:bg-background/70 hover:text-foreground",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </section>
      ))}
    </div>
  );
}
