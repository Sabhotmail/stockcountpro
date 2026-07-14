"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { BulkPushExpressToolbar } from "@/components/BulkPushExpressToolbar";
import { DocumentStatusBadge } from "@/components/DocumentStatusBadge";
import { ExpressPushBadge } from "@/components/ExpressPushBadge";
import { TableRowsSkeleton } from "@/components/loading/PageSkeletons";
import { LogoutButton, PageShell } from "@/components/PageShell";
import { PushExpressButton } from "@/components/PushExpressButton";
import {
  isSupervisorDocBulkEligible,
  SupervisorDocumentRow,
} from "@/components/SupervisorDocumentRow";
import { SupervisorNav } from "@/components/SupervisorNav";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDateTimeShortTH } from "@/lib/datetime";
import { cn } from "@/lib/utils";
import {
  DocumentStatus,
  type SupervisorDocumentListItem,
} from "@/types/count";

type TabKey = "pending" | "completed";

function locationCodeLabel(doc: SupervisorDocumentListItem): string {
  return doc.locationCode ?? doc.branchCode;
}

function locationNameLabel(doc: SupervisorDocumentListItem): string {
  return doc.locationName ?? doc.branchName;
}

function isBulkEligible(doc: SupervisorDocumentListItem) {
  return isSupervisorDocBulkEligible(doc);
}

