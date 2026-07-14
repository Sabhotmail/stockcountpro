"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { DocumentStatusBadge } from "@/components/DocumentStatusBadge";
import { ExpressPushBadge } from "@/components/ExpressPushBadge";
import { TableRowsSkeleton } from "@/components/loading/PageSkeletons";
import { LogoutButton, PageShell } from "@/components/PageShell";
import { PushExpressButton } from "@/components/PushExpressButton";
import { SupervisorNav } from "@/components/SupervisorNav";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

function DocumentCard({
  doc,
  mode,
  onPushed,
}: {
  doc: SupervisorDocumentListItem;
  mode: TabKey;
  onPushed: (documentId: string, message: string) => void;
}) {
  const pushed = Boolean(doc.lastExpressPushAt);

  return (
    <Card className={cn(pushed && mode === "completed" && "border-emerald-200")}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-base leading-snug break-words">
            {doc.documentNo}
          </CardTitle>
          <DocumentStatusBadge status={doc.status} compact />
        </div>
        <p className="text-sm text-muted-foreground">
          {locationCodeLabel(doc)} · {locationNameLabel(doc)}
          {doc.hubShortName
            ? ` · Hub ${doc.hubShortName}`
            : doc.isCentral
              ? " · HQ กลาง"
              : ""}
        </p>
        {mode === "completed" && (
          <div className="pt-1">
            <ExpressPushBadge at={doc.lastExpressPushAt} />
          </div>
        )}
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div>
            <dt className="text-muted-foreground">เวอร์ชัน</dt>
            <dd className="font-medium">V{doc.currentVersionNo || "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">รายการ</dt>
            <dd className="font-medium">
              {doc.countedLines}/{doc.totalLines}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">ส่งโดย</dt>
            <dd className="font-medium">{doc.submittedByName ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">หมายเหตุ</dt>
            <dd className="font-medium">{doc.hasDocumentNote ? "มี" : "—"}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-muted-foreground">ส่งเมื่อ</dt>
            <dd className="font-medium">
              {formatDateTimeShortTH(doc.submittedAt)}
            </dd>
          </div>
        </dl>
      </CardContent>
      <CardFooter className="flex flex-row flex-wrap gap-2">
        {mode === "completed" ? (
          <>
            <Link
              href={`/print/documents/${doc.id}`}
              className={cn(buttonVariants({ size: "sm" }), "flex-1")}
              target="_blank"
              rel="noreferrer"
            >
              พิมพ์
            </Link>
            <PushExpressButton
              documentId={doc.id}
              className="flex-1"
              alreadyPushed={pushed}
              onPushed={(message) => onPushed(doc.id, message)}
            />
          </>
        ) : (
          <Link
            href={`/supervisor/review/${doc.id}`}
            className={cn(buttonVariants({ size: "sm" }), "w-full")}
          >
            ตรวจสอบ
          </Link>
        )}
      </CardFooter>
    </Card>
  );
}

export default function SupervisorDocumentsPage() {
  const router = useRouter();
  const [documents, setDocuments] = useState<SupervisorDocumentListItem[]>([]);
  const [tab, setTab] = useState<TabKey>("pending");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pushNotice, setPushNotice] = useState<string | null>(null);

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

  function handlePushed(documentId: string, message: string) {
    setPushNotice(message);
    setDocuments((prev) =>
      prev.map((doc) =>
        doc.id === documentId
          ? { ...doc, lastExpressPushAt: new Date().toISOString() }
          : doc,
      ),
    );
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
        onValueChange={(value) => setTab(value as TabKey)}
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
          <div className="flex flex-col gap-3 md:hidden">
            {visible.map((doc) => (
              <DocumentCard
                key={doc.id}
                doc={doc}
                mode={tab}
                onPushed={handlePushed}
              />
            ))}
          </div>

          <Card className="hidden md:block">
            <CardContent className="pt-4">
              <Table className="table-fixed">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[38%]">เอกสาร</TableHead>
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
                    return (
                      <TableRow
                        key={doc.id}
                        className={cn(
                          pushed &&
                            tab === "completed" &&
                            "bg-emerald-50/50",
                        )}
                      >
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
            </CardContent>
          </Card>
        </>
      )}
    </PageShell>
  );
}
