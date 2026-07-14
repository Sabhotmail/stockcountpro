"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { DocumentStatusBadge } from "@/components/DocumentStatusBadge";
import { ExpressSyncPanel } from "@/components/ExpressSyncPanel";
import { TableRowsSkeleton } from "@/components/loading/PageSkeletons";
import { LogoutButton, PageShell } from "@/components/PageShell";
import { SupervisorNav } from "@/components/SupervisorNav";
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
import { canSupervise } from "@/lib/permissions";
import { DocumentStatus, type CountDocumentListItem } from "@/types/count";
import { UserRole } from "@/types/user";

type FilterKey = "all" | "not_started" | "counting" | "recount";

export default function TabletDocumentsPage() {
  const router = useRouter();
  const [documents, setDocuments] = useState<CountDocumentListItem[]>([]);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startingId, setStartingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);

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
        const [docsRes, meRes] = await Promise.all([
          fetch("/api/count-documents"),
          fetch("/api/me", { credentials: "same-origin" }),
        ]);
        if (docsRes.status === 401 || meRes.status === 401) {
          router.push("/login");
          return;
        }
        if (!docsRes.ok) throw new Error("Failed to load documents");
        const data = await docsRes.json();
        if (meRes.ok) {
          const meData = (await meRes.json()) as { user?: { role?: UserRole } };
          if (!cancelled && meData.user?.role) {
            setRole(meData.user.role);
          }
        }
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

  const showSupervisorNav = role ? canSupervise(role) : false;

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

  async function handleDelete(doc: CountDocumentListItem) {
    if (doc.status !== DocumentStatus.IMPORTED) return;

    const confirmed = window.confirm(
      `ลบเอกสารนี้?\n${doc.documentNo}\n\nลบได้เฉพาะเอกสารที่ยังไม่เริ่มนับ`,
    );
    if (!confirmed) return;

    setDeletingId(doc.id);
    setError(null);
    try {
      const res = await fetch(`/api/count-documents/${doc.id}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      const data = (await res.json()) as { error?: string };
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      if (res.status === 404) {
        setDocuments((current) => current.filter((item) => item.id !== doc.id));
        return;
      }
      if (!res.ok) throw new Error(data.error ?? "ลบเอกสารไม่สำเร็จ");
      setDocuments((current) => current.filter((item) => item.id !== doc.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "ลบเอกสารไม่สำเร็จ");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <PageShell
      title="เอกสารนับสต็อก"
      subtitle="Tablet — รายการเอกสาร"
      nav={showSupervisorNav ? <SupervisorNav /> : undefined}
      actions={<LogoutButton onClick={handleLogout} />}
    >
      <ExpressSyncPanel onSynced={() => void loadDocuments()} />

      <Tabs
        value={filter}
        onValueChange={(value) => setFilter(value as FilterKey)}
        className="mb-4"
      >
        <TabsList className="flex h-auto w-full flex-nowrap justify-start gap-1 overflow-x-auto p-1">
          <TabsTrigger value="all" className="min-h-11 flex-1 px-3 py-2.5">
            ทั้งหมด
          </TabsTrigger>
          <TabsTrigger
            value="not_started"
            className="min-h-11 flex-1 px-3 py-2.5"
          >
            ยังไม่เริ่ม
          </TabsTrigger>
          <TabsTrigger value="counting" className="min-h-11 flex-1 px-3 py-2.5">
            กำลังนับ
          </TabsTrigger>
          <TabsTrigger value="recount" className="min-h-11 flex-1 px-3 py-2.5">
            ขอนับใหม่
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {loading && <TableRowsSkeleton rows={6} />}

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4">
        {filtered.map((doc) => (
          <Card key={doc.id}>
            <CardHeader className="flex flex-col gap-4 space-y-0 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
              <div className="min-w-0">
                <CardTitle className="text-xl">{doc.documentNo}</CardTitle>
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
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
                {doc.status === DocumentStatus.IMPORTED && (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={deletingId === doc.id || startingId === doc.id}
                    onClick={() => void handleDelete(doc)}
                    size="lg"
                    className="min-h-11 w-full sm:w-auto"
                  >
                    {deletingId === doc.id ? "กำลังลบ..." : "ลบ"}
                  </Button>
                )}
                <Button
                  type="button"
                  disabled={startingId === doc.id || deletingId === doc.id}
                  onClick={() => void handleOpen(doc)}
                  size="lg"
                  className="min-h-11 w-full sm:w-auto"
                >
                  {startingId === doc.id
                    ? "กำลังเปิด..."
                    : doc.status === DocumentStatus.IMPORTED ||
                        doc.status === DocumentStatus.RECOUNT_REQUESTED
                      ? "เริ่มนับ"
                      : "เปิดเอกสาร"}
                </Button>
              </div>
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
          <div className="rounded-lg border border-dashed px-4 py-6 text-center">
            <p className="font-medium">ยังไม่มีเอกสาร</p>
            <p className="mt-1 text-sm text-muted-foreground">
              เลือกวันที่ด้านบน แล้วกด 「โหลดคลัง」 และ Sync จาก Express
            </p>
          </div>
        )}
      </div>
    </PageShell>
  );
}
