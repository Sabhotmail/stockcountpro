"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { ChevronRight, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
        {/* Phone: menu only — avoids truncating / overlapping content. */}
        <nav
          className={cn(
            "hidden min-w-0 flex-1 items-center gap-0.5 overflow-x-auto rounded-2xl md:flex",
            "bg-muted/60 p-1 ring-1 ring-border/70",
            "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          )}
        >
          {primaryItems.map((item) => {
            const active = isActive(pathname, item);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "inline-flex min-h-10 shrink-0 items-center rounded-xl px-3.5 text-sm transition-all",
                  active
                    ? "bg-background font-semibold text-foreground shadow-sm ring-1 ring-black/5"
                    : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <Button
          type="button"
          variant="outline"
          className="min-h-11 w-full gap-2 rounded-2xl border-border/80 bg-background px-3.5 shadow-sm md:min-h-12 md:w-auto"
          onClick={() => setMenuOpen(true)}
          aria-label="เปิดเมนูทั้งหมด"
        >
          <Menu className="size-4 opacity-80" />
          <span className="text-sm font-medium">เมนู</span>
        </Button>
      </div>

      <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
        <DialogContent className="max-h-[85dvh] gap-0 overflow-hidden p-0 sm:max-w-md">
          <DialogHeader className="border-b border-border/70 px-5 py-4 text-left">
            <DialogTitle className="text-lg tracking-tight">
              เมนูทั้งหมด
            </DialogTitle>
            <DialogDescription>
              เลือกหน้าที่จะไป — จัดเป็นกลุ่มให้ง่ายต่อการหา
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[min(70dvh,32rem)] space-y-5 overflow-y-auto px-3 py-4">
            {groups.map((group) => (
              <section key={group.label} className="space-y-1.5">
                <p className="px-3 text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
                  {group.label}
                </p>
                <nav className="overflow-hidden rounded-2xl bg-muted/40 ring-1 ring-border/60">
                  {group.items.map((item, index) => {
                    const active = isActive(pathname, item);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMenuOpen(false)}
                        className={cn(
                          "flex min-h-12 items-center justify-between gap-3 px-4 text-sm transition-colors",
                          index > 0 && "border-t border-border/50",
                          active
                            ? "bg-background font-semibold text-foreground"
                            : "text-foreground/85 hover:bg-background/80",
                        )}
                      >
                        <span className="flex items-center gap-2.5">
                          <span
                            className={cn(
                              "h-1.5 w-1.5 rounded-full",
                              active ? "bg-foreground" : "bg-border",
                            )}
                          />
                          {item.label}
                        </span>
                        <ChevronRight
                          className={cn(
                            "size-4 shrink-0",
                            active
                              ? "text-foreground/70"
                              : "text-muted-foreground/50",
                          )}
                        />
                      </Link>
                    );
                  })}
                </nav>
              </section>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