export default function SupervisorDocumentsPage() {
  const router = useRouter();
  const [documents, setDocuments] = useState<SupervisorDocumentListItem[]>([]);
  const [tab, setTab] = useState<TabKey>("pending");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pushNotice, setPushNotice] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const expressOk = params.get("expressPushOk");
    const expressErr = params.get("expressPushError");
    if (expressOk) {
      setTab("completed");
      setPushNotice("อนุมัติสำเร็จ และส่ง Express แล้ว");
    } else if (expressErr) {
      setTab("completed");
      setPushNotice(
        `อนุมัติสำเร็จ แต่ส่ง Express ไม่สำเร็จ: ${expressErr}`,
      );
    }
    if (expressOk || expressErr) {
      router.replace("/supervisor/documents");
    }
  }, [router]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/supervisor/count-documents");
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        if (res.status === 403) {
          router.push("/tablet/documents");
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

  const pending = useMemo(
    () =>
      documents.filter((doc) => doc.status !== DocumentStatus.COMPLETED),
    [documents],
  );
  const completed = useMemo(
    () =>
      documents.filter((doc) => doc.status === DocumentStatus.COMPLETED),
    [documents],
  );
  const visible = tab === "completed" ? completed : pending;
  const eligibleDocs = useMemo(
    () => completed.filter(isBulkEligible),
    [completed],
  );
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const docLabels = useMemo(() => {
    const map: Record<string, string> = {};
    for (const doc of documents) map[doc.id] = doc.documentNo;
    return map;
  }, [documents]);

  function toggleSelect(documentId: string, next: boolean) {
    setSelectedIds((prev) => {
      if (next) return prev.includes(documentId) ? prev : [...prev, documentId];
      return prev.filter((id) => id !== documentId);
    });
  }

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

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    router.push("/login");
  }

  return (
    <PageShell
      title="ตรวจสอบเอกสารนับสต็อก"
      subtitle="Supervisor — รอตรวจ และเอกสารเสร็จสิ้น (พิมพ์ได้)"
      actions={<LogoutButton onClick={handleLogout} />}
      nav={<SupervisorNav />}
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

      <Tabs
        value={tab}
        onValueChange={(value) => {
          setTab(value as TabKey);
          setSelectedIds([]);
        }}
        className="mb-4"
      >
        <TabsList>
          <TabsTrigger value="pending">
            รอตรวจ ({pending.length})
          </TabsTrigger>
          <TabsTrigger value="completed">
            เสร็จสิ้น ({completed.length})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {loading && <TableRowsSkeleton rows={8} />}

      {!loading && visible.length === 0 && (
        <p className="py-12 text-center text-muted-foreground">
          {tab === "completed"
            ? "ยังไม่มีเอกสารเสร็จสิ้น — อนุมัติเอกสารก่อนจึงจะพิมพ์ได้"
            : "ไม่มีเอกสารรอตรวจ"}
        </p>
      )}

      {!loading && visible.length > 0 && (
        <>
          {tab === "completed" && (
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
          )}

          <div className="md:hidden rounded-lg border border-border/80 bg-background px-4 sm:px-5">
            {visible.map((doc) => (
              <SupervisorDocumentRow
                key={doc.id}
                doc={doc}
                mode={tab}
                onPushed={handlePushed}
                selected={selectedSet.has(doc.id)}
                onToggleSelect={toggleSelect}
              />
            ))}
          </div>

          <div className="hidden overflow-hidden rounded-lg border border-border/80 bg-background md:block">
            <Table className="table-fixed">
                <TableHeader>
                  <TableRow>
                    {tab === "completed" && (
                      <TableHead className="w-[5%]">
                        <span className="sr-only">เลือก</span>
                      </TableHead>
                    )}
                    <TableHead className={tab === "completed" ? "w-[33%]" : "w-[38%]"}>
                      เอกสาร
                    </TableHead>
                    {tab === "pending" && (
                      <TableHead className="w-[12%]">สถานะ</TableHead>
                    )}
                    {tab === "completed" && (
                      <TableHead className="w-[12%]">Express</TableHead>
                    )}
                    <TableHead className="w-[10%]">รายการ</TableHead>
                    <TableHead className="w-[18%]">ส่ง</TableHead>
                    <TableHead className="w-[22%] text-right">
                      การทำงาน
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map((doc) => {
                    const pushed = Boolean(doc.lastExpressPushAt);
                    const eligible = isBulkEligible(doc);
                    return (
                      <TableRow
                        key={doc.id}
                        className={cn(
                          pushed &&
                            tab === "completed" &&
                            "bg-emerald-50/50",
                        )}
                      >
                        {tab === "completed" && (
                          <TableCell>
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
                        )}
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
                              title={`${locationCodeLabel(doc)} · ${locationNameLabel(doc)}`}
                            >
                              {locationCodeLabel(doc)} ·{" "}
                              {locationNameLabel(doc)}
                              {doc.hubShortName
                                ? ` · ${doc.hubShortName}`
                                : ""}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              V{doc.currentVersionNo || "—"}
                              {doc.hasDocumentNote ? " · มีหมายเหตุ" : ""}
                            </p>
                          </div>
                        </TableCell>
                        {tab === "pending" && (
                          <TableCell>
                            <DocumentStatusBadge status={doc.status} compact />
                          </TableCell>
                        )}
                        {tab === "completed" && (
                          <TableCell className="whitespace-normal">
                            <ExpressPushBadge at={doc.lastExpressPushAt} />
                          </TableCell>
                        )}
                        <TableCell className="tabular-nums">
                          {doc.countedLines}/{doc.totalLines}
                        </TableCell>
                        <TableCell className="whitespace-normal">
                          <div className="min-w-0">
                            <p className="truncate font-medium">
                              {doc.submittedByName ?? "—"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatDateTimeShortTH(doc.submittedAt)}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {tab === "completed" ? (
                            <div className="inline-flex flex-nowrap items-center justify-end gap-1.5">
                              <Link
                                href={`/supervisor/review/${doc.id}`}
                                className={cn(
                                  buttonVariants({
                                    variant: "outline",
                                    size: "sm",
                                  }),
                                  "border-orange-200 bg-orange-50 text-orange-800 hover:bg-orange-100",
                                )}
                              >
                                ขอนับใหม่
                              </Link>
                              <Link
                                href={`/print/documents/${doc.id}`}
                                className={buttonVariants({ size: "sm" })}
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
                            </div>
                          ) : (
                            <Link
                              href={`/supervisor/review/${doc.id}`}
                              className={buttonVariants({ size: "sm" })}
                            >
                              ตรวจสอบ
                            </Link>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
          </div>
        </>
      )}
    </PageShell>
  );
}
