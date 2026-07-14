"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AdminNav } from "@/components/AdminNav";
import { AuditLogPanel } from "@/components/AuditLogPanel";
import { DetailSkeleton } from "@/components/loading/PageSkeletons";
import { LogoutButton, PageShell } from "@/components/PageShell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DateInputDMY } from "@/components/DateInputDMY";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { AuditLog } from "@/types/audit";

export default function AdminAuditLogsPage() {
  const router = useRouter();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [q, setQ] = useState("");
  const [documentDate, setDocumentDate] = useState("");
  const [documentId, setDocumentId] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadLogs(filters?: {
    q?: string;
    documentDate?: string;
    documentId?: string;
  }) {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filters?.documentId) params.set("documentId", filters.documentId);
      if (filters?.q) params.set("q", filters.q);
      if (filters?.documentDate) params.set("documentDate", filters.documentDate);
      const query = params.toString();
      const res = await fetch(`/api/admin/audit-logs${query ? `?${query}` : ""}`, {
        credentials: "same-origin",
      });
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      if (res.status === 403) {
        router.push("/tablet/documents");
        return;
      }
      if (!res.ok) throw new Error("Failed to load audit logs");
      const data = (await res.json()) as {
        logs: AuditLog[];
        truncated?: boolean;
      };
      setLogs(data.logs);
      setTruncated(Boolean(data.truncated));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial load only
  }, [router]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    router.push("/login");
  }

  function handleFilter(e: React.FormEvent) {
    e.preventDefault();
    void loadLogs({
      q: q.trim() || undefined,
      documentDate: documentDate.trim() || undefined,
      documentId: documentId.trim() || undefined,
    });
  }

  function handleClear() {
    setQ("");
    setDocumentDate("");
    setDocumentId("");
    void loadLogs();
  }

  return (
    <PageShell
      title="Audit Log"
      subtitle="ประวัติการใช้งานระบบทั้งองค์กร"
      actions={<LogoutButton onClick={handleLogout} />}
      nav={<AdminNav />}
    >
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card className="mb-4">
        <CardContent className="space-y-4 pt-6">
          <form
            onSubmit={handleFilter}
            className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end"
          >
            <div className="min-w-[200px] flex-1 space-y-2">
              <Label htmlFor="audit-search">ค้นหา</Label>
              <Input
                id="audit-search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="เลขเอกสาร หรือรหัสคลัง"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="audit-date">วันที่เอกสาร</Label>
              <DateInputDMY
                id="audit-date"
                value={documentDate}
                onChange={setDocumentDate}
                className="w-full sm:w-44"
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit">ค้นหา</Button>
              <Button type="button" variant="outline" onClick={handleClear}>
                ล้าง
              </Button>
            </div>
          </form>

          <div className="flex flex-wrap items-center gap-3 text-sm">
            <button
              type="button"
              className="text-muted-foreground underline-offset-2 hover:underline"
              onClick={() => setShowAdvanced((v) => !v)}
            >
              {showAdvanced ? "ซ่อนขั้นสูง" : "ขั้นสูง (Document ID)"}
            </button>
            <Link
              href="/admin/documents"
              className={cn(buttonVariants({ variant: "link" }), "h-auto p-0")}
            >
              หาจากรายการเอกสาร →
            </Link>
          </div>

          {showAdvanced && (
            <div className="max-w-md space-y-2">
              <Label htmlFor="document-id-filter">Document ID</Label>
              <Input
                id="document-id-filter"
                value={documentId}
                onChange={(e) => setDocumentId(e.target.value)}
                placeholder="เช่น doc_bkk3_20260713_loc_2411"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {truncated && (
        <Alert className="mb-4">
          <AlertDescription>
            แสดงสูงสุด 500 รายการ — ลองจำกัดคำค้นหรือวันที่ให้แคบลง
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {loading ? "กำลังโหลด..." : `แสดง ${logs.length} รายการ`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? <DetailSkeleton /> : <AuditLogPanel logs={logs} />}
        </CardContent>
      </Card>
    </PageShell>
  );
}
