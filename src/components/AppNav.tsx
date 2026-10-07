"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

/** Compact strip: only the most-used destinations. */
const PRIMARY_HREFS = [
  "/admin/dashboard",
  "/supervisor/dashboard",
  "/admin/documents",
  "/tablet/documents",
  "/supervisor/documents",
] as const;

function isActive(pathname: string, item: AppNavItem): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function NavLink({
  item,
  pathname,
  onNavigate,
  className,
}: {
  item: AppNavItem;
  pathname: string;
  onNavigate?: () => void;
  className?: string;
}) {
  const active = isActive(pathname, item);
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        "inline-flex min-h-11 shrink-0 items-center rounded-lg px-3 text-sm transition-colors",
        active
          ? "bg-background font-semibold text-foreground shadow-sm ring-1 ring-border"
          : "text-muted-foreground hover:bg-background/80 hover:text-foreground",
        className,
      )}
    >
      {item.label}
    </Link>
  );
}

export function AppNav({ groups }: { groups: AppNavGroup[] }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const allItems = useMemo(
    () => groups.flatMap((group) => group.items),
    [groups],
  );

  const primaryItems = useMemo(() => {
    const seen = new Set<string>();
    const picked: AppNavItem[] = [];
    for (const href of PRIMARY_HREFS) {
      const item = allItems.find((candidate) => candidate.href === href);
      if (item && !seen.has(item.href)) {
        seen.add(item.href);
        picked.push(item);
      }
    }
    if (picked.length === 0) {
      return allItems.slice(0, 4);
    }
    return picked;
  }, [allItems]);

  return (
    <>
      <div className="flex items-center gap-2">
        <nav className="-mx-1 flex min-w-0 flex-1 gap-1 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {primaryItems.map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} />
          ))}
        </nav>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-11 shrink-0 gap-1.5 px-3"
          onClick={() => setMenuOpen(true)}
          aria-label="เปิดเมนูทั้งหมด"
        >
          <Menu className="size-4" />
          เมนู
        </Button>
      </div>

      <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>เมนูทั้งหมด</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pb-2">
            {groups.map((group) => (
              <section key={group.label}>
                <p className="mb-1.5 px-1 text-[11px] font-semibold tracking-wide text-muted-foreground">
                  {group.label}
                </p>
                <nav className="grid gap-1">
                  {group.items.map((item) => (
                    <NavLink
                      key={item.href}
                      item={item}
                      pathname={pathname}
                      onNavigate={() => setMenuOpen(false)}
                      className="w-full justify-start"
                    />
                  ))}
                </nav>
              </section>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
