"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  type PrintDocumentLine,
  type PrintDocumentPayload,
} from "@/types/count";

/** CSS px for 1mm at 96dpi (browser print layout). */
function mm(value: number): number {
  return (value * 96) / 25.4;
}

/** A4 height minus @page margin 8mm top+bottom. */
const PAGE_INNER_PX = mm(297 - 16);
/** Extra safety so browser does not auto-split a page. */
const PACK_SAFETY_PX = mm(3);

function formatQty(value: number | null): string {
  if (value === null || value === undefined || value < 0) return "—";
  return value.toLocaleString("th-TH");
}

function packLinesByHeight(
  lines: PrintDocumentLine[],
  rowHeights: number[],
  opts: {
    firstTopH: number;
    contTopH: number;
    theadH: number;
    summaryH: number;
    footerH: number;
  },
): PrintDocumentLine[][] {
  if (lines.length === 0) return [[]];

  const budget = (isFirst: boolean) =>
    PAGE_INNER_PX -
    (isFirst ? opts.firstTopH : opts.contTopH) -
    opts.theadH -
    opts.footerH -
    PACK_SAFETY_PX;

  const pages: PrintDocumentLine[][] = [];
  let index = 0;
  let isFirst = true;

  while (index < lines.length) {
    const maxH = Math.max(budget(isFirst), mm(40));
    const chunk: PrintDocumentLine[] = [];
    let used = 0;

    while (index < lines.length) {
      const rowH = rowHeights[index] ?? mm(6);
      const isLastLine = index === lines.length - 1;
      const need = rowH + (isLastLine ? opts.summaryH : 0);

      if (chunk.length > 0 && used + need > maxH) break;

      if (chunk.length === 0 && need > maxH) {
        chunk.push(lines[index]!);
        index += 1;
        break;
      }

      chunk.push(lines[index]!);
      used += rowH;
      if (isLastLine) used += opts.summaryH;
      index += 1;
    }

    pages.push(chunk);
    isFirst = false;
  }

  return pages;
}

