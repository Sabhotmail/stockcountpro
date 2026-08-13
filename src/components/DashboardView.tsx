"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { AdminNav } from "@/components/AdminNav";
import { DocumentStatusBadge } from "@/components/DocumentStatusBadge";
import { FormCardsSkeleton } from "@/components/loading/PageSkeletons";
import { LogoutButton, PageShell } from "@/components/PageShell";
import { SupervisorNav } from "@/components/SupervisorNav";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  computeDashboardStats,
  type DashboardStats,
} from "@/lib/dashboard-stats";
import { cn } from "@/lib/utils";
import { DocumentStatus, type SupervisorDocumentListItem } from "@/types/count";

type Variant = "admin" | "supervisor";

type DashboardDocument = SupervisorDocumentListItem;

const VARIANT_CONFIG: Record<
  Variant,
  { endpoint: string; title: string; subtitle: string; nav: ReactNode }
> = {
  admin: {
    endpoint: "/api/admin/count-documents",
    title: "ภาพรวม",
    subtitle: "งานที่ต้องทำ และสถานะเอกสารในรอบนี้",
    nav: <AdminNav />,
  },
  supervisor: {
    endpoint: "/api/supervisor/count-documents",
    title: "ภาพรวม",
    subtitle: "เอกสารรอตรวจ อนุมัติ และขอนับใหม่",
    nav: <SupervisorNav />,
  },
};

function locationLabel(doc: DashboardDocument): string {
  const code = doc.locationCode ?? doc.branchCode;
  const name = doc.locationName ?? doc.branchName;
  return `${code} · ${name}`;
}

function Metric({
  label,
  value,
  href,
}: {
  label: string;
  value: number;
  href?: string;
}) {
  const inner = (
    <div className="min-w-0 py-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-[1.75rem] font-semibold tabular-nums tracking-tight">
        {value}
      </p>
    </div>
  );
  if (href) {
    return (
      <Link href={href} className="min-w-0 transition-opacity hover:opacity-70">
        {inner}
      </Link>
    );
  }
  return inner;
}

function ActionList({
  title,
  emptyText,
  docs,
  hrefFor,
}: {
  title: string;
  emptyText: string;
  docs: DashboardDocument[];
  hrefFor: (doc: DashboardDocument) => string;
}) {
  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-medium">{title}</h2>
        <span className="text-xs tabular-nums text-muted-foreground">
          {docs.length}
        </span>
      </div>
      {docs.length === 0 ? (
        <p className="py-8 text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        <ul className="divide-y divide-border/80">
          {docs.slice(0, 8).map((doc) => (
            <li key={doc.id}>
              <Link
                href={hrefFor(doc)}
                className="flex min-h-12 items-center gap-3 py-2.5 transition-colors hover:bg-muted/50"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{doc.documentNo}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {doc.documentDate} · {locationLabel(doc)}
                  </p>
                </div>
                <DocumentStatusBadge status={doc.status} compact />
              </Link>
            </li>
          ))}
        </ul>
      )}
      {docs.length > 8 && (
        <p className="pt-2 text-xs text-muted-foreground">
          และอีก {docs.length - 8} รายการ
        </p>
      )}
    </section>
  );
}

export function DashboardView({ variant }: { variant: Variant }) {
  const router = useRouter();
  const config = VARIANT_CONFIG[variant];
  const [documents, setDocuments] = useState<DashboardDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(config.endpoint, { credentials: "same-origin" });
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      if (res.status === 403) {
        router.push("/tablet/documents");
        return;
      }
      if (!res.ok) throw new Error("โหลดข้อมูลแดชบอร์ดไม่สำเร็จ");
      const data = (await res.json()) as { documents: DashboardDocument[] };
      setDocuments(data.documents ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, [config.endpoint, router]);

  useEffect(() => {
    void load();
  }, [load]);

  const stats: DashboardStats = useMemo(
    () => computeDashboardStats(documents),
    [documents],
  );

  const awaitingApprovalDocs = useMemo(
    () =>
      documents.filter(
        (d) =>
          d.status === DocumentStatus.SUBMITTED ||
          d.status === DocumentStatus.REVIEWING,
      ),
    [documents],
  );

  const recountDocs = useMemo(
    () =>
      documents.filter((d) => d.status === DocumentStatus.RECOUNT_REQUESTED),
    [documents],
  );

  const pendingPushDocs = useMemo(
    () =>
      documents.filter(
        (d) => d.status === DocumentStatus.COMPLETED && !d.lastExpressPushAt,
      ),
    [documents],
  );

  async function handleLogout() {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "same-origin",
    });
    router.push("/login");
  }

  return (
    <PageShell
      title={config.title}
      subtitle={config.subtitle}
      actions={<LogoutButton onClick={handleLogout} />}
      nav={config.nav}
      className="[&_main]:max-w-7xl [&_header>div]:max-w-7xl"
    >
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <FormCardsSkeleton cards={3} />
      ) : (
        <div className="space-y-10">
          <section className="grid grid-cols-2 gap-x-6 gap-y-4 border-b border-border/80 pb-6 sm:grid-cols-4">
            {variant === "admin" ? (
              <>
                <Metric label="เอกสารทั้งหมด" value={stats.total} href="/admin/documents" />
                <Metric label="กำลังนับ" value={stats.inProgress} href="/tablet/documents" />
                <Metric
                  label="รออนุมัติ"
                  value={stats.awaitingApproval}
                  href="/supervisor/documents"
                />
                <Metric
                  label="รอส่ง Express"
                  value={stats.pendingExpressPush}
                  href="/admin/documents"
                />
              </>
            ) : (
              <>
                <Metric
                  label="รออนุมัติ"
                  value={stats.byStatus[DocumentStatus.SUBMITTED]}
                  href="/supervisor/documents"
                />
                <Metric
                  label="กำลังตรวจ"
                  value={stats.byStatus[DocumentStatus.REVIEWING]}
                  href="/supervisor/documents"
                />
                <Metric
                  label="ขอนับใหม่"
                  value={stats.recountRequested}
                  href="/supervisor/documents"
                />
                <Metric label="เสร็จสิ้น" value={stats.completed} />
              </>
            )}
          </section>

          {variant === "admin" ? (
            <section className="grid gap-10 lg:grid-cols-2">
              <StatusBreakdown stats={stats} />
              <CompletionTrend stats={stats} />
            </section>
          ) : (
            <CompletionTrend stats={stats} />
          )}

          <section className="grid gap-10 lg:grid-cols-2">
            <ActionList
              title="รอตรวจ / อนุมัติ"
              emptyText="ไม่มีเอกสารรออนุมัติ"
              docs={awaitingApprovalDocs}
              hrefFor={(doc) => `/supervisor/review/${doc.id}`}
            />
            {variant === "admin" ? (
              <ActionList
                title="เสร็จแล้ว รอส่ง Express"
                emptyText="ส่ง Express ครบแล้ว"
                docs={pendingPushDocs}
                hrefFor={() => "/admin/documents"}
              />
            ) : (
              <ActionList
                title="ขอนับใหม่"
                emptyText="ไม่มีรายการขอนับใหม่"
                docs={recountDocs}
                hrefFor={(doc) => `/supervisor/review/${doc.id}`}
              />
            )}
          </section>
        </div>
      )}
    </PageShell>
  );
}

