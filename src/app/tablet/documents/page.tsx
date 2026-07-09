"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { DocumentStatusBadge } from "@/components/DocumentStatusBadge";
import { LogoutButton, PageShell } from "@/components/PageShell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { todayDateKeyBangkok } from "@/lib/datetime";
import type { ExpressSyncBranchResult } from "@/services/express-sync.service";
import { DocumentStatus, type CountDocumentListItem } from "@/types/count";

type FilterKey = "all" | "not_started" | "counting" | "recount";

export default function TabletDocumentsPage() {
  const router = useRouter();
  const [documents, setDocuments] = useState<CountDocumentListItem[]>([]);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [syncResults, setSyncResults] = useState<ExpressSyncBranchResult[] | null>(
    null,
  );
  const [countDate, setCountDate] = useState(todayDateKeyBangkok());
  const [syncing, setSyncing] = useState(false);
  const [startingId, setStartingId] = useState<string | null>(null);

  async function loadDocuments() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/count-documents");
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      if (!res.ok) throw new Error("Failed to load documents");
      const data = await res.json();
      setDocuments(data.documents);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/count-documents");
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        if (!res.ok) throw new Error("Failed to load documents");
        const data = await res.json();
        if (!cancelled) setDocuments(data.documents);
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
  }, [router]);

  const filtered = useMemo(() => {
    return documents.filter((doc) => {
      if (filter === "all") return true;
      if (filter === "not_started") return doc.status === DocumentStatus.IMPORTED;
      if (filter === "counting") return doc.status === DocumentStatus.COUNTING;
      if (filter === "recount")
        return doc.status === DocumentStatus.RECOUNT_REQUESTED;
      return true;
    });
  }, [documents, filter]);

  async function handleSync() {
    setSyncing(true);
    setError(null);
    setSyncMessage(null);
    setSyncResults(null);

    try {
      const res = await fetch("/api/express/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ date: countDate }),
      });

      if (res.status === 401) {
        router.push("/login");
        return;
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Sync failed");

      const created = data.results.filter(
        (item: ExpressSyncBranchResult) => item.status === "created",
      ).length;
      const updated = data.results.filter(
        (item: ExpressSyncBranchResult) => item.status === "updated",
      ).length;
      const skipped = data.results.filter(
        (item: ExpressSyncBranchResult) => item.status === "skipped",
      ).length;

      setSyncResults(data.results);
      setSyncMessage(
        `Sync สำเร็จ: สร้างใหม่ ${created}, อัปเดต ${updated}, ข้าม ${skipped}`,
      );
      await loadDocuments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  async function handleOpen(doc: CountDocumentListItem) {
    if (
      doc.status === DocumentStatus.IMPORTED ||
      doc.status === DocumentStatus.RECOUNT_REQUESTED
    ) {
      setStartingId(doc.id);
      try {
        const res = await fetch(`/api/count-documents/${doc.id}/start`, {
          method: "POST",
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error ?? "Cannot start document");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Start failed");
        setStartingId(null);
        return;
      }
      setStartingId(null);
    }
    router.push(`/tablet/count/${doc.id}`);
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <PageShell
      title="เอกสารนับสต็อก"
      subtitle="Tablet — รายการเอกสาร"
      actions={<LogoutButton onClick={handleLogout} />}
    >
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Sync ใบตรวจนับจาก Express</CardTitle>
          <CardDescription>
            ดึงใบตรวจนับของสาขาที่คุณมีสิทธิ์เข้าถึง — เอกสารที่เริ่มนับแล้วจะไม่ถูกทับ
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="grid w-full max-w-xs gap-2">
            <Label htmlFor="count-date">วันที่ตรวจนับ</Label>
            <Input
              id="count-date"
              type="date"
              value={countDate}
              onChange={(event) => setCountDate(event.target.value)}
            />
          </div>
          <Button
            type="button"
            onClick={handleSync}
            disabled={syncing || loading}
            size="lg"
          >
            {syncing ? "กำลัง Sync..." : "Sync จาก Express"}
          </Button>
        </CardContent>
      </Card>

      {syncMessage && (
        <Alert className="mb-4 border-green-200 bg-green-50 text-green-800">
          <AlertDescription>{syncMessage}</AlertDescription>
        </Alert>
      )}

      {syncResults && syncResults.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">ผลลัพธ์ Sync รายสาขา</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>สาขา</TableHead>
                  <TableHead>สถานะ</TableHead>
                  <TableHead className="text-right">รายการ</TableHead>
                  <TableHead>หมายเหตุ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {syncResults.map((item) => (
                  <TableRow key={`${item.branchCode}-${item.status}-${item.reason ?? ""}`}>
                    <TableCell>
                      {item.branchName
                        ? `${item.branchCode} · ${item.branchName}`
                        : item.branchCode}
                    </TableCell>
                    <TableCell>
                      {item.status === "created"
                        ? "สร้างใหม่"
                        : item.status === "updated"
                          ? "อัปเดต"
                          : "ข้าม"}
                    </TableCell>
                    <TableCell className="text-right">
                      {item.lineCount ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {item.reason ??
                        (item.documentNo ? `เอกสาร ${item.documentNo}` : "—")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Tabs
        value={filter}
        onValueChange={(value) => setFilter(value as FilterKey)}
        className="mb-6"
      >
        <TabsList>
          <TabsTrigger value="all">ทั้งหมด</TabsTrigger>
          <TabsTrigger value="not_started">ยังไม่เริ่ม</TabsTrigger>
          <TabsTrigger value="counting">กำลังนับ</TabsTrigger>
          <TabsTrigger value="recount">ขอนับใหม่</TabsTrigger>
        </TabsList>
      </Tabs>

      {loading && (
        <p className="py-12 text-center text-muted-foreground">กำลังโหลด...</p>
      )}

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4">
        {filtered.map((doc) => (
          <Card key={doc.id}>
            <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4 space-y-0">
              <div>
                <CardTitle>{doc.documentNo}</CardTitle>
                <CardDescription>
                  {doc.documentDate} · {doc.branchCode} {doc.branchName}
                  {doc.branchExpressLocationCode
                    ? ` · Express ${doc.branchExpressLocationCode}`
                    : ""}
                </CardDescription>
              </div>
              <Button
                type="button"
                disabled={startingId === doc.id}
                onClick={() => handleOpen(doc)}
                size="lg"
              >
                {startingId === doc.id
                  ? "กำลังเปิด..."
                  : doc.status === DocumentStatus.IMPORTED ||
                      doc.status === DocumentStatus.RECOUNT_REQUESTED
                    ? "เริ่มนับ"
                    : "เปิดเอกสาร"}
              </Button>
            </CardHeader>
            <CardFooter className="flex flex-wrap items-center gap-3 border-t pt-4">
              <DocumentStatusBadge status={doc.status} />
              <span className="text-sm text-muted-foreground">
                เวอร์ชัน {doc.currentVersionNo || "—"}
              </span>
              <span className="text-sm text-muted-foreground">
                นับแล้ว {doc.countedLines}/{doc.totalLines} รายการ
              </span>
            </CardFooter>
          </Card>
        ))}

        {!loading && filtered.length === 0 && (
          <p className="py-12 text-center text-muted-foreground">ไม่มีเอกสาร</p>
        )}
      </div>
    </PageShell>
  );
}
