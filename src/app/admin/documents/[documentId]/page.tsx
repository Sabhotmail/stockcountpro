"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AdminNav } from "@/components/AdminNav";
import { AuditLogPanel } from "@/components/AuditLogPanel";
import { DocumentStatusBadge } from "@/components/DocumentStatusBadge";
import { DetailSkeleton } from "@/components/loading/PageSkeletons";
import { LogoutButton, PageShell } from "@/components/PageShell";
import { PushExpressButton } from "@/components/PushExpressButton";
import { VersionCompareDetail } from "@/components/VersionCompareDetail";
import { VersionCompareTable } from "@/components/VersionCompareTable";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { AuditLog } from "@/types/audit";
import {
  DocumentStatus,
  type CountDocumentListItem,
  type CountVersion,
  type VersionCompareResult,
} from "@/types/count";

const selectClassName = cn(
  "h-8 w-full min-w-[8rem] rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
);

type HistoryResponse = {
  document: CountDocumentListItem;
  auditLogs: AuditLog[];
  latestRecountReason: string | null;
};

export default function AdminDocumentHistoryPage() {
  const params = useParams<{ documentId: string }>();
  const router = useRouter();
  const documentId = params.documentId;

  const [history, setHistory] = useState<HistoryResponse | null>(null);
  const [versions, setVersions] = useState<CountVersion[]>([]);
  const [fromVersion, setFromVersion] = useState<number | null>(null);
  const [toVersion, setToVersion] = useState<number | null>(null);
  const [compare, setCompare] = useState<VersionCompareResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState("audit");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/admin/count-documents/${documentId}`, {
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
        if (res.status === 404) throw new Error("ไม่พบเอกสาร");
        if (!res.ok) throw new Error("โหลดประวัติไม่สำเร็จ");
        const data = (await res.json()) as HistoryResponse;
        if (!cancelled) setHistory(data);
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

  useEffect(() => {
    if (tab !== "versions" || versions.length > 0) return;

    let cancelled = false;

    async function loadVersions() {
      setVersionsLoading(true);
      try {
        const res = await fetch(`/api/count-documents/${documentId}/versions`, {
          credentials: "same-origin",
        });
        if (!res.ok) throw new Error("โหลดเวอร์ชันไม่สำเร็จ");
        const data = (await res.json()) as { versions: CountVersion[] };
        if (cancelled) return;
        const list = data.versions;
        setVersions(list);
        if (list.length >= 2) {
          setFromVersion(list[list.length - 2].versionNo);
          setToVersion(list[list.length - 1].versionNo);
        } else if (list.length === 1) {
          setFromVersion(list[0].versionNo);
          setToVersion(list[0].versionNo);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Load versions failed");
        }
      } finally {
        if (!cancelled) setVersionsLoading(false);
      }
    }

    void loadVersions();
    return () => {
      cancelled = true;
    };
  }, [tab, documentId, versions.length]);

  const canCompare = useMemo(
    () =>
      fromVersion !== null &&
      toVersion !== null &&
      fromVersion !== toVersion,
    [fromVersion, toVersion],
  );

  async function handleCompare() {
    if (!canCompare || fromVersion === null || toVersion === null) return;
    setComparing(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/count-documents/${documentId}/versions/compare?from=${fromVersion}&to=${toVersion}`,
        { credentials: "same-origin" },
      );
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "Compare failed");
      }
      const data = (await res.json()) as { compare: VersionCompareResult };
      setCompare(data.compare);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Compare failed");
    } finally {
      setComparing(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    router.push("/login");
  }

  if (loading) {
    return (
      <PageShell title="ประวัติเอกสาร" subtitle="กำลังโหลด..." nav={<AdminNav />}>
        <DetailSkeleton />
      </PageShell>
    );
  }

  if (!history) {
    return (
      <PageShell title="ไม่พบเอกสาร" nav={<AdminNav />}>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <Link
          href="/admin/documents"
          className={buttonVariants({ variant: "outline" })}
        >
          ← กลับรายการ
        </Link>
      </PageShell>
    );
  }

  const { document, auditLogs, latestRecountReason } = history;
  const location =
    `${document.locationCode ?? document.branchCode}` +
    (document.locationName ? ` · ${document.locationName}` : ` · ${document.branchName}`);

  return (
    <PageShell
      title={document.documentNo}
      subtitle={`${document.documentDate} · ${location} · V${document.currentVersionNo || "—"}`}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <DocumentStatusBadge status={document.status} compact />
          {document.status === DocumentStatus.COMPLETED && (
            <>
              <Link
                href={`/print/documents/${documentId}`}
                className={buttonVariants({ size: "sm" })}
                target="_blank"
                rel="noreferrer"
              >
                พิมพ์เอกสาร
              </Link>
              <PushExpressButton documentId={documentId} />
            </>
          )}
          <LogoutButton onClick={handleLogout} />
        </div>
      }
      nav={
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href="/admin/documents"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            ← กลับรายการ
          </Link>
          <AdminNav />
        </div>
      }
    >
      {document.status === DocumentStatus.COMPLETED ? (
        <Alert className="mb-4 border-green-200 bg-green-50 text-green-950">
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>เอกสารเสร็จสิ้นแล้ว — พิมพ์ใบตรวจนับพร้อมช่องลายเซ็นได้ หรือส่งผลกลับ Express</span>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/print/documents/${documentId}`}
                className={buttonVariants({ size: "sm" })}
                target="_blank"
                rel="noreferrer"
              >
                พิมพ์เอกสาร
              </Link>
              <PushExpressButton documentId={documentId} />
            </div>
          </AlertDescription>
        </Alert>
      ) : (
        <Alert className="mb-4">
          <AlertDescription>
            ปุ่มพิมพ์จะแสดงเมื่อเอกสารสถานะเสร็จสิ้น (หลัง Supervisor
            อนุมัติแล้ว)
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {latestRecountReason && (
        <Alert className="mb-4 border-orange-200 bg-orange-50 text-orange-950">
          <AlertDescription>
            <span className="font-medium">เหตุผลขอนับใหม่ล่าสุด: </span>
            {latestRecountReason}
          </AlertDescription>
        </Alert>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="audit">ประวัติการทำงาน</TabsTrigger>
          <TabsTrigger value="versions">เปรียบเทียบเวอร์ชัน</TabsTrigger>
        </TabsList>

        <TabsContent value="audit">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Audit Log ({auditLogs.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <AuditLogPanel logs={auditLogs} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="versions" className="space-y-4">
          {versionsLoading && <DetailSkeleton />}

          {!versionsLoading && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">รายการเวอร์ชัน</CardTitle>
                </CardHeader>
                <CardContent>
                  <VersionCompareTable versions={versions} />
                </CardContent>
              </Card>

              {versions.length >= 2 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">เลือกเวอร์ชันเปรียบเทียบ</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap items-end gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="from-version">จาก</Label>
                        <select
                          id="from-version"
                          value={fromVersion ?? ""}
                          onChange={(e) =>
                            setFromVersion(Number.parseInt(e.target.value, 10))
                          }
                          className={selectClassName}
                        >
                          {versions.map((version) => (
                            <option key={version.id} value={version.versionNo}>
                              V{version.versionNo}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="to-version">เป็น</Label>
                        <select
                          id="to-version"
                          value={toVersion ?? ""}
                          onChange={(e) =>
                            setToVersion(Number.parseInt(e.target.value, 10))
                          }
                          className={selectClassName}
                        >
                          {versions.map((version) => (
                            <option key={version.id} value={version.versionNo}>
                              V{version.versionNo}
                            </option>
                          ))}
                        </select>
                      </div>
                      <Button
                        type="button"
                        onClick={() => void handleCompare()}
                        disabled={!canCompare || comparing}
                      >
                        {comparing ? "กำลังเปรียบเทียบ..." : "เปรียบเทียบ"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {compare && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">ผลการเปรียบเทียบ</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <VersionCompareDetail compare={compare} />
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}
