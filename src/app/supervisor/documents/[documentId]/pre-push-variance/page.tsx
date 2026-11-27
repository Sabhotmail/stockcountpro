"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { PrePushVarianceTable } from "@/components/PrePushVarianceTable";
import { DetailSkeleton } from "@/components/loading/PageSkeletons";
import { PageShell } from "@/components/PageShell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { filterCountableLines } from "@/lib/line-filter";
import type { ReviewLineItem } from "@/types/count";
import type { ExpressVarianceReportContext } from "@/types/express-variance";

function formatFetchedAt(iso: string): string {
  try {
    return new Intl.DateTimeFormat("th-TH", {
      dateStyle: "short",
      timeStyle: "medium",
      timeZone: "Asia/Bangkok",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export default function PrePushVariancePage() {
  const params = useParams<{ documentId: string }>();
  const router = useRouter();
  const documentId = params.documentId;

  const [report, setReport] = useState<ExpressVarianceReportContext | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [codeFilter, setCodeFilter] = useState("");
  const [nameFilter, setNameFilter] = useState("");
  const [balances, setBalances] = useState<Record<string, number | null> | null>(
    null,
  );
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [balancesLoading, setBalancesLoading] = useState(false);
  const [balancesError, setBalancesError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/count-documents/${documentId}/express-variance-report`,
        );
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        const raw = await res.text();
        let data: { error?: string } & Partial<ExpressVarianceReportContext> =
          {};
        try {
          data = raw ? JSON.parse(raw) : {};
        } catch {
          throw new Error("โหลดหน้ารายงานไม่สำเร็จ");
        }
        if (!res.ok) {
          throw new Error(data.error ?? "โหลดหน้ารายงานไม่สำเร็จ");
        }
        if (!data.success || !data.document || !data.lines) {
          throw new Error("รูปแบบข้อมูลรายงานไม่ถูกต้อง");
        }
        if (!cancelled) {
          setReport({
            success: true,
            document: data.document,
            lines: data.lines,
          });
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "โหลดหน้ารายงานไม่สำเร็จ",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [documentId, router]);

  const filteredLines = useMemo(() => {
    if (!report) return [] as ReviewLineItem[];
    return filterCountableLines(report.lines, {
      codeFilter,
      nameFilter,
      showUncountedOnly: false,
    });
  }, [report, codeFilter, nameFilter]);

  async function fetchBalances() {
    setBalancesLoading(true);
    setBalancesError(null);
    try {
      const res = await fetch(
        `/api/count-documents/${documentId}/pre-push-balances`,
      );
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      const raw = await res.text();
      let data: {
        error?: string;
        fetchedAt?: string;
        balanceByProductCode?: Record<string, number | null>;
      } = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        throw new Error("โหลดคงเหลือจาก Express ไม่สำเร็จ");
      }
      if (!res.ok) {
        throw new Error(data.error ?? "โหลดคงเหลือจาก Express ไม่สำเร็จ");
      }
      setBalances(data.balanceByProductCode ?? {});
      setFetchedAt(data.fetchedAt ?? new Date().toISOString());
    } catch (err) {
      setBalancesError(
        err instanceof Error ? err.message : "โหลดคงเหลือจาก Express ไม่สำเร็จ",
      );
    } finally {
      setBalancesLoading(false);
    }
  }

  if (loading) {
    return (
      <PageShell title="กำลังโหลด..." subtitle="เทียบก่อนส่ง Express">
        <DetailSkeleton />
      </PageShell>
    );
  }

  if (!report) {
    return (
      <PageShell title="ไม่พบเอกสาร">
        <div className="flex flex-col items-center gap-4 py-12">
          <p className="text-muted-foreground">{error ?? "ไม่พบเอกสาร"}</p>
          <Link
            href="/supervisor/documents"
            className={buttonVariants({ variant: "link" })}
          >
            กลับรายการเอกสาร
          </Link>
        </div>
      </PageShell>
    );
  }

  const { document, lines } = report;
  const hasLocation = Boolean(document.locationCode?.trim());
  const locationLabel =
    document.locationName ?? document.locationCode ?? "—";

  return (
    <PageShell
      title="เทียบผลต่างก่อนส่ง Express"
      brand={null}
      subtitle={`${locationLabel} · วันที่ ${document.documentDate}`}
      nav={
        <Link
          href="/supervisor/documents"
          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          ← กลับรายการเอกสาร
        </Link>
      }
    >
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Alert className="mb-5 border-amber-200/80 bg-amber-50 text-amber-950">
        <AlertDescription>
          หน้านี้เทียบ <strong>ยอดนับในแอปที่จะส่ง</strong> กับ{" "}
          <strong>คงเหลือใน Express</strong> เพื่อประมาณผลต่างก่อนกดส่ง
          — <strong>ยังไม่ได้เขียนเข้า Express</strong>
        </AlertDescription>
      </Alert>

      <section className="mb-5 border-b border-border/70 pb-4">
        <p className="text-sm font-medium">{document.documentNo}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {document.branchCode} {document.branchName}
        </p>
      </section>

      <section className="mb-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="prepush-code-filter">ค้นหารหัส</Label>
            <Input
              id="prepush-code-filter"
              value={codeFilter}
              onChange={(e) => setCodeFilter(e.target.value)}
              placeholder="เช่น 101001"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="prepush-name-filter">ค้นหาชื่อ</Label>
            <Input
              id="prepush-name-filter"
              value={nameFilter}
              onChange={(e) => setNameFilter(e.target.value)}
              placeholder="เช่น เจเล่"
            />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground tabular-nums">
            แสดง {filteredLines.length} จาก {lines.length} รายการ
          </p>
          <Button
            type="button"
            disabled={balancesLoading || !hasLocation}
            onClick={() => void fetchBalances()}
          >
            {balancesLoading ? "กำลังดึง…" : "ดึงคงเหลือ Express"}
          </Button>
        </div>

        {!hasLocation && (
          <p className="mt-2 text-sm text-amber-700">
            เอกสารนี้ไม่มีรหัสคลัง Express — ดึงคงเหลือไม่ได้
          </p>
        )}
        {fetchedAt && (
          <p className="mt-2 text-xs text-muted-foreground">
            อัปเดตล่าสุด {formatFetchedAt(fetchedAt)}
          </p>
        )}
        {balancesError && (
          <Alert variant="destructive" className="mt-3">
            <AlertDescription className="flex flex-wrap items-center gap-3">
              <span>{balancesError}</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={balancesLoading || !hasLocation}
                onClick={() => void fetchBalances()}
              >
                ลองใหม่
              </Button>
            </AlertDescription>
          </Alert>
        )}
      </section>

      <div className="overflow-hidden rounded-lg border border-border/80 bg-background">
        <PrePushVarianceTable
          lines={filteredLines}
          balanceByProductCode={balances}
        />
      </div>
    </PageShell>
  );
}
