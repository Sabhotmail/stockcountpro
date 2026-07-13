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
        <Link
          href="/admin/documents"
          className={buttonVariants({ variant: "outline" })}
        >
          กลับ
        </Link>
      </div>
    );
  }

  const locationCode = doc.locationCode ?? doc.branchCode;
  const locationName = doc.locationName ?? doc.branchName;
  const hubLabel = doc.hubShortName
    ? `Hub ${doc.hubShortName}`
    : doc.isCentral
      ? "คลังกลาง HQ"
      : "—";

  return (
    <div className="min-h-screen bg-neutral-200/80 print:bg-white">
      <div className="no-print sticky top-0 z-10 border-b bg-background px-4 py-3 shadow-sm">
        <div className="mx-auto flex max-w-[210mm] flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            ตัวอย่างเอกสารทางการ — {doc.documentNo}
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

      <article className="print-sheet mx-auto my-6 w-full max-w-[210mm] bg-white px-[14mm] py-[12mm] text-black shadow-md print:my-0 print:max-w-none print:px-[12mm] print:py-[10mm] print:shadow-none">
        {/* Formal header */}
        <header className="text-center">
          <p className="text-[13px] font-semibold tracking-wide">
            ระบบตรวจนับสินค้าคงเหลือ
          </p>
          <h1 className="mt-2 text-[22px] font-bold tracking-tight underline decoration-2 underline-offset-4">
            ใบตรวจนับสินค้าคงเหลือ
          </h1>
          <p className="mt-2 text-[12px] text-neutral-700">
            StockCount Pro · เอกสารยืนยันผลการตรวจนับ
          </p>
        </header>

        {/* Meta boxed table */}
        <table className="mt-6 w-full border-collapse border border-black text-[12.5px]">
          <tbody>
            <tr>
              <th className="w-[18%] border border-black bg-neutral-100 px-2 py-1.5 text-left font-semibold">
                เลขที่เอกสาร
              </th>
              <td className="border border-black px-2 py-1.5 font-medium">
                {doc.documentNo}
              </td>
              <th className="w-[14%] border border-black bg-neutral-100 px-2 py-1.5 text-left font-semibold">
                วันที่นับ
              </th>
              <td className="border border-black px-2 py-1.5">{doc.documentDate}</td>
            </tr>
            <tr>
              <th className="border border-black bg-neutral-100 px-2 py-1.5 text-left font-semibold">
                รหัสคลัง
              </th>
              <td className="border border-black px-2 py-1.5">{locationCode}</td>
              <th className="border border-black bg-neutral-100 px-2 py-1.5 text-left font-semibold">
                ชื่อคลัง
              </th>
              <td className="border border-black px-2 py-1.5">{locationName}</td>
            </tr>
            <tr>
              <th className="border border-black bg-neutral-100 px-2 py-1.5 text-left font-semibold">
                Hub / กลุ่ม
              </th>
              <td className="border border-black px-2 py-1.5">{hubLabel}</td>
              <th className="border border-black bg-neutral-100 px-2 py-1.5 text-left font-semibold">
                เวอร์ชัน
              </th>
              <td className="border border-black px-2 py-1.5">
                V{doc.currentVersionNo} · สถานะเสร็จสิ้น
              </td>
            </tr>
          </tbody>
        </table>

        <p className="mt-4 mb-2 text-[12px] font-semibold">
          รายการสินค้าที่ตรวจนับ
        </p>

        <table className="w-full border-collapse border border-black text-[12px]">
          <thead>
            <tr className="bg-neutral-100">
              <th className="w-14 border border-black px-2 py-1.5 text-center font-semibold">
                ลำดับ
              </th>
              <th className="w-28 border border-black px-2 py-1.5 text-left font-semibold">
                รหัสสินค้า
              </th>
              <th className="border border-black px-2 py-1.5 text-left font-semibold">
                ชื่อสินค้า
              </th>
              <th className="w-28 border border-black px-2 py-1.5 text-right font-semibold">
                จำนวนที่นับ
              </th>
            </tr>
          </thead>
          <tbody>
            {doc.lines.map((line) => (
              <tr key={`${line.lineNo}-${line.productCode}`}>
                <td className="border border-black px-2 py-1 text-center align-top">
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
          <tfoot>
            <tr className="bg-neutral-50">
              <td
                colSpan={3}
                className="border border-black px-2 py-1.5 text-[11.5px]"
              >
                รวมทั้งสิ้น <strong>{doc.lines.length}</strong> รายการ
              </td>
              <td className="border border-black px-2 py-1.5 text-right text-[11.5px] text-neutral-700">
                หน่วยนับ: ชิ้นฐาน
              </td>
            </tr>
          </tfoot>
        </table>

        <p className="mt-3 text-[11px] leading-relaxed text-neutral-700">
          หมายเหตุ: เอกสารฉบับนี้เป็นหลักฐานผลการตรวจนับในระบบ StockCount Pro
          กรุณาลงลายมือชื่อให้ครบทุกช่องก่อนเก็บเข้าแฟ้ม
        </p>

        <section className="mt-6 border border-black px-3 py-4">
          <p className="mb-5 text-center text-[13px] font-bold">
            ส่วนลงนามรับรอง
          </p>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            <FormalSignature action="ตรวจนับโดย" role="พนักงานธุรการ" />
            <FormalSignature
              action="ร่วมตรวจโดย"
              role="พนักงานขายหน่วยรถ"
            />
            <FormalSignature
              action="อนุมัติโดย"
              role="ผู้อนุมัติผลตรวจสอบ"
            />
          </div>
        </section>

        <footer className="mt-4 text-center text-[10px] text-neutral-500">
          พิมพ์จาก StockCount Pro · เอกสารสำหรับเก็บเป็นหลักฐานภายใน
        </footer>
      </article>
    </div>
  );
}

function FormalSignature({
  action,
  role,
}: {
  action: string;
  role: string;
}) {
  return (
    <div className="text-center text-[11px]">
      <div className="mx-auto mb-0.5 h-8 w-36 border-b border-black" />
      <p className="text-[10px] text-neutral-600">(ลงชื่อ)</p>
      <p className="mt-3 font-medium">{action}</p>
      <div className="mx-auto mt-1 h-4 w-40 border-b border-black" />
      <p className="mt-1 text-[10px] text-neutral-700">({role})</p>
      <div className="mt-3 flex items-end justify-center gap-1">
        <span>วันที่</span>
        <span className="inline-block w-6 border-b border-black" />
        <span>/</span>
        <span className="inline-block w-6 border-b border-black" />
        <span>/</span>
        <span className="inline-block w-8 border-b border-black" />
      </div>
    </div>
  );
}
