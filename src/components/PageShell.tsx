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
    <div className={cn("min-h-dvh bg-background", className)}>
      <header className="sticky top-0 z-40 border-b bg-background pt-[env(safe-area-inset-top)]">
        <div className="mx-auto max-w-6xl px-4 py-3 sm:px-6 sm:py-3.5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {brand && (
                <p className="text-[11px] font-medium tracking-[0.08em] text-muted-foreground">
                  {brand}
                </p>
              )}
              <h1
                className={cn(
                  "text-xl font-semibold tracking-tight sm:text-[1.375rem]",
                  brand && "mt-0.5",
                )}
              >
                {title}
              </h1>
              {subtitle && (
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {subtitle}
                </p>
              )}
            </div>
            {actions && (
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                {actions}
              </div>
            )}
          </div>
          {nav && <div className="mt-3">{nav}</div>}
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-6">
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
        <div className="hidden min-w-0 text-right leading-tight sm:block">
          <p className="truncate text-sm font-medium">{user.userName}</p>
          <p className="truncate text-[11px] text-muted-foreground">
            {ROLE_LABEL[user.role] ?? user.role}
          </p>
        </div>
      )}
      <Button type="button" variant="outline" size="sm" onClick={onClick}>
        ออกจากระบบ
      </Button>
    </div>
  );
}
