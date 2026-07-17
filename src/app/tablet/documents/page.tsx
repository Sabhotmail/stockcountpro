"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ExpressSyncPanel } from "@/components/ExpressSyncPanel";
import { TableRowsSkeleton } from "@/components/loading/PageSkeletons";
import { LogoutButton, PageShell } from "@/components/PageShell";
import { SupervisorNav } from "@/components/SupervisorNav";
import { TabletDocumentRow } from "@/components/TabletDocumentRow";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DocumentSearchInput } from "@/components/DocumentSearchInput";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { canSupervise } from "@/lib/permissions";
import { DocumentStatus, type CountDocumentListItem } from "@/types/count";
import { UserRole } from "@/types/user";

type FilterKey = "all" | "not_started" | "counting" | "recount";

function matchesSearch(doc: CountDocumentListItem, term: string): boolean {
  if (!term) return true;
  const haystack = [
    doc.documentNo,
    doc.locationCode,
    doc.locationName,
    doc.hubShortName,
    doc.hubName,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(term);
}

function thaiLoadError(fallback: string): string {
  if (fallback === "Failed to load documents" || fallback === "Load failed") {
    return "โหลดเอกสารไม่สำเร็จ";
  }
  if (fallback === "Cannot start document" || fallback === "Start failed") {
    return "เปิดเอกสารไม่สำเร็จ";
  }
  return fallback;
}

export default function TabletDocumentsPage() {
  const router = useRouter();
  const [documents, setDocuments] = useState<CountDocumentListItem[]>([]);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");
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
      if (!res.ok) throw new Error("โหลดเอกสารไม่สำเร็จ");
      const data = await res.json();
      setDocuments(data.documents);
    } catch (err) {
      setError(
        thaiLoadError(err instanceof Error ? err.message : "โหลดเอกสารไม่สำเร็จ"),
      );
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
        if (!docsRes.ok) throw new Error("โหลดเอกสารไม่สำเร็จ");
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
          setError(
            thaiLoadError(
              err instanceof Error ? err.message : "โหลดเอกสารไม่สำเร็จ",
            ),
          );
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

  const counts = useMemo(
    () => ({
      all: documents.length,
      not_started: documents.filter((d) => d.status === DocumentStatus.IMPORTED)
        .length,
      counting: documents.filter((d) => d.status === DocumentStatus.COUNTING)
        .length,
      recount: documents.filter(
        (d) => d.status === DocumentStatus.RECOUNT_REQUESTED,
      ).length,
    }),
    [documents],
  );

  const searchTerm = search.trim().toLowerCase();

  const filtered = useMemo(() => {
    return documents.filter((doc) => {
      if (!matchesSearch(doc, searchTerm)) return false;
      if (filter === "all") return true;
      if (filter === "not_started") return doc.status === DocumentStatus.IMPORTED;
      if (filter === "counting") return doc.status === DocumentStatus.COUNTING;
      if (filter === "recount")
        return doc.status === DocumentStatus.RECOUNT_REQUESTED;
      return true;
    });
  }, [documents, filter, searchTerm]);

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
          throw new Error(data.error ?? "เปิดเอกสารไม่สำเร็จ");
        }
      } catch (err) {
        setError(
          thaiLoadError(err instanceof Error ? err.message : "เปิดเอกสารไม่สำเร็จ"),
        );
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
      subtitle={
        loading ? "กำลังโหลด..." : `${documents.length} เอกสาร`
      }
      nav={showSupervisorNav ? <SupervisorNav /> : undefined}
      actions={<LogoutButton onClick={handleLogout} />}
    >
      <ExpressSyncPanel onSynced={() => void loadDocuments()} />

      <DocumentSearchInput
        value={search}
        onChange={setSearch}
        className="mb-3"
      />

      <Tabs
        value={filter}
        onValueChange={(value) => setFilter(value as FilterKey)}
        className="mb-3"
      >
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 overflow-visible bg-transparent p-0 group-data-horizontal/tabs:h-auto">
          <TabsTrigger
            value="all"
            className="h-auto min-h-10 flex-none rounded-md px-3 py-2 data-[state=active]:bg-muted"
          >
            ทั้งหมด ({counts.all})
          </TabsTrigger>
          <TabsTrigger
            value="not_started"
            className="h-auto min-h-10 flex-none rounded-md px-3 py-2 data-[state=active]:bg-muted"
          >
            ยังไม่เริ่ม ({counts.not_started})
          </TabsTrigger>
          <TabsTrigger
            value="counting"
            className="h-auto min-h-10 flex-none rounded-md px-3 py-2 data-[state=active]:bg-muted"
          >
            กำลังนับ ({counts.counting})
          </TabsTrigger>
          <TabsTrigger
            value="recount"
            className="h-auto min-h-10 flex-none rounded-md px-3 py-2 data-[state=active]:bg-muted"
          >
            ขอนับใหม่ ({counts.recount})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {loading && <TableRowsSkeleton rows={6} />}

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!loading && filtered.length > 0 && (
        <section className="divide-y divide-border/70">
          {filtered.map((doc) => (
            <TabletDocumentRow
              key={doc.id}
              doc={doc}
              starting={startingId === doc.id}
              deleting={deletingId === doc.id}
              onOpen={() => void handleOpen(doc)}
              onDelete={() => void handleDelete(doc)}
            />
          ))}
        </section>
      )}

      {!loading && filtered.length === 0 && searchTerm && (
        <div className="py-10 text-center">
          <p className="font-medium">ไม่พบเอกสารที่ตรงกับ「{search.trim()}」</p>
          <p className="mt-1 text-sm text-muted-foreground">
            ลองแก้คำค้นหา หรือล้างการค้นหาเพื่อดูทั้งหมด
          </p>
        </div>
      )}

      {!loading && filtered.length === 0 && !searchTerm && filter === "all" && (
        <div className="py-10 text-center">
          <p className="font-medium">ยังไม่มีเอกสาร</p>
          <p className="mt-1 text-sm text-muted-foreground">
            เปิด Sync จาก Express ด้านบน แล้วโหลดคลังตามวันที่ตรวจนับ
          </p>
        </div>
      )}

      {!loading && filtered.length === 0 && !searchTerm && filter !== "all" && (
        <div className="py-10 text-center">
          <p className="font-medium">ไม่พบเอกสารในสถานะนี้</p>
          <p className="mt-1 text-sm text-muted-foreground">
            เปลี่ยนแท็บหรือเลือก 「ทั้งหมด」 เพื่อดูรายการอื่น
          </p>
        </div>
      )}
    </PageShell>
  );
}
