"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ROLE_LABEL } from "@/lib/role-labels";
import type { MockSession } from "@/types/user";

export function PageShell({
  title,
  subtitle,
  actions,
  nav,
  children,
  className,
  brand = "StockCount Pro",
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  nav?: ReactNode;
  children: ReactNode;
  className?: string;
  /** App name shown above the page title. Pass null to hide. */
  brand?: string | null;
}) {
  return (
    <div className={cn("min-h-screen bg-muted/40", className)}>
      <header className="border-b bg-background">
        <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              {brand && (
                <p className="text-xs font-semibold tracking-wide text-muted-foreground">
                  {brand}
                </p>
              )}
              <h1
                className={cn(
                  "text-lg font-bold tracking-tight sm:text-2xl",
                  brand && "mt-0.5",
                )}
              >
                {title}
              </h1>
              {subtitle && (
                <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
              )}
            </div>
            {actions && (
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                {actions}
              </div>
            )}
          </div>
          {nav && (
            <div className="mt-4 border-t border-border/80 pt-3">{nav}</div>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-4 sm:px-6 sm:py-6">
        {children}
      </main>
    </div>
  );
}

export function LogoutButton({ onClick }: { onClick: () => void }) {
  const [user, setUser] = useState<MockSession | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/me", { credentials: "same-origin" });
        if (!res.ok) return;
        const data = (await res.json()) as { user?: MockSession };
        if (!cancelled && data.user) setUser(data.user);
      } catch {
        // ignore — logout still works without label
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {user && (
        <div className="min-w-0 text-right leading-tight">
          <p className="truncate text-sm font-medium">
            {user.userName}
          </p>
          <p className="truncate text-[11px] text-muted-foreground">
            login เป็น · {ROLE_LABEL[user.role] ?? user.role}
          </p>
        </div>
      )}
      <Button type="button" variant="outline" size="sm" onClick={onClick}>
        ออกจากระบบ
      </Button>
    </div>
  );
}
