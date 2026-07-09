"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AdminNav } from "@/components/AdminNav";
import { AuditLogPanel } from "@/components/AuditLogPanel";
import { LogoutButton, PageShell } from "@/components/PageShell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AuditLog } from "@/types/audit";

export default function AdminAuditLogsPage() {
  const router = useRouter();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [documentId, setDocumentId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadLogs = useCallback(
    async (filterDocumentId?: string) => {
      setLoading(true);
      setError(null);
      try {
        const query = filterDocumentId
          ? `?documentId=${encodeURIComponent(filterDocumentId)}`
          : "";
        const res = await fetch(`/api/admin/audit-logs${query}`, {
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
        const data = await res.json();
        setLogs(data.logs);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Load failed");
      } finally {
        setLoading(false);
      }
    },
    [router],
  );

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    router.push("/login");
  }

  function handleFilter(e: React.FormEvent) {
    e.preventDefault();
    loadLogs(documentId.trim() || undefined);
  }

  return (
    <PageShell
      title="Audit Log"
      subtitle="ประวัติการใช้งานระบบ"
      actions={<LogoutButton onClick={handleLogout} />}
      nav={<AdminNav />}
    >
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card className="mb-4">
        <CardContent className="pt-6">
          <form onSubmit={handleFilter} className="flex flex-wrap items-end gap-3">
            <div className="min-w-[200px] flex-1 space-y-2">
              <Label htmlFor="document-id-filter">กรองตาม Document ID</Label>
              <Input
                id="document-id-filter"
                value={documentId}
                onChange={(e) => setDocumentId(e.target.value)}
                placeholder="เช่น doc_bkk1_001"
              />
            </div>
            <Button type="submit">กรอง</Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDocumentId("");
                loadLogs();
              }}
            >
              แสดงทั้งหมด
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {loading ? "กำลังโหลด..." : `แสดง ${logs.length} รายการ`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!loading && <AuditLogPanel logs={logs} />}
        </CardContent>
      </Card>
    </PageShell>
  );
}
