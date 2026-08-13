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
    <div className="-mx-1 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:gap-x-6 sm:gap-y-2">
      {groups.map((group) => (
        <div key={group.label} className="min-w-0">
          <p className="mb-1 px-1 text-[11px] font-medium text-muted-foreground">
            {group.label}
          </p>
          <nav className="flex flex-wrap">
            {group.items.map((item) => {
              const active = isActive(pathname, item);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "inline-flex min-h-10 items-center px-2.5 text-sm transition-colors",
                    active
                      ? "font-medium text-foreground shadow-[inset_0_-2px_0_0_currentColor]"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      ))}
    </div>
  );
}
