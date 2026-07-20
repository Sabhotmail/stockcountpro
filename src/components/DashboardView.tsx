"use client";

import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  FileClock,
  Layers,
  RefreshCw,
  Send,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { AdminNav } from "@/components/AdminNav";
import { DocumentStatusBadge } from "@/components/DocumentStatusBadge";
import { FormCardsSkeleton } from "@/components/loading/PageSkeletons";
import { LogoutButton, PageShell } from "@/components/PageShell";
import { SupervisorNav } from "@/components/SupervisorNav";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
    title: "ภาพรวมระบบ",
    subtitle: "สรุปสถานะเอกสารตรวจนับและงานที่ต้องดำเนินการ",
    nav: <AdminNav />,
  },
  supervisor: {
    endpoint: "/api/supervisor/count-documents",
    title: "ภาพรวมงานตรวจนับ",
    subtitle: "งานที่รอคุณตรวจและอนุมัติ",
    nav: <SupervisorNav />,
  },
};

function locationLabel(doc: DashboardDocument): string {
  const code = doc.locationCode ?? doc.branchCode;
  const name = doc.locationName ?? doc.branchName;
  return `${code} · ${name}`;
}

type StatTone = "neutral" | "blue" | "amber" | "emerald" | "violet";

const TONE_CLASS: Record<StatTone, string> = {
  neutral: "text-foreground",
  blue: "text-blue-600",
  amber: "text-amber-600",
  emerald: "text-emerald-600",
  violet: "text-violet-600",
};

const TONE_ICON_BG: Record<StatTone, string> = {
  neutral: "bg-muted text-muted-foreground",
  blue: "bg-blue-50 text-blue-600",
  amber: "bg-amber-50 text-amber-600",
  emerald: "bg-emerald-50 text-emerald-600",
  violet: "bg-violet-50 text-violet-600",
};

function StatCard({
  label,
  value,
  icon,
  tone = "neutral",
  href,
  hint,
}: {
  label: string;
  value: number;
  icon: ReactNode;
  tone?: StatTone;
  href?: string;
  hint?: string;
}) {
  const body = (
    <Card
      className={cn(
        "h-full transition-colors",
        href && "hover:border-primary/40 hover:bg-accent/40",
      )}
    >
      <CardContent className="flex items-center gap-3 p-4">
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-lg",
            TONE_ICON_BG[tone],
          )}
        >
          {icon}
        </span>
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-muted-foreground">
            {label}
          </p>
          <p className={cn("text-2xl font-bold tabular-nums", TONE_CLASS[tone])}>
            {value}
          </p>
          {hint && (
            <p className="truncate text-[11px] text-muted-foreground">{hint}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );

  if (href) {
    return (
      <Link href={href} className="block">
        {body}
      </Link>
    );
  }
  return body;
}

