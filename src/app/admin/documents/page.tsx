"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AdminNav } from "@/components/AdminNav";
import { DocumentStatusBadge } from "@/components/DocumentStatusBadge";
import { LogoutButton, PageShell } from "@/components/PageShell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
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

export default function AdminDocumentsPage() {
  const router = useRouter();
  const [documents, setDocuments] = useState<CountDocumentListItem[]>([]);
  const [q, setQ] = useState("");
  const [documentDate, setDocumentDate] = useState("");
  const [status, setStatus] = useState("");
  const [applied, setApplied] = useState({ q: "", documentDate: "", status: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    router.push("/login");
  }

  function handleSearch(e: React.FormEvent) {
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
    >
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
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

      {loading && (
        <p className="py-12 text-center text-muted-foreground">กำลังโหลด...</p>
      )}

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

          <div className="flex flex-col gap-3 md:hidden">
            {documents.map((doc) => (
              <Card key={doc.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-3">
                    <CardTitle className="text-base">{doc.documentNo}</CardTitle>
                    <DocumentStatusBadge status={doc.status} compact />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {doc.documentDate} · {locationLabel(doc)}
                  </p>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  V{doc.currentVersionNo || "—"} · {doc.countedLines}/
                  {doc.totalLines} รายการ
                </CardContent>
                <CardFooter className="flex flex-col gap-2">
                  <Link
                    href={`/admin/documents/${doc.id}`}
                    className={cn(buttonVariants(), "w-full")}
                  >
                    ดูประวัติ
                  </Link>
                  {doc.status === DocumentStatus.COMPLETED && (
                    <Link
                      href={`/print/documents/${doc.id}`}
                      className={cn(buttonVariants({ variant: "outline" }), "w-full")}
                      target="_blank"
                      rel="noreferrer"
                    >
                      พิมพ์เอกสาร
                    </Link>
                  )}
                </CardFooter>
              </Card>
            ))}
          </div>

          <Card className="hidden md:block">
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>เลขเอกสาร</TableHead>
                    <TableHead>วันที่</TableHead>
                    <TableHead>คลัง</TableHead>
                    <TableHead>สถานะ</TableHead>
                    <TableHead>เวอร์ชัน</TableHead>
                    <TableHead>รายการ</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documents.map((doc) => (
                    <TableRow
                      key={doc.id}
                      className="cursor-pointer"
                      onClick={() => router.push(`/admin/documents/${doc.id}`)}
                    >
                      <TableCell className="font-medium">{doc.documentNo}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {doc.documentDate}
                      </TableCell>
                      <TableCell className="max-w-[16rem] truncate">
                        {locationLabel(doc)}
                      </TableCell>
                      <TableCell>
                        <DocumentStatusBadge status={doc.status} compact />
                      </TableCell>
                      <TableCell>V{doc.currentVersionNo || "—"}</TableCell>
                      <TableCell>
                        {doc.countedLines}/{doc.totalLines}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          <Link
                            href={`/admin/documents/${doc.id}`}
                            className={buttonVariants({ size: "sm" })}
                            onClick={(e) => e.stopPropagation()}
                          >
                            ดูประวัติ
                          </Link>
                          {doc.status === DocumentStatus.COMPLETED && (
                            <Link
                              href={`/print/documents/${doc.id}`}
                              className={buttonVariants({
                                size: "sm",
                                variant: "outline",
                              })}
                              onClick={(e) => e.stopPropagation()}
                              target="_blank"
                              rel="noreferrer"
                            >
                              พิมพ์
                            </Link>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </PageShell>
  );
}
