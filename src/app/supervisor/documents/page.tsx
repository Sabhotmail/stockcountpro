"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { DocumentStatusBadge } from "@/components/DocumentStatusBadge";
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

function DocumentCard({
  doc,
  mode,
}: {
  doc: SupervisorDocumentListItem;
  mode: TabKey;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-base">{doc.documentNo}</CardTitle>
          <DocumentStatusBadge status={doc.status} compact />
        </div>
        <p className="text-sm text-muted-foreground">
          {doc.locationCode ? `${doc.locationCode}` : doc.branchCode}
          {doc.locationName ? ` · ${doc.locationName}` : ` · ${doc.branchName}`}
          {doc.hubShortName
            ? ` · Hub ${doc.hubShortName}`
            : doc.isCentral
              ? " · HQ กลาง"
              : ""}
        </p>
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
      <CardFooter className="flex flex-col gap-2">
        {mode === "completed" ? (
          <>
            <Link
              href={`/print/documents/${doc.id}`}
              className={cn(buttonVariants(), "w-full")}
              target="_blank"
              rel="noreferrer"
            >
              พิมพ์เอกสาร
            </Link>
            <PushExpressButton documentId={doc.id} fullWidth />
          </>
        ) : (
          <Link
            href={`/supervisor/review/${doc.id}`}
            className={cn(buttonVariants(), "w-full")}
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
    >
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
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
            เสร็จสิ้น / พิมพ์ ({completed.length})
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
              <DocumentCard key={doc.id} doc={doc} mode={tab} />
            ))}
          </div>

          <Card className="hidden md:block">
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>เลขเอกสาร</TableHead>
                    <TableHead>สาขา</TableHead>
                    <TableHead>สถานะ</TableHead>
                    <TableHead>เวอร์ชัน</TableHead>
                    <TableHead>ส่งโดย</TableHead>
                    <TableHead>ส่งเมื่อ</TableHead>
                    <TableHead>รายการ</TableHead>
                    <TableHead>หมายเหตุ</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map((doc) => (
                    <TableRow key={doc.id}>
                      <TableCell className="font-medium">{doc.documentNo}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {doc.locationCode ?? doc.branchCode}
                        {doc.locationName
                          ? ` · ${doc.locationName}`
                          : ` ${doc.branchName}`}
                      </TableCell>
                      <TableCell>
                        <DocumentStatusBadge status={doc.status} compact />
                      </TableCell>
                      <TableCell>V{doc.currentVersionNo || "—"}</TableCell>
                      <TableCell>{doc.submittedByName ?? "—"}</TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {formatDateTimeShortTH(doc.submittedAt)}
                      </TableCell>
                      <TableCell>
                        {doc.countedLines}/{doc.totalLines}
                      </TableCell>
                      <TableCell>{doc.hasDocumentNote ? "มี" : "—"}</TableCell>
                      <TableCell>
                        {tab === "completed" ? (
                          <div className="flex flex-wrap gap-2">
                            <Link
                              href={`/print/documents/${doc.id}`}
                              className={buttonVariants({ size: "sm" })}
                              target="_blank"
                              rel="noreferrer"
                            >
                              พิมพ์เอกสาร
                            </Link>
                            <PushExpressButton documentId={doc.id} />
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
