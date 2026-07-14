"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AdminNav } from "@/components/AdminNav";
import { AuditLogPanel } from "@/components/AuditLogPanel";
import { DocumentStatusBadge } from "@/components/DocumentStatusBadge";
import { ExpressPushBadge } from "@/components/ExpressPushBadge";
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
  const [pushNotice, setPushNotice] = useState<string | null>(null);

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
  const alreadyPushed = Boolean(document.lastExpressPushAt);

  function handlePushed(message: string) {
    setPushNotice(message);
    setHistory((prev) =>
      prev
        ? {
            ...prev,
            document: {
              ...prev.document,
              lastExpressPushAt: new Date().toISOString(),
            },
          }
        : prev,
    );
  }

  return (
    <PageShell
      title={document.documentNo}
      subtitle={`${document.documentDate} · ${location} · V${document.currentVersionNo || "—"}`}
      actions={<LogoutButton onClick={handleLogout} />}
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
      {pushNotice && (
        <Alert className="mb-4 border-emerald-200 bg-emerald-50 text-emerald-950">
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            <span>{pushNotice}</span>
            <button
              type="button"
              className="text-xs font-medium underline-offset-2 hover:underline"
              onClick={() => setPushNotice(null)}
            >
              ปิด
            </button>
          </AlertDescription>
        </Alert>
      )}

      <div className="mb-4 flex flex-col gap-3 rounded-xl border bg-background px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <DocumentStatusBadge status={document.status} compact />
          {document.status === DocumentStatus.COMPLETED ? (
            <ExpressPushBadge at={document.lastExpressPushAt} />
          ) : (
            <p className="text-sm text-muted-foreground">
              พิมพ์ / ส่ง Express ได้เมื่อสถานะเสร็จสิ้น
            </p>
          )}
        </div>
        {document.status === DocumentStatus.COMPLETED && (
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/print/documents/${documentId}`}
              className={buttonVariants({ size: "sm" })}
              target="_blank"
              rel="noreferrer"
            >
              พิมพ์
            </Link>
            <PushExpressButton
              documentId={documentId}
              alreadyPushed={alreadyPushed}
              onPushed={handlePushed}
            />
          </div>
        )}
      </div>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {latestRecountReason && (
        <p className="mb-4 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">ขอนับใหม่ล่าสุด:</span>{" "}
          {latestRecountReason}
        </p>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="audit">ประวัติการทำงาน</TabsTrigger>
          <TabsTrigger value="versions">เปรียบเทียบเวอร์ชัน</TabsTrigger>
        </TabsList>

        <TabsContent value="audit">
          <Card>
            <CardHeader className="pb-3">
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