export default function PrintDocumentPage() {
  const params = useParams<{ documentId: string }>();
  const router = useRouter();
  const documentId = params.documentId;

  const [doc, setDoc] = useState<PrintDocumentPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pages, setPages] = useState<PrintDocumentLine[][] | null>(null);
  const measureRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      setPages(null);
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

  useLayoutEffect(() => {
    if (!doc || !measureRef.current) return;

    const root = measureRef.current;
    const firstTop = root.querySelector<HTMLElement>("[data-m=first-top]");
    const contTop = root.querySelector<HTMLElement>("[data-m=cont-top]");
    const thead = root.querySelector<HTMLElement>("[data-m=thead]");
    const summary = root.querySelector<HTMLElement>("[data-m=summary]");
    const footer = root.querySelector<HTMLElement>("[data-m=footer]");
    const rowEls = [
      ...root.querySelectorAll<HTMLElement>("[data-m-row]"),
    ];

    const packed = packLinesByHeight(
      doc.lines,
      rowEls.map((el) => el.getBoundingClientRect().height),
      {
        firstTopH: firstTop?.getBoundingClientRect().height ?? 0,
        contTopH: contTop?.getBoundingClientRect().height ?? 0,
        theadH: thead?.getBoundingClientRect().height ?? 0,
        summaryH: summary?.getBoundingClientRect().height ?? 0,
        footerH: footer?.getBoundingClientRect().height ?? 0,
      },
    );
    setPages(packed);
  }, [doc]);

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
  const totalPages = (pages?.length ?? 0) + 1; // +1 signature page

  return (
    <div className="min-h-screen bg-neutral-200/80 print:bg-white">
      <div className="no-print sticky top-0 z-10 border-b bg-background px-4 py-3 shadow-sm">
        <div className="mx-auto flex max-w-[210mm] flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            ตัวอย่างเอกสารทางการ — {doc.documentNo}
            {pages ? ` · ${totalPages} หน้า` : " · กำลังจัดหน้า..."}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={!pages}
              onClick={() => window.print()}
            >
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

      {/* Off-screen measure at print content width (A4 − @page margins). */}
      <div
        ref={measureRef}
        aria-hidden
        className="pointer-events-none absolute top-0 left-[-10000px] w-[194mm] text-black"
      >
        <div data-m="first-top">
          <DocumentHeader
            documentNo={doc.documentNo}
            documentDate={doc.documentDate}
            locationCode={locationCode}
            locationName={locationName}
            hubLabel={hubLabel}
            versionNo={doc.currentVersionNo}
          />
          <p className="mt-3 mb-1.5 text-[12px] font-semibold">
            รายการสินค้าที่ตรวจนับ
          </p>
        </div>
        <div data-m="cont-top">
          <p className="mb-2 border-b border-black pb-1.5 text-[11px]">
            ใบตรวจนับสินค้าคงเหลือ · {doc.documentNo} · {doc.documentDate} ·{" "}
            {locationCode}
          </p>
        </div>
        <table className="w-full border-collapse border border-black text-[11.5px] leading-snug">
          <thead>
            <tr data-m="thead" className="bg-neutral-100">
              <th className="w-12 border border-black px-1.5 py-1 text-center font-semibold">
                ลำดับ
              </th>
              <th className="w-24 border border-black px-1.5 py-1 text-left font-semibold">
                รหัสสินค้า
              </th>
              <th className="border border-black px-1.5 py-1 text-left font-semibold">
                ชื่อสินค้า
              </th>
              <th className="w-16 border border-black px-1.5 py-1 text-right font-semibold">
                ลัง
              </th>
              <th className="w-16 border border-black px-1.5 py-1 text-right font-semibold">
                ชิ้น
              </th>
            </tr>
          </thead>
          <tbody>
            {doc.lines.map((line) => (
              <tr key={`m-${line.lineNo}-${line.productCode}`} data-m-row>
                <td className="border border-black px-1.5 py-0.5 text-center align-top">
                  {line.lineNo}
                </td>
                <td className="border border-black px-1.5 py-0.5 align-top">
                  {line.productCode}
                </td>
                <td className="border border-black px-1.5 py-0.5 align-top">
                  {line.productName}
                </td>
                <td className="border border-black px-1.5 py-0.5 text-right align-top tabular-nums">
                  {formatQty(line.qtyCase)}
                </td>
                <td className="border border-black px-1.5 py-0.5 text-right align-top tabular-nums">
                  {formatQty(line.qtyPiece)}
                </td>
              </tr>
            ))}
            <tr data-m="summary" className="bg-neutral-50">
              <td
                colSpan={5}
                className="border border-black px-1.5 py-1 text-[11px]"
              >
                รวมทั้งสิ้น <strong>{doc.lines.length}</strong> รายการ
              </td>
            </tr>
          </tbody>
        </table>
        <div data-m="footer">
          <p className="mt-3 border-t border-neutral-400 pt-1.5 text-center text-[11px] font-medium tabular-nums tracking-wide">
            1/1
          </p>
        </div>
      </div>

      {!pages ? (
        <div className="p-8 text-center text-muted-foreground">
          กำลังจัดหน้าเอกสาร...
        </div>
      ) : (
        <div className="mx-auto max-w-[210mm] py-4 print:max-w-none print:py-0">
          {pages.map((rows, pageIndex) => {
            const pageNo = pageIndex + 1;
            const isFirst = pageIndex === 0;
            const isLastLines = pageIndex === pages.length - 1;

            return (
              <section
                key={`page-${pageNo}`}
                className={cn(
                  "print-page mx-auto mb-4 flex min-h-[297mm] flex-col bg-white px-[12mm] pb-[10mm] pt-[10mm] text-black shadow-md",
                  "print:mb-0 print:min-h-0 print:px-0 print:pb-0 print:pt-0 print:shadow-none",
                )}
              >
                <div className="flex-1">
                  {isFirst ? (
                    <DocumentHeader
                      documentNo={doc.documentNo}
                      documentDate={doc.documentDate}
                      locationCode={locationCode}
                      locationName={locationName}
                      hubLabel={hubLabel}
                      versionNo={doc.currentVersionNo}
                    />
                  ) : (
                    <p className="mb-2 border-b border-black pb-1.5 text-[11px]">
                      ใบตรวจนับสินค้าคงเหลือ · {doc.documentNo} ·{" "}
                      {doc.documentDate} · {locationCode}
                    </p>
                  )}

                  {isFirst && (
                    <p className="mt-3 mb-1.5 text-[12px] font-semibold">
                      รายการสินค้าที่ตรวจนับ
                    </p>
                  )}

                  <LinesTable
                    rows={rows}
                    showSummary={isLastLines}
                    totalLines={doc.lines.length}
                  />
                </div>

                <p className="mt-3 shrink-0 border-t border-neutral-400 pt-1.5 text-center text-[11px] font-medium tabular-nums tracking-wide">
                  {pageNo}/{totalPages}
                </p>
              </section>
            );
          })}

          <section
            className={cn(
              "print-page mx-auto mb-4 flex min-h-[297mm] flex-col bg-white px-[12mm] pb-[10mm] pt-[10mm] text-black shadow-md",
              "print:mb-0 print:min-h-0 print:px-0 print:pb-0 print:pt-0 print:shadow-none",
            )}
          >
            <div className="flex-1">
              <p className="mb-2 border-b border-black pb-1.5 text-[11px]">
                ใบตรวจนับสินค้าคงเหลือ · {doc.documentNo} · {doc.documentDate} ·{" "}
                {locationCode}
              </p>

              <p className="mt-3 text-[11px] leading-relaxed text-neutral-700">
                หมายเหตุ: เอกสารฉบับนี้เป็นหลักฐานผลการตรวจนับในระบบ StockCount
                Pro กรุณาลงลายมือชื่อให้ครบทุกช่องก่อนเก็บเข้าแฟ้ม
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
            </div>

            <p className="mt-3 shrink-0 border-t border-neutral-400 pt-1.5 text-center text-[11px] font-medium tabular-nums tracking-wide">
              {totalPages}/{totalPages}
            </p>
          </section>
        </div>
      )}
    </div>
  );
}