const THAI_MONTH_ABBR = [
  "ม.ค.",
  "ก.พ.",
  "มี.ค.",
  "เม.ย.",
  "พ.ค.",
  "มิ.ย.",
  "ก.ค.",
  "ส.ค.",
  "ก.ย.",
  "ต.ค.",
  "พ.ย.",
  "ธ.ค.",
];

function formatMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  if (!y || !m) return monthKey;
  const abbr = THAI_MONTH_ABBR[m - 1] ?? String(m);
  if (m === 1) return `${abbr} ${String((y + 543) % 100).padStart(2, "0")}`;
  return abbr;
}

function CompletionTrend({ stats }: { stats: DashboardStats }) {
  const points = stats.completedTrend;
  const max = Math.max(1, ...points.map((p) => p.count));
  const currentKey = points[points.length - 1]?.monthKey;

  return (
    <section>
      <div className="mb-4 flex items-end justify-between gap-2">
        <div>
          <h2 className="text-sm font-medium">นับเสร็จย้อนหลัง {points.length} เดือน</h2>
          <p className="text-xs text-muted-foreground">เดือนที่อนุมัติเอกสาร</p>
        </div>
        <div className="text-right leading-tight">
          <p className="text-xs text-muted-foreground">เดือนนี้</p>
          <p className="text-2xl font-semibold tabular-nums">
            {stats.completedThisMonth}
          </p>
        </div>
      </div>
      <div className="flex h-28 items-end gap-2">
        {points.map((point) => {
          const isCurrent = point.monthKey === currentKey;
          const heightPct =
            point.count > 0 ? Math.max((point.count / max) * 100, 8) : 2;
          return (
            <div key={point.monthKey} className="flex flex-1 flex-col items-center gap-1">
              <span className="text-[11px] tabular-nums text-muted-foreground">
                {point.count}
              </span>
              <div className="flex w-full flex-1 items-end">
                <div
                  className={cn(
                    "w-full transition-[height]",
                    isCurrent ? "bg-foreground" : "bg-foreground/25",
                  )}
                  style={{ height: `${heightPct}%` }}
                  title={`${point.monthKey} · ${point.count} เอกสาร`}
                />
              </div>
              <span
                className={cn(
                  "text-[11px] tabular-nums",
                  isCurrent ? "font-medium text-foreground" : "text-muted-foreground",
                )}
              >
                {formatMonthLabel(point.monthKey)}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

const STATUS_ORDER: DocumentStatus[] = [
  DocumentStatus.IMPORTED,
  DocumentStatus.COUNTING,
  DocumentStatus.SUBMITTED,
  DocumentStatus.REVIEWING,
  DocumentStatus.RECOUNT_REQUESTED,
  DocumentStatus.COMPLETED,
];

function StatusBreakdown({ stats }: { stats: DashboardStats }) {
  const max = Math.max(1, ...STATUS_ORDER.map((s) => stats.byStatus[s]));
  return (
    <section>
      <div className="mb-4 flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-medium">สัดส่วนตามสถานะ</h2>
        {stats.totalLines > 0 && (
          <span className="text-xs text-muted-foreground">
            นับแล้ว {stats.countedLines.toLocaleString()}/
            {stats.totalLines.toLocaleString()} ({stats.progressPct}%)
          </span>
        )}
      </div>
      <div className="space-y-2.5">
        {STATUS_ORDER.map((status) => {
          const count = stats.byStatus[status];
          return (
            <div key={status} className="flex items-center gap-3">
              <div className="w-24 shrink-0">
                <DocumentStatusBadge status={status} compact />
              </div>
              <div className="h-1.5 flex-1 overflow-hidden bg-muted">
                <div
                  className="h-full bg-foreground"
                  style={{ width: `${(count / max) * 100}%` }}
                />
              </div>
              <span className="w-8 shrink-0 text-right text-sm tabular-nums">
                {count}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
