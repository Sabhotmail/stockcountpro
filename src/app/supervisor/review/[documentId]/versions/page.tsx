"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PageShell } from "@/components/PageShell";
import { SupervisorNav } from "@/components/SupervisorNav";
import { VersionCompareDetail } from "@/components/VersionCompareDetail";
import { VersionCompareTable } from "@/components/VersionCompareTable";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { CountVersion, VersionCompareResult } from "@/types/count";

const selectClassName = cn(
  "h-8 w-full min-w-[8rem] rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
);

export default function SupervisorVersionsPage() {
  const params = useParams<{ documentId: string }>();
  const router = useRouter();
  const documentId = params.documentId;

  const [versions, setVersions] = useState<CountVersion[]>([]);
  const [fromVersion, setFromVersion] = useState<number | null>(null);
  const [toVersion, setToVersion] = useState<number | null>(null);
  const [compare, setCompare] = useState<VersionCompareResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [comparing, setComparing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadVersions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/count-documents/${documentId}/versions`);
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      if (!res.ok) throw new Error("Failed to load versions");
      const data = await res.json();
      const list = data.versions as CountVersion[];
      setVersions(list);
      if (list.length >= 2) {
        setFromVersion(list[list.length - 2].versionNo);
        setToVersion(list[list.length - 1].versionNo);
      } else if (list.length === 1) {
        setFromVersion(list[0].versionNo);
        setToVersion(list[0].versionNo);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, [documentId, router]);

  useEffect(() => {
    loadVersions();
  }, [loadVersions]);

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
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Compare failed");
      }
      const data = await res.json();
      setCompare(data.compare);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Compare failed");
    } finally {
      setComparing(false);
    }
  }

  if (loading) {
    return (
      <PageShell title="เปรียบเทียบเวอร์ชัน" subtitle="กำลังโหลด...">
        <p className="py-12 text-center text-muted-foreground">กำลังโหลดเวอร์ชัน...</p>
      </PageShell>
    );
  }

  return (
    <PageShell
      title="เปรียบเทียบเวอร์ชัน"
      nav={
        <div className="space-y-3">
          <Link
            href={`/supervisor/review/${documentId}`}
            className={cn(buttonVariants({ variant: "link" }), "h-auto p-0")}
          >
            ← กลับหน้าตรวจสอบ
          </Link>
          <SupervisorNav />
        </div>
      }
    >
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">รายการเวอร์ชัน</CardTitle>
        </CardHeader>
        <CardContent>
          <VersionCompareTable versions={versions} />
        </CardContent>
      </Card>

      {versions.length >= 2 && (
        <Card className="mb-6">
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
                onClick={handleCompare}
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
    </PageShell>
  );
}
