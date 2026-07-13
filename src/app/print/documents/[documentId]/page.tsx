"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { type PrintDocumentPayload } from "@/types/count";

function formatQty(value: number | null): string {
  if (value === null || value === undefined) return "—";
  return value.toLocaleString("th-TH");
}

export default function PrintDocumentPage() {
  const params = useParams<{ documentId: string }>();
  const router = useRouter();
  const documentId = params.documentId;

  const [doc, setDoc] = useState<PrintDocumentPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/count-documents/${documentId}/print`, {
          credentials: "same-origin",
        });
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        if (!res.ok) {
          const data = (await res.json()) as { error?: string };
          throw new Error(data.error ?? "โหลดเอกสารพิมพ์ไม่สำเร็จ");
        }
        const data = (await res.json()) as { document: PrintDocumentPayload };
        if (!cancelled) setDoc(data.document);
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
  }, [documentId, router]);

  if (loading) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        กำลังโหลดเอกสารพิมพ์...
      </div>
    );
  }

  if (error || !doc) {
    return (
      <div className="mx-auto max-w-lg space-y-4 p-8">
        <Alert variant="destructive">
          <AlertDescription>{error ?? "ไม่พบเอกสาร"}</AlertDescription>
        </Alert>
        <Link href="/admin/documents" className={buttonVariants({ variant: "outline" })}>
          กลับ
        </Link>
      </div>
    );
  }

  const location =
    `${doc.locationCode ?? doc.branchCode}` +
    (doc.locationName
      ? ` · ${doc.locationName}`
      : doc.branchName
        ? ` · ${doc.branchName}`
        : "");
  const hubLabel = doc.hubShortName
    ? `Hub ${doc.hubShortName}`
    : doc.isCentral
      ? "HQ กลาง"
      : "—";

  return (
    <div className="min-h-screen bg-muted/40">
      <div className="no-print sticky top-0 z-10 border-b bg-background px-4 py-3">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            พิมพ์เอกสารตรวจนับ — {doc.documentNo}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => window.print()}>
              พิมพ์
            </Button>
            <Link
              href="/admin/documents"
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              ปิด
            </Link>
          </div>
        </div>
      </div>

      <article className="print-sheet mx-auto my-6 max-w-4xl bg-white p-8 text-black shadow-sm print:my-0 print:max-w-none print:p-0 print:shadow-none">
        <header className="border-b border-black pb-4">
          <h1 className="text-center text-xl font-bold">ใบตรวจนับสินค้าคงเหลือ</h1>
          <p className="mt-1 text-center text-sm">StockCount Pro</p>
          <dl className="mt-4 grid grid-cols-1 gap-1 text-sm sm:grid-cols-2">
            <div>
              <dt className="inline text-neutral-600">เลขเอกสาร: </dt>
              <dd className="inline font-medium">{doc.documentNo}</dd>
            </div>
            <div>
              <dt className="inline text-neutral-600">วันที่: </dt>
              <dd className="inline font-medium">{doc.documentDate}</dd>
            </div>
            <div>
              <dt className="inline text-neutral-600">คลัง: </dt>
              <dd className="inline font-medium">{location}</dd>
            </div>
            <div>
              <dt className="inline text-neutral-600">Hub: </dt>
              <dd className="inline font-medium">{hubLabel}</dd>
            </div>
            <div>
              <dt className="inline text-neutral-600">เวอร์ชัน: </dt>
              <dd className="inline font-medium">V{doc.currentVersionNo}</dd>
            </div>
            <div>
              <dt className="inline text-neutral-600">สถานะ: </dt>
              <dd className="inline font-medium">เสร็จสิ้น</dd>
            </div>
          </dl>
        </header>

        <table className="mt-4 w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="border border-black px-2 py-1.5 text-left font-semibold">
                ลำดับ
              </th>
              <th className="border border-black px-2 py-1.5 text-left font-semibold">
                รหัสสินค้า
              </th>
              <th className="border border-black px-2 py-1.5 text-left font-semibold">
                ชื่อสินค้า
              </th>
              <th className="border border-black px-2 py-1.5 text-right font-semibold">
                จำนวนที่นับ
              </th>
            </tr>
          </thead>
          <tbody>
            {doc.lines.map((line) => (
              <tr key={`${line.lineNo}-${line.productCode}`}>
                <td className="border border-black px-2 py-1 align-top">
                  {line.lineNo}
                </td>
                <td className="border border-black px-2 py-1 align-top">
                  {line.productCode}
                </td>
                <td className="border border-black px-2 py-1 align-top">
                  {line.productName}
                </td>
                <td className="border border-black px-2 py-1 text-right align-top tabular-nums">
                  {formatQty(line.totalBaseQty)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="mt-3 text-xs text-neutral-600">
          รวม {doc.lines.length} รายการ · จำนวนเป็นหน่วยชิ้นฐาน
        </p>

        <section className="signature-block mt-14 break-inside-avoid border-t border-neutral-300 pt-10 text-sm">
          <div className="grid grid-cols-1 gap-x-10 gap-y-12 sm:grid-cols-2">
            <SignatureBlock label="ตรวจนับโดย" role="พนักงานธุรการ" />
            <SignatureBlock label="ร่วมตรวจโดย" role="พนักงานขายหน่วยรถ" />
            <div className="hidden sm:block" aria-hidden />
            <SignatureBlock label="อนุมัติโดย" role="ผู้อนุมัติผลตรวจสอบ" />
          </div>
        </section>
      </article>
    </div>
  );
}

function SignatureBlock({ label, role }: { label: string; role: string }) {
  return (
    <div className="mx-auto w-full max-w-[20rem]">
      <div className="mb-8 flex h-14 items-end justify-center">
        <div className="w-40 border-b border-neutral-400" />
      </div>
      <p className="mb-4 text-center text-xs text-neutral-500">ลงชื่อ</p>
      <div className="flex items-end gap-2">
        <span className="shrink-0 whitespace-nowrap">{label}</span>
        <span className="mb-0.5 min-h-[1.25rem] min-w-[6rem] flex-1 border-b border-black" />
        <span className="shrink-0 whitespace-nowrap">วันที่</span>
        <span className="mb-0.5 min-h-[1.25rem] w-20 shrink-0 border-b border-black sm:w-24" />
      </div>
      <p className="mt-2 text-center text-xs text-neutral-600">({role})</p>
    </div>
  );
}
