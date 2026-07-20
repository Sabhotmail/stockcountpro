import { DocumentStatus, type CountDocumentListItem } from "@/types/count";

export type DashboardDoc = Pick<
  CountDocumentListItem,
  "status" | "countedLines" | "totalLines" | "lastExpressPushAt" | "updatedAt"
>;

export type TrendPoint = {
  /** Local calendar month, yyyy-MM */
  monthKey: string;
  count: number;
};

export type DashboardStats = {
  total: number;
  byStatus: Record<DocumentStatus, number>;
  notStarted: number;
  inProgress: number;
  awaitingApproval: number;
  recountRequested: number;
  completed: number;
  pendingExpressPush: number;
  countedLines: number;
  totalLines: number;
  progressPct: number;
  completedThisMonth: number;
  completedTrend: TrendPoint[];
};

/** Local (browser-timezone) calendar month key, yyyy-MM. */
export function localMonthKey(value: Date): string {
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function emptyByStatus(): Record<DocumentStatus, number> {
  return {
    [DocumentStatus.IMPORTED]: 0,
    [DocumentStatus.COUNTING]: 0,
    [DocumentStatus.SUBMITTED]: 0,
    [DocumentStatus.REVIEWING]: 0,
    [DocumentStatus.RECOUNT_REQUESTED]: 0,
    [DocumentStatus.APPROVED]: 0,
    [DocumentStatus.COMPLETED]: 0,
  };
}

export function computeDashboardStats(
  docs: DashboardDoc[],
  options: { now?: Date; trendMonths?: number } = {},
): DashboardStats {
  const now = options.now ?? new Date();
  const trendMonths = Math.max(1, options.trendMonths ?? 6);

  const byStatus = emptyByStatus();
  let countedLines = 0;
  let totalLines = 0;
  let pendingExpressPush = 0;

  // Count completed documents per local month, keyed on updatedAt (set at approval).
  const completedByMonth = new Map<string, number>();

  for (const doc of docs) {
    byStatus[doc.status] = (byStatus[doc.status] ?? 0) + 1;
    countedLines += doc.countedLines ?? 0;
    totalLines += doc.totalLines ?? 0;
    if (doc.status === DocumentStatus.COMPLETED && !doc.lastExpressPushAt) {
      pendingExpressPush += 1;
    }
    if (doc.status === DocumentStatus.COMPLETED && doc.updatedAt) {
      const parsed = new Date(doc.updatedAt);
      if (!Number.isNaN(parsed.getTime())) {
        const key = localMonthKey(parsed);
        completedByMonth.set(key, (completedByMonth.get(key) ?? 0) + 1);
      }
    }
  }

  const completedTrend: TrendPoint[] = [];
  for (let offset = trendMonths - 1; offset >= 0; offset -= 1) {
    const month = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const key = localMonthKey(month);
    completedTrend.push({ monthKey: key, count: completedByMonth.get(key) ?? 0 });
  }

  const thisMonthKey = localMonthKey(now);
  const completedThisMonth = completedByMonth.get(thisMonthKey) ?? 0;

  return {
    total: docs.length,
    byStatus,
    notStarted: byStatus[DocumentStatus.IMPORTED],
    inProgress:
      byStatus[DocumentStatus.COUNTING] +
      byStatus[DocumentStatus.RECOUNT_REQUESTED],
    awaitingApproval:
      byStatus[DocumentStatus.SUBMITTED] + byStatus[DocumentStatus.REVIEWING],
    recountRequested: byStatus[DocumentStatus.RECOUNT_REQUESTED],
    completed: byStatus[DocumentStatus.COMPLETED],
    pendingExpressPush,
    countedLines,
    totalLines,
    progressPct:
      totalLines > 0 ? Math.round((countedLines / totalLines) * 100) : 0,
    completedThisMonth,
    completedTrend,
  };
}
