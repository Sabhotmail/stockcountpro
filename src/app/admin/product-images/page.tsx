"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminNav } from "@/components/AdminNav";
import { DocumentStatusBadge } from "@/components/DocumentStatusBadge";
import { FormCardsSkeleton } from "@/components/loading/PageSkeletons";
import { LogoutButton, PageShell } from "@/components/PageShell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { DocumentStatus } from "@/types/count";

type MissingDoc = {
  documentId: string;
  documentNo: string;
  status: DocumentStatus;
  branchCode: string;
  branchName: string;
};

/** Where to open count/review detail from the missing-images report. */
function documentDetailHref(status: DocumentStatus, documentId: string): string {
  switch (status) {
    case DocumentStatus.SUBMITTED:
    case DocumentStatus.REVIEWING:
    case DocumentStatus.RECOUNT_REQUESTED:
    case DocumentStatus.APPROVED:
    case DocumentStatus.COMPLETED:
      return `/supervisor/review/${documentId}`;
    case DocumentStatus.COUNTING:
      return `/tablet/count/${documentId}`;
    default:
      return `/admin/documents/${documentId}`;
  }
}

function showsCountReview(status: DocumentStatus): boolean {
  return (
    status === DocumentStatus.SUBMITTED ||
    status === DocumentStatus.REVIEWING ||
    status === DocumentStatus.RECOUNT_REQUESTED ||
    status === DocumentStatus.APPROVED ||
    status === DocumentStatus.COMPLETED
  );
}

type MissingRow = {
  productCode: string;
  productName: string;
  documents: MissingDoc[];
};

type Report = {
  summary: {
    totalProductCodes: number;
    withImage: number;
    missingImage: number;
  };
  missing: MissingRow[];
};

export default function AdminProductImagesPage() {
  const router = useRouter();
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/product-images", {
        credentials: "same-origin",
      });
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      if (res.status === 403) {
        router.push("/admin/documents");
        return;
      }
      if (!res.ok) throw new Error("โหลดรายการไม่สำเร็จ");
      const data = (await res.json()) as Report;
      setReport(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "โหลดไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const rows = report?.missing ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (row) =>
        row.productCode.toLowerCase().includes(q) ||
        row.productName.toLowerCase().includes(q),
    );
  }, [query, report?.missing]);

  async function handleLogout() {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "same-origin",
    });
    router.push("/login");
  }

  return (
    <PageShell
      title="รูปสินค้า"
      subtitle="รหัสในเอกสารนับที่ยังไม่มีไฟล์ใน public/products"
      nav={<AdminNav />}
      actions={<LogoutButton onClick={handleLogout} />}
    >
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <FormCardsSkeleton cards={2} />
      ) : !report ? null : (
        <>
          <div className="mb-5 grid gap-3 sm:grid-cols-3">
            <SummaryCard
              label="รหัสทั้งหมด"
              value={report.summary.totalProductCodes}
            />
            <SummaryCard
              label="มีรูป"
              value={report.summary.withImage}
              tone="ok"
            />
            <SummaryCard
              label="ไม่มีรูป"
              value={report.summary.missingImage}
              tone="bad"
            />
          </div>

          {report.missing.length === 0 ? (
            <p className="py-12 text-center text-muted-foreground">
              ทุกรหัสในเอกสารมีรูปแล้ว
            </p>
          ) : (
            <>
              <div className="mb-3 max-w-md">
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="ค้นหารหัสหรือชื่อสินค้า"
                />
              </div>

              {filtered.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  ไม่พบรหัสที่ตรงกับคำค้น
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[36rem] text-left text-sm">
                    <thead>
                      <tr className="border-b text-muted-foreground">
                        <th className="py-2 pr-4 font-medium">รหัส</th>
                        <th className="py-2 pr-4 font-medium">ชื่อสินค้า</th>
                        <th className="py-2 pr-4 font-medium">สถานะรูป</th>
                        <th className="py-2 font-medium">เอกสาร</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((row) => {
                        const open = expanded === row.productCode;
                        return (
                          <tr
                            key={row.productCode}
                            className="border-b border-border/70 align-top"
                          >
                            <td className="py-3 pr-4" colSpan={4}>
                              <button
                                type="button"
                                className="flex w-full items-start justify-between gap-3 text-left"
                                onClick={() =>
                                  setExpanded(open ? null : row.productCode)
                                }
                                aria-expanded={open}
                              >
                                <div className="min-w-0">
                                  <p className="font-medium tabular-nums">
                                    {row.productCode}
                                  </p>
                                  <p className="text-muted-foreground">
                                    {row.productName}
                                  </p>
                                </div>
                                <div className="shrink-0 text-right">
                                  <span className="inline-block rounded bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                                    ไม่มีรูป
                                  </span>
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    {row.documents.length} เอกสาร{" "}
                                    {open ? "▴" : "▾"}
                                  </p>
                                </div>
                              </button>
                              {open && (
                                <ul className="mt-3 space-y-2 border-t border-border/70 pt-3">
                                  {row.documents.map((doc) => (
                                    <li
                                      key={doc.documentId}
                                      className="flex flex-wrap items-center gap-2 text-sm"
                                    >
                                      <Link
                                        href={documentDetailHref(
                                          doc.status,
                                          doc.documentId,
                                        )}
                                        className="font-medium text-foreground underline-offset-4 hover:underline"
                                      >
                                        {doc.documentNo}
                                      </Link>
                                      <span className="text-muted-foreground">
                                        · {doc.branchCode} {doc.branchName}
                                      </span>
                                      <DocumentStatusBadge
                                        status={doc.status}
                                        compact
                                      />
                                      {showsCountReview(doc.status) ? (
                                        <Link
                                          href={`/admin/documents/${doc.documentId}`}
                                          className="text-xs text-muted-foreground underline-offset-4 hover:underline"
                                        >
                                          ประวัติ
                                        </Link>
                                      ) : null}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </>
      )}
    </PageShell>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "ok" | "bad";
}) {
  return (
    <div className="rounded-lg border bg-background px-4 py-3">
      <p
        className={cn(
          "text-2xl font-semibold tabular-nums",
          tone === "ok" && "text-emerald-700",
          tone === "bad" && "text-red-700",
        )}
      >
        {value.toLocaleString("th-TH")}
      </p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
