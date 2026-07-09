"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { DocumentStatusBadge } from "@/components/DocumentStatusBadge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  DocumentStatus,
  VersionStatus,
  type CountSummary,
} from "@/types/count";

export default function TabletSummaryPage() {
  const params = useParams<{ documentId: string }>();
  const router = useRouter();
  const documentId = params.documentId;

  const [summary, setSummary] = useState<CountSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/count-documents/${documentId}/summary`);
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        if (!res.ok) throw new Error("Failed to load summary");
        const data = await res.json();
        if (!cancelled) setSummary(data.summary);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Load failed");
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

  async function handleSubmit() {
    const versionId = summary?.document.currentVersionId;
    if (!versionId) return;

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/count-documents/${documentId}/versions/${versionId}/submit`,
        { method: "POST" },
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Submit failed");
      }
      router.push("/tablet/documents");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submit failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40">
        <p className="text-muted-foreground">กำลังโหลดสรุป...</p>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-muted/40">
        <p className="text-muted-foreground">ไม่พบเอกสาร</p>
        <Link
          href="/tablet/documents"
          className={buttonVariants({ variant: "link" })}
        >
          กลับรายการ
        </Link>
      </div>
    );
  }

  const { document } = summary;
  const isEditable =
    document.status === DocumentStatus.COUNTING &&
    document.version?.status === VersionStatus.DRAFT;
  const hasUncounted = summary.uncountedLines > 0;

  const stats = [
    { label: "ทั้งหมด", value: summary.totalLines },
    { label: "นับแล้ว", value: summary.countedLines },
    { label: "ยังไม่นับ", value: summary.uncountedLines },
    { label: "นับได้ 0", value: summary.zeroCountLines },
  ];

  return (
    <div className="min-h-screen bg-muted/40 pb-24">
      <header className="sticky top-0 z-10 border-b bg-background px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-4 shadow-sm sm:px-6">
        <div className="mx-auto max-w-4xl">
          <Link
            href={`/tablet/count/${documentId}`}
            className={cn(buttonVariants({ variant: "link" }), "h-auto p-0")}
          >
            ← กลับไปนับต่อ
          </Link>
          <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-lg font-bold tracking-tight sm:text-xl">
                สรุปก่อนส่ง — {document.documentNo}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {document.branchCode} · เวอร์ชัน {document.currentVersionNo}
              </p>
            </div>
            <DocumentStatusBadge status={document.status} compact />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-4 sm:px-6 sm:py-6">
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <section className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map((item) => (
            <Card key={item.label}>
              <CardContent className="pt-6 text-center">
                <p className="text-2xl font-bold">{item.value}</p>
                <p className="mt-1 text-sm text-muted-foreground">{item.label}</p>
              </CardContent>
            </Card>
          ))}
        </section>

        {document.note && (
          <Alert className="mb-4 border-amber-200 bg-amber-50 text-amber-900">
            <AlertDescription>หมายเหตุเอกสาร: {document.note}</AlertDescription>
          </Alert>
        )}

        {hasUncounted && isEditable && (
          <Alert className="mb-4 border-orange-200 bg-orange-50 text-orange-800">
            <AlertDescription>
              ยังมี {summary.uncountedLines} รายการที่ยังไม่นับ — สามารถส่งได้
              แต่ควรตรวจสอบก่อน
            </AlertDescription>
          </Alert>
        )}

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">รายการสินค้า</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>รหัส</TableHead>
                  <TableHead>ชื่อสินค้า</TableHead>
                  <TableHead className="text-right">นับได้</TableHead>
                  <TableHead className="text-center">สถานะ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.lines.map((line) => (
                  <TableRow key={line.lineId}>
                    <TableCell className="font-medium">{line.productCode}</TableCell>
                    <TableCell>{line.productName}</TableCell>
                    <TableCell className="text-right">
                      {line.totalBaseQty ?? "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      {!line.isCounted ? (
                        <span className="text-amber-600">ยังไม่นับ</span>
                      ) : line.isZeroCount ? (
                        <span className="text-muted-foreground">นับได้ 0</span>
                      ) : (
                        <span className="text-green-600">นับแล้ว</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="grid gap-3 sm:grid-cols-2">
          <Link
            href={`/tablet/count/${documentId}`}
            className={buttonVariants({ variant: "outline", size: "lg" })}
          >
            แก้ไขการนับ
          </Link>
          <Button
            type="button"
            size="lg"
            className="bg-green-600 hover:bg-green-700"
            onClick={handleSubmit}
            disabled={!isEditable || submitting}
          >
            {submitting ? "กำลังส่ง..." : "ยืนยันส่งให้หัวหน้างาน"}
          </Button>
        </div>
      </main>
    </div>
  );
}