const STATUS_ORDER: DocumentStatus[] = [
  DocumentStatus.IMPORTED,
  DocumentStatus.COUNTING,
  DocumentStatus.SUBMITTED,
  DocumentStatus.REVIEWING,
  DocumentStatus.RECOUNT_REQUESTED,
  DocumentStatus.COMPLETED,
];

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
    <Card>
      <CardContent className="p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">{title}</h2>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
            {docs.length}
          </span>
        </div>

        {docs.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {emptyText}
          </p>
        ) : (
          <ul className="divide-y">
            {docs.slice(0, 8).map((doc) => (
              <li key={doc.id}>
                <Link
                  href={hrefFor(doc)}
                  className="group flex items-center gap-3 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {doc.documentNo}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {doc.documentDate} · {locationLabel(doc)}
                    </p>
                  </div>
                  <DocumentStatusBadge status={doc.status} compact />
                  <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </Link>
              </li>
            ))}
          </ul>
        )}

        {docs.length > 8 && (
          <p className="pt-2 text-center text-xs text-muted-foreground">
            และอีก {docs.length - 8} รายการ
          </p>
        )}
      </CardContent>
    </Card>
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
        <div className="space-y-6">
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {variant === "admin" ? (
              <>
                <StatCard
                  label="เอกสารทั้งหมด"
                  value={stats.total}
                  icon={<Layers className="size-5" />}
                  href="/admin/documents"
                />
                <StatCard
                  label="กำลังนับ"
                  value={stats.inProgress}
                  icon={<ClipboardList className="size-5" />}
                  tone="blue"
                  href="/tablet/documents"
                />
                <StatCard
                  label="รออนุมัติ"
                  value={stats.awaitingApproval}
                  icon={<ClipboardCheck className="size-5" />}
                  tone="amber"
                  href="/supervisor/documents"
                />
                <StatCard
                  label="รอส่ง Express"
                  value={stats.pendingExpressPush}
                  icon={<Send className="size-5" />}
                  tone="violet"
                  href="/admin/documents"
                  hint="เอกสารเสร็จแล้วยังไม่ส่ง"
                />
              </>
            ) : (
              <>
                <StatCard
                  label="รออนุมัติ"
                  value={stats.byStatus[DocumentStatus.SUBMITTED]}
                  icon={<ClipboardCheck className="size-5" />}
                  tone="amber"
                  href="/supervisor/documents"
                />
                <StatCard
                  label="กำลังตรวจ"
                  value={stats.byStatus[DocumentStatus.REVIEWING]}
                  icon={<FileClock className="size-5" />}
                  tone="blue"
                  href="/supervisor/documents"
                />
                <StatCard
                  label="ขอนับใหม่"
                  value={stats.recountRequested}
                  icon={<RefreshCw className="size-5" />}
                  tone="amber"
                  href="/supervisor/documents"
                />
                <StatCard
                  label="เสร็จสิ้น"
                  value={stats.completed}
                  icon={<CheckCircle2 className="size-5" />}
                  tone="emerald"
                />
              </>
            )}
          </section>

          {variant === "admin" ? (
            <section className="grid gap-4 lg:grid-cols-2">
              <StatusBreakdown stats={stats} />
              <CompletionTrend stats={stats} />
            </section>
          ) : (
            <CompletionTrend stats={stats} />
          )}

          <section className="grid gap-4 lg:grid-cols-2">
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
  // Mark year boundaries (January) with a 2-digit Buddhist year.
  if (m === 1) return `${abbr} ${String((y + 543) % 100).padStart(2, "0")}`;
  return abbr;
}

function CompletionTrend({ stats }: { stats: DashboardStats }) {
  const points = stats.completedTrend;
  const max = Math.max(1, ...points.map((p) => p.count));
  const currentKey = points[points.length - 1]?.monthKey;

  return (
    <Card>
      <CardContent className="p-4 sm:p-5">
        <div className="mb-4 flex items-end justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold">
              นับเสร็จย้อนหลัง {points.length} เดือน
            </h2>
            <p className="text-[11px] text-muted-foreground">
              อ้างอิงเดือนที่อนุมัติเอกสาร
            </p>
          </div>
          <div className="text-right leading-tight">
            <p className="text-[11px] text-muted-foreground">นับเสร็จเดือนนี้</p>
            <p className="text-2xl font-bold tabular-nums text-emerald-600">
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
              <div
                key={point.monthKey}
                className="flex flex-1 flex-col items-center gap-1"
              >
                <span className="text-[11px] font-medium tabular-nums text-muted-foreground">
                  {point.count}
                </span>
                <div className="flex w-full flex-1 items-end">
                  <div
                    className={cn(
                      "w-full rounded-t transition-all",
                      isCurrent ? "bg-emerald-500" : "bg-primary/60",
                    )}
                    style={{ height: `${heightPct}%` }}
                    title={`${point.monthKey} · ${point.count} เอกสาร`}
                  />
                </div>
                <span
                  className={cn(
                    "text-[11px] tabular-nums",
                    isCurrent
                      ? "font-semibold text-emerald-700"
                      : "text-muted-foreground",
                  )}
                >
                  {formatMonthLabel(point.monthKey)}
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function StatusBreakdown({ stats }: { stats: DashboardStats }) {
  const max = Math.max(1, ...STATUS_ORDER.map((s) => stats.byStatus[s]));
  return (
    <Card>
      <CardContent className="p-4 sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">สัดส่วนตามสถานะ</h2>
          {stats.totalLines > 0 && (
            <span className="text-xs text-muted-foreground">
              นับแล้ว {stats.countedLines.toLocaleString()}/
              {stats.totalLines.toLocaleString()} รายการ ({stats.progressPct}%)
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
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary/70"
                    style={{ width: `${(count / max) * 100}%` }}
                  />
                </div>
                <span className="w-8 shrink-0 text-right text-sm font-medium tabular-nums">
                  {count}
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