function DocumentHeader({
  documentNo,
  documentDate,
  locationCode,
  locationName,
  hubLabel,
  versionNo,
}: {
  documentNo: string;
  documentDate: string;
  locationCode: string;
  locationName: string;
  hubLabel: string;
  versionNo: number;
}) {
  return (
    <>
      <header className="text-center">
        <p className="text-[12px] font-semibold tracking-wide">
          ระบบตรวจนับสินค้าคงเหลือ
        </p>
        <h1 className="mt-1 text-[20px] font-bold tracking-tight underline decoration-2 underline-offset-4">
          ใบตรวจนับสินค้าคงเหลือ
        </h1>
        <p className="mt-1 text-[11px] text-neutral-700">
          StockCount Pro · เอกสารยืนยันผลการตรวจนับ
        </p>
      </header>

      <table className="mt-3 w-full border-collapse border border-black text-[12px]">
        <tbody>
          <tr>
            <th className="w-[18%] border border-black bg-neutral-100 px-2 py-1 text-left font-semibold">
              เลขที่เอกสาร
            </th>
            <td className="border border-black px-2 py-1 font-medium">
              {documentNo}
            </td>
            <th className="w-[14%] border border-black bg-neutral-100 px-2 py-1 text-left font-semibold">
              วันที่นับ
            </th>
            <td className="border border-black px-2 py-1">{documentDate}</td>
          </tr>
          <tr>
            <th className="border border-black bg-neutral-100 px-2 py-1 text-left font-semibold">
              รหัสคลัง
            </th>
            <td className="border border-black px-2 py-1">{locationCode}</td>
            <th className="border border-black bg-neutral-100 px-2 py-1 text-left font-semibold">
              ชื่อคลัง
            </th>
            <td className="border border-black px-2 py-1">{locationName}</td>
          </tr>
          <tr>
            <th className="border border-black bg-neutral-100 px-2 py-1 text-left font-semibold">
              Hub / กลุ่ม
            </th>
            <td className="border border-black px-2 py-1">{hubLabel}</td>
            <th className="border border-black bg-neutral-100 px-2 py-1 text-left font-semibold">
              เวอร์ชัน
            </th>
            <td className="border border-black px-2 py-1">
              V{versionNo} · สถานะเสร็จสิ้น
            </td>
          </tr>
        </tbody>
      </table>
    </>
  );
}

function LinesTable({
  rows,
  showSummary,
  totalLines,
}: {
  rows: PrintDocumentLine[];
  showSummary: boolean;
  totalLines: number;
}) {
  return (
    <table className="w-full border-collapse border border-black text-[11.5px] leading-snug">
      <thead>
        <tr className="bg-neutral-100">
          <th className="w-12 border border-black px-1.5 py-1 text-center font-semibold">
            ลำดับ
          </th>
          <th className="w-24 border border-black px-1.5 py-1 text-left font-semibold">
            รหัสสินค้า
          </th>
          <th className="border border-black px-1.5 py-1 text-left font-semibold">
            ชื่อสินค้า
          </th>
          <th className="w-16 border border-black px-1.5 py-1 text-right font-semibold">
            ลัง
          </th>
          <th className="w-16 border border-black px-1.5 py-1 text-right font-semibold">
            ชิ้น
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((line) => (
          <tr key={`${line.lineNo}-${line.productCode}`}>
            <td className="border border-black px-1.5 py-0.5 text-center align-top">
              {line.lineNo}
            </td>
            <td className="border border-black px-1.5 py-0.5 align-top">
              {line.productCode}
            </td>
            <td className="border border-black px-1.5 py-0.5 align-top">
              {line.productName}
            </td>
            <td className="border border-black px-1.5 py-0.5 text-right align-top tabular-nums">
              {formatQty(line.qtyCase)}
            </td>
            <td className="border border-black px-1.5 py-0.5 text-right align-top tabular-nums">
              {formatQty(line.qtyPiece)}
            </td>
          </tr>
        ))}
        {showSummary && (
          <tr className="bg-neutral-50">
            <td
              colSpan={5}
              className="border border-black px-1.5 py-1 text-[11px]"
            >
              รวมทั้งสิ้น <strong>{totalLines}</strong> รายการ
              <span className="ml-3 text-neutral-700">· หน่วยนับ: ลัง / ชิ้น</span>
            </td>
          </tr>
        )}
      </tbody>
    </table>
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
