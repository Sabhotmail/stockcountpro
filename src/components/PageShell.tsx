"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ROLE_LABEL } from "@/lib/role-labels";
import type { MockSession } from "@/types/user";
import { AppVersion } from "@/components/AppVersion";

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
    <div
      className={cn(
        "min-h-[calc(100dvh-var(--env-banner-h,0px))] bg-background",
        className,
      )}
    >
      <header className="sticky top-[var(--env-banner-h,0px)] z-40 border-b border-border/70 bg-background/90 pt-[env(safe-area-inset-top)] backdrop-blur-md supports-backdrop-filter:bg-background/75">
        <div className="mx-auto max-w-6xl px-4 py-3.5 sm:px-6 sm:py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {brand && (
                <p className="flex items-baseline gap-2 text-[11px] font-medium tracking-[0.1em] text-muted-foreground uppercase">
                  <span>{brand}</span>
                  <AppVersion className="font-normal normal-case tracking-normal" />
                </p>
              )}
              <h1
                className={cn(
                  "break-words text-[1.35rem] font-semibold tracking-tight sm:text-2xl",
                  brand && "mt-1",
                )}
              >
                {title}
              </h1>
              {subtitle && (
                <p className="mt-1 max-w-2xl break-words text-sm leading-relaxed text-muted-foreground">
                  {subtitle}
                </p>
              )}
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
              {!brand && <AppVersion className="mr-1" />}
              {actions}
            </div>
          </div>
          {nav && <div className="mt-4">{nav}</div>}
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
    <div className="flex flex-wrap items-center justify-end gap-2.5">
      {user && (
        <div className="hidden min-w-0 rounded-2xl bg-muted/50 px-3 py-1.5 text-right leading-tight ring-1 ring-border/60 sm:block">
          <p className="truncate text-sm font-medium">{user.userName}</p>
          <p className="truncate text-[11px] text-muted-foreground">
            {ROLE_LABEL[user.role] ?? user.role}
          </p>
        </div>
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="min-h-10 rounded-xl"
        onClick={onClick}
      >
        ออกจากระบบ
      </Button>
    </div>
  );
}
