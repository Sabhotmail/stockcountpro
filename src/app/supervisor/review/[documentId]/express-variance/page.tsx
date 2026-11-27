"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ExpressVarianceReportCards,
  ExpressVarianceReportTable,
} from "@/components/ExpressVarianceReportTable";
import { DetailSkeleton } from "@/components/loading/PageSkeletons";
import { PageShell } from "@/components/PageShell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { filterCountableLines } from "@/lib/line-filter";
import type { ReviewDetail } from "@/types/count";
import type { ExpressVarianceLine } from "@/types/express-variance";

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

export default function ExpressVarianceReportPage() {
  const params = useParams<{ documentId: string }>();
  const router = useRouter();
  const documentId = params.documentId;

  const [review, setReview] = useState<ReviewDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [codeFilter, setCodeFilter] = useState("");
  const [nameFilter, setNameFilter] = useState("");
  const [expressVariance, setExpressVariance] = useState<Record<
    string,
    ExpressVarianceLine
  > | null>(null);
  const [expressFetchedAt, setExpressFetchedAt] = useState<string | null>(null);
  const [expressLoading, setExpressLoading] = useState(false);
  const [expressError, setExpressError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/supervisor/count-documents/${documentId}/review`,
        );
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error ?? "โหลดเอกสารไม่สำเร็จ");
        }
        const data = await res.json();
        if (!cancelled) setReview(data.review);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "โหลดเอกสารไม่สำเร็จ");
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
    if (!review) return [];
    return filterCountableLines(review.reviewLines, {
      codeFilter,
      nameFilter,
      showUncountedOnly: false,
    });
  }, [review, codeFilter, nameFilter]);

  async function fetchExpressVariance() {
    setExpressLoading(true);
    setExpressError(null);
    try {
      const res = await fetch(
        `/api/count-documents/${documentId}/express-variance`,
      );
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      const data = (await res.json()) as {
        error?: string;
        fetchedAt?: string;
        varianceByProductCode?: Record<string, ExpressVarianceLine>;
      };
      if (!res.ok) {
        throw new Error(data.error ?? "โหลดรายงานผลต่างจาก Express ไม่สำเร็จ");
      }
      setExpressVariance(data.varianceByProductCode ?? {});
      setExpressFetchedAt(data.fetchedAt ?? new Date().toISOString());
    } catch (err) {
      setExpressError(
        err instanceof Error
          ? err.message
          : "โหลดรายงานผลต่างจาก Express ไม่สำเร็จ",
      );
    } finally {
      setExpressLoading(false);
    }
  }

  if (loading) {
    return (
      <PageShell title="กำลังโหลด..." subtitle="รายงานผลต่าง Express">
        <DetailSkeleton />
      </PageShell>
    );
  }

  if (!review) {
    return (
      <PageShell title="ไม่พบเอกสาร">
        <div className="flex flex-col items-center gap-4 py-12">
          <p className="text-muted-foreground">{error ?? "ไม่พบเอกสาร"}</p>
          <Link
            href="/supervisor/documents"
            className={buttonVariants({ variant: "link" })}
          >
            กลับรายการ
          </Link>
        </div>
      </PageShell>
    );
  }

  const { document, reviewLines } = review;
  const hasLocation = Boolean(document.locationCode?.trim());
  const locationLabel =
    document.locationName ?? document.locationCode ?? "—";

  return (
    <PageShell
      title="รายงานผลต่าง Express"
      brand={null}
      subtitle={`${locationLabel} · วันที่ ${document.documentDate}`}
      nav={
        <Link
          href={`/supervisor/review/${documentId}`}
          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          ← กลับหน้ารีวิว
        </Link>
      }
    >
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Alert className="mb-5 border-teal-200/80 bg-teal-50 text-teal-950">
        <AlertDescription>
          หน้านี้แสดงยอดที่อยู่ใน Express แล้ว (ยอดนับ = PHYBAL, คงเหลือ =
          LOCBAL, ผลต่าง = PHYBAL − LOCBAL){" "}
          <strong>ไม่ใช่</strong> ขั้นตอนตรวจก่อนส่งยอดจากแอปเข้า Express
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
            <Label htmlFor="variance-code-filter">ค้นหารหัส</Label>
            <Input
              id="variance-code-filter"
              value={codeFilter}
              onChange={(e) => setCodeFilter(e.target.value)}
              placeholder="เช่น 101001"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="variance-name-filter">ค้นหาชื่อ</Label>
            <Input
              id="variance-name-filter"
              value={nameFilter}
              onChange={(e) => setNameFilter(e.target.value)}
              placeholder="เช่น เจเล่"
            />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground tabular-nums">
            แสดง {filteredLines.length} จาก {reviewLines.length} รายการ
          </p>
          <Button
            type="button"
            disabled={expressLoading || !hasLocation}
            onClick={() => void fetchExpressVariance()}
          >
            {expressLoading ? "กำลังดึง…" : "ดึงรายงานผลต่างจาก Express"}
          </Button>
        </div>

        {!hasLocation && (
          <p className="mt-2 text-sm text-amber-700">
            เอกสารนี้ไม่มีรหัสคลัง Express — ดึงรายงานไม่ได้
          </p>
        )}
        {expressFetchedAt && (
          <p className="mt-2 text-xs text-muted-foreground">
            อัปเดตล่าสุด {formatFetchedAt(expressFetchedAt)}
          </p>
        )}
        {expressError && (
          <Alert variant="destructive" className="mt-3">
            <AlertDescription className="flex flex-wrap items-center gap-3">
              <span>{expressError}</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={expressLoading || !hasLocation}
                onClick={() => void fetchExpressVariance()}
              >
                ลองใหม่
              </Button>
            </AlertDescription>
          </Alert>
        )}
      </section>

      <div className="md:hidden">
        <ExpressVarianceReportCards
          lines={filteredLines}
          expressVarianceByProductCode={expressVariance}
        />
      </div>
      <div className="hidden overflow-hidden rounded-lg border border-border/80 bg-background md:block">
        <ExpressVarianceReportTable
          lines={filteredLines}
          expressVarianceByProductCode={expressVariance}
        />
      </div>
    </PageShell>
  );
}
