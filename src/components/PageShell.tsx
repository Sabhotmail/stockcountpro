import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
  return (
    <Button type="button" variant="outline" size="sm" onClick={onClick}>
      ออกจากระบบ
    </Button>
  );
}
