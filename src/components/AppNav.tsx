"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
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
    <div className="space-y-3">
      {groups.map((group) => (
        <div key={group.label} className="space-y-1.5">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {group.label}
          </p>
          <nav className="flex flex-wrap gap-1.5">
            {group.items.map((item) => {
              const active = isActive(pathname, item);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    buttonVariants({
                      variant: active ? "default" : "ghost",
                      size: "sm",
                    }),
                    !active && "bg-muted/60 text-foreground hover:bg-muted",
                    "h-8 px-3",
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
