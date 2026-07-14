"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { AdminNav } from "@/components/AdminNav";
import { BulkPushExpressToolbar } from "@/components/BulkPushExpressToolbar";
import { DocumentStatusBadge } from "@/components/DocumentStatusBadge";
import { ExpressPushBadge } from "@/components/ExpressPushBadge";
import { TableRowsSkeleton } from "@/components/loading/PageSkeletons";
import { LogoutButton, PageShell } from "@/components/PageShell";
import { PushExpressButton } from "@/components/PushExpressButton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
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
import { cn } from "@/lib/utils";
import { DocumentStatus, type CountDocumentListItem } from "@/types/count";

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "ทั้งหมด" },
  { value: DocumentStatus.IMPORTED, label: "ยังไม่เริ่ม" },
  { value: DocumentStatus.COUNTING, label: "กำลังนับ" },
  { value: DocumentStatus.SUBMITTED, label: "ส่งแล้ว" },
  { value: DocumentStatus.REVIEWING, label: "กำลังตรวจ" },
  { value: DocumentStatus.RECOUNT_REQUESTED, label: "ขอนับใหม่" },
  { value: DocumentStatus.APPROVED, label: "อนุมัติแล้ว" },
  { value: DocumentStatus.COMPLETED, label: "เสร็จสิ้น" },
];

const selectClassName = cn(
  "h-9 w-full min-w-[9rem] rounded-md border border-input bg-background px-3 text-sm",
);

function locationLabel(doc: CountDocumentListItem) {
  const code = doc.locationCode ?? doc.branchCode;
  const name = doc.locationName ?? doc.branchName;
  const hub = doc.hubShortName
    ? ` · Hub ${doc.hubShortName}`
    : doc.isCentral
      ? " · HQ กลาง"
      : "";
  return `${code} · ${name}${hub}`;
}

function isBulkEligible(doc: CountDocumentListItem) {
  return (
    doc.status === DocumentStatus.COMPLETED && !doc.lastExpressPushAt
  );
}

