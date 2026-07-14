import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function TableRowsSkeleton({
  rows = 6,
  className,
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-3", className)} aria-busy aria-label="กำลังโหลด">
      <div className="hidden overflow-hidden rounded-xl border md:block">
        <div className="flex gap-4 border-b bg-muted/40 px-4 py-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="ml-auto h-4 w-24" />
        </div>
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b px-4 py-3 last:border-b-0"
          >
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-4 w-12" />
            <Skeleton className="ml-auto h-8 w-24" />
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 md:hidden">
        {Array.from({ length: Math.min(rows, 4) }).map((_, i) => (
          <div key={i} className="space-y-3 rounded-xl border p-4">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <div className="flex gap-2">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-12 rounded-full" />
            </div>
            <Skeleton className="h-9 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function DetailSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-4", className)} aria-busy aria-label="กำลังโหลด">
      <div className="space-y-3 rounded-xl border p-4">
        <Skeleton className="h-6 w-2/3" />
        <div className="grid gap-3 sm:grid-cols-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
      <div className="space-y-2 rounded-xl border p-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-9 w-28" />
        <Skeleton className="h-9 w-28" />
      </div>
    </div>
  );
}

export function FormCardsSkeleton({
  cards = 3,
  className,
}: {
  cards?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-4", className)} aria-busy aria-label="กำลังโหลด">
      {Array.from({ length: cards }).map((_, i) => (
        <div key={i} className="space-y-3 rounded-xl border p-4">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-2/3" />
        </div>
      ))}
    </div>
  );
}

export function ListPanelSkeleton({
  rows = 7,
  className,
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <div
      className={cn("divide-y overflow-hidden rounded-lg border", className)}
      aria-busy
      aria-label="กำลังโหลด"
    >
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3">
          <Skeleton className="size-4 shrink-0 rounded" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <div className="flex gap-2">
              <Skeleton className="h-5 w-14 rounded-full" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function CountDocumentSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex min-h-screen flex-col bg-muted/40",
        className,
      )}
      aria-busy
      aria-label="กำลังโหลด"
    >
      <div className="border-b bg-background px-6 py-4">
        <div className="mx-auto max-w-4xl space-y-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-7 w-2/3" />
          <div className="flex gap-2">
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
        </div>
      </div>
      <div className="mx-auto w-full max-w-4xl flex-1 space-y-4 p-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-3 rounded-xl border bg-background p-4">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/3" />
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PrintDocumentSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("min-h-screen bg-neutral-200/80 p-4", className)}
      aria-busy
      aria-label="กำลังโหลด"
    >
      <div className="mx-auto max-w-[210mm] space-y-4 rounded bg-white p-8 shadow-md">
        <Skeleton className="mx-auto h-5 w-48" />
        <Skeleton className="mx-auto h-8 w-64" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-4 w-40" />
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    </div>
  );
}
