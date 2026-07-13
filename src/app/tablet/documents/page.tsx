"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { DocumentStatusBadge } from "@/components/DocumentStatusBadge";
import { ExpressSyncPanel } from "@/components/ExpressSyncPanel";
import { LogoutButton, PageShell } from "@/components/PageShell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DocumentStatus, type CountDocumentListItem } from "@/types/count";

type FilterKey = "all" | "not_started" | "counting" | "recount";

export default function TabletDocumentsPage() {
  const router = useRouter();
  const [documents, setDocuments] = useState<CountDocumentListItem[]>([]);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
      <ExpressSyncPanel onSynced={() => void loadDocuments()} />

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
                  {doc.documentDate}
                  {doc.locationCode ? ` · ${doc.locationCode}` : ""}
                  {doc.locationName ? ` · ${doc.locationName}` : ""}
                  {doc.hubShortName
                    ? ` · Hub ${doc.hubShortName}`
                    : doc.isCentral
                      ? " · HQ กลาง"
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