export default function AdminDocumentsPage() {
  const router = useRouter();
  const [documents, setDocuments] = useState<CountDocumentListItem[]>([]);
  const [q, setQ] = useState("");
  const [documentDate, setDocumentDate] = useState("");
  const [status, setStatus] = useState("");
  const [applied, setApplied] = useState({ q: "", documentDate: "", status: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pushNotice, setPushNotice] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const eligibleDocs = useMemo(
    () => documents.filter(isBulkEligible),
    [documents],
  );
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const docLabels = useMemo(() => {
    const map: Record<string, string> = {};
    for (const doc of documents) map[doc.id] = doc.documentNo;
    return map;
  }, [documents]);

  const loadDocuments = useCallback(
    async (filters: { q: string; documentDate: string; status: string }) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (filters.q) params.set("q", filters.q);
        if (filters.documentDate) params.set("documentDate", filters.documentDate);
        if (filters.status) params.set("status", filters.status);
        const query = params.toString();
        const res = await fetch(
          `/api/admin/count-documents${query ? `?${query}` : ""}`,
          { credentials: "same-origin" },
        );
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        if (res.status === 403) {
          router.push("/tablet/documents");
          return;
        }
        if (!res.ok) throw new Error("โหลดรายการเอกสารไม่สำเร็จ");
        const data = (await res.json()) as { documents: CountDocumentListItem[] };
        setDocuments(data.documents);
        setSelectedIds([]);
        setApplied(filters);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Load failed");
      } finally {
        setLoading(false);
      }
    },
    [router],
  );

  useEffect(() => {
    void loadDocuments({ q: "", documentDate: "", status: "" });
  }, [loadDocuments]);

  function handlePushed(documentId: string, message: string) {
    setPushNotice(message);
    setDocuments((prev) =>
      prev.map((doc) =>
        doc.id === documentId
          ? { ...doc, lastExpressPushAt: new Date().toISOString() }
          : doc,
      ),
    );
    setSelectedIds((prev) => prev.filter((id) => id !== documentId));
  }

  function handleBulkComplete(pushedIds: string[]) {
    if (pushedIds.length === 0) return;
    const now = new Date().toISOString();
    setPushNotice(`ส่ง Express แบบชุดสำเร็จ ${pushedIds.length} เอกสาร`);
    setDocuments((prev) =>
      prev.map((doc) =>
        pushedIds.includes(doc.id)
          ? { ...doc, lastExpressPushAt: now }
          : doc,
      ),
    );
    setSelectedIds((prev) => prev.filter((id) => !pushedIds.includes(id)));
  }

  function toggleSelect(documentId: string, next: boolean) {
    setSelectedIds((prev) => {
      if (next) return prev.includes(documentId) ? prev : [...prev, documentId];
      return prev.filter((id) => id !== documentId);
    });
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    router.push("/login");
  }

  function handleSearch(e: FormEvent) {
    e.preventDefault();
    void loadDocuments({
      q: q.trim(),
      documentDate: documentDate.trim(),
      status,
    });
  }

  function handleClear() {
    setQ("");
    setDocumentDate("");
    setStatus("");
    void loadDocuments({ q: "", documentDate: "", status: "" });
  }

  return (
    <PageShell
      title="เอกสาร"
      subtitle="ประวัติเอกสารนับสต็อก — ค้นหาแล้วเปิดดูประวัติ"
      actions={<LogoutButton onClick={handleLogout} />}
      nav={<AdminNav />}
      className="[&_main]:max-w-7xl [&_header>div]:max-w-7xl"
    >
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

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

      <Card className="mb-4">
        <CardContent className="pt-6">
          <form
            onSubmit={handleSearch}
            className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end"
          >
            <div className="min-w-[200px] flex-1 space-y-2">
              <Label htmlFor="doc-search">ค้นหา</Label>
              <Input
                id="doc-search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="เลขเอกสาร หรือรหัส/ชื่อคลัง เช่น 2411"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="doc-date">วันที่</Label>
              <Input
                id="doc-date"
                type="date"
                value={documentDate}
                onChange={(e) => setDocumentDate(e.target.value)}
                className="w-full sm:w-44"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="doc-status">สถานะ</Label>
              <select
                id="doc-status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className={selectClassName}
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value || "all"} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <Button type="submit">ค้นหา</Button>
              <Button type="button" variant="outline" onClick={handleClear}>
                ล้าง
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {loading && <TableRowsSkeleton rows={8} />}

      {!loading && documents.length === 0 && (
        <p className="py-12 text-center text-muted-foreground">
          ไม่พบเอกสารตามเงื่อนไข — ลองล้างตัวกรอง
          {(applied.q || applied.documentDate || applied.status) && (
            <>
              {" · "}
              <button
                type="button"
                className="text-primary underline-offset-2 hover:underline"
                onClick={handleClear}
              >
                ล้างตัวกรอง
              </button>
            </>
          )}
        </p>
      )}

      {!loading && documents.length > 0 && (
        <>
          <p className="mb-3 text-sm text-muted-foreground">
            พบ {documents.length} เอกสาร
          </p>

          <BulkPushExpressToolbar
            selectedIds={selectedIds}
            eligibleCount={eligibleDocs.length}
            onSelectAllEligible={() =>
              setSelectedIds(eligibleDocs.map((d) => d.id))
            }
            onClearSelection={() => setSelectedIds([])}
            onComplete={handleBulkComplete}
            labels={docLabels}
          />

          <div className="flex flex-col gap-3 md:hidden">
            {documents.map((doc) => {
              const pushed = Boolean(doc.lastExpressPushAt);
              const completed = doc.status === DocumentStatus.COMPLETED;
              const eligible = isBulkEligible(doc);
              return (
                <Card
                  key={doc.id}
                  className={cn(pushed && completed && "border-emerald-200")}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-2">
                        {eligible && (
                          <input
                            type="checkbox"
                            className="mt-1 size-4 shrink-0"
                            checked={selectedSet.has(doc.id)}
                            onChange={(e) =>
                              toggleSelect(doc.id, e.target.checked)
                            }
                            aria-label={`เลือก ${doc.documentNo}`}
                          />
                        )}
                        <CardTitle className="text-base leading-snug break-words">
                          {doc.documentNo}
                        </CardTitle>
                      </div>
                      <DocumentStatusBadge status={doc.status} compact />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {doc.documentDate} · {locationLabel(doc)}
                    </p>
                    {completed && (
                      <div className="pt-1">
                        <ExpressPushBadge at={doc.lastExpressPushAt} />
                      </div>
                    )}
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">
                    V{doc.currentVersionNo || "—"} · {doc.countedLines}/
                    {doc.totalLines} รายการ
                  </CardContent>
                  <CardFooter className="flex flex-row flex-wrap gap-2">
                    <Link
                      href={`/admin/documents/${doc.id}`}
                      className={cn(buttonVariants({ size: "sm" }), "flex-1")}
                    >
                      ประวัติ
                    </Link>
                    {completed && (
                      <>
                        <Link
                          href={`/print/documents/${doc.id}`}
                          className={cn(
                            buttonVariants({ size: "sm", variant: "outline" }),
                            "flex-1",
                          )}
                          target="_blank"
                          rel="noreferrer"
                        >
                          พิมพ์
                        </Link>
                        <PushExpressButton
                          documentId={doc.id}
                          className="flex-1"
                          alreadyPushed={pushed}
                          onPushed={(message) => handlePushed(doc.id, message)}
                        />
                      </>
                    )}
                  </CardFooter>
                </Card>
              );
            })}
          </div>

          <Card className="hidden md:block">
            <CardContent className="pt-4">
              <Table className="table-fixed">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[5%]">
                      <span className="sr-only">เลือก</span>
                    </TableHead>
                    <TableHead className="w-[25%]">เอกสาร</TableHead>
                    <TableHead className="w-[10%]">วันที่</TableHead>
                    <TableHead className="w-[12%]">สถานะ</TableHead>
                    <TableHead className="w-[12%]">Express</TableHead>
                    <TableHead className="w-[8%]">รายการ</TableHead>
                    <TableHead className="w-[28%] text-right">การทำงาน</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documents.map((doc) => {
                    const pushed = Boolean(doc.lastExpressPushAt);
                    const completed = doc.status === DocumentStatus.COMPLETED;
                    const eligible = isBulkEligible(doc);
                    return (
                      <TableRow
                        key={doc.id}
                        className={cn(
                          "cursor-pointer",
                          pushed && completed && "bg-emerald-50/50",
                        )}
                        onClick={() => router.push(`/admin/documents/${doc.id}`)}
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            className="size-4"
                            disabled={!eligible}
                            checked={selectedSet.has(doc.id)}
                            onChange={(e) =>
                              toggleSelect(doc.id, e.target.checked)
                            }
                            aria-label={`เลือก ${doc.documentNo}`}
                          />
                        </TableCell>
                        <TableCell className="max-w-0 whitespace-normal">
                          <div className="min-w-0 space-y-0.5">
                            <p
                              className="truncate font-medium"
                              title={doc.documentNo}
                            >
                              {doc.documentNo}
                            </p>
                            <p
                              className="truncate text-xs text-muted-foreground"
                              title={locationLabel(doc)}
                            >
                              {locationLabel(doc)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              V{doc.currentVersionNo || "—"}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {doc.documentDate}
                        </TableCell>
                        <TableCell>
                          <DocumentStatusBadge status={doc.status} compact />
                        </TableCell>
                        <TableCell className="whitespace-normal">
                          {completed ? (
                            <ExpressPushBadge at={doc.lastExpressPushAt} />
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {doc.countedLines}/{doc.totalLines}
                        </TableCell>
                        <TableCell className="text-right">
                          <div
                            className="inline-flex flex-nowrap items-center justify-end gap-1.5"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Link
                              href={`/admin/documents/${doc.id}`}
                              className={cn(
                                buttonVariants({ size: "sm" }),
                                "shrink-0",
                              )}
                            >
                              ประวัติ
                            </Link>
                            {completed && (
                              <>
                                <Link
                                  href={`/print/documents/${doc.id}`}
                                  className={cn(
                                    buttonVariants({
                                      size: "sm",
                                      variant: "outline",
                                    }),
                                    "shrink-0",
                                  )}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  พิมพ์
                                </Link>
                                <PushExpressButton
                                  documentId={doc.id}
                                  alreadyPushed={pushed}
                                  onPushed={(message) =>
                                    handlePushed(doc.id, message)
                                  }
                                />
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </PageShell>
  );
}
