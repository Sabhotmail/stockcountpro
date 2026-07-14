"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { PrintDocumentSkeleton } from "@/components/loading/PageSkeletons";
import { isQtyFieldCounted } from "@/lib/count-qty";
import { cn } from "@/lib/utils";
import {
  type PrintDocumentLine,
  type PrintDocumentPayload,
} from "@/types/count";

/** CSS px for 1mm at 96dpi (browser print layout). */
function mm(value: number): number {
  return (value * 96) / 25.4;
}

/**
 * Print margins — keep in sync with @page in globals.css.
 * Use 12mm: many browsers/printers ignore tighter margins and overflow.
 */
const PAGE_MARGIN_MM = 12;
/**
 * Extra slack: screen row metrics are often shorter than print engine
 * metrics, so in-app preview fits but physical/print-dialog pages spill.
 */
const PRINT_SAFETY_MM = 10;
/** Inflate measured row heights for print vs screen font differences. */
const ROW_HEIGHT_PRINT_FACTOR = 1.08;

const PAGE_INNER_PX = mm(297 - PAGE_MARGIN_MM * 2 - PRINT_SAFETY_MM);
const PAGE_CONTENT_WIDTH = `${210 - PAGE_MARGIN_MM * 2}mm`;

function formatQty(value: number | null): string {
  if (!isQtyFieldCounted(value)) return "—";
  return value!.toLocaleString("th-TH");
}

function packLinesByHeight(
  lines: PrintDocumentLine[],
  rowHeights: number[],
  opts: {
    firstTopH: number;
    pageTopH: number;
    theadH: number;
    summaryH: number;
    signatureH: number;
    footerH: number;
  },
): { pages: PrintDocumentLine[][]; signaturesOnLastPage: boolean } {
  if (lines.length === 0) {
    return { pages: [[]], signaturesOnLastPage: true };
  }

  const sumHeights = (from: number, to: number) => {
    let total = 0;
    for (let i = from; i < to; i += 1) {
      total += rowHeights[i] ?? mm(6);
    }
    return total;
  };

  const budget = (isFirst: boolean) =>
    PAGE_INNER_PX -
    (isFirst ? opts.firstTopH : opts.pageTopH) -
    opts.theadH -
    opts.footerH;

  const pages: PrintDocumentLine[][] = [];
  let index = 0;
  let isFirst = true;

  // Pack rows + summary only. Signatures attach later if they fit.
  while (index < lines.length) {
    const maxH = Math.max(budget(isFirst), mm(40));
    const remainingRowsH = sumHeights(index, lines.length) + opts.summaryH;

    if (remainingRowsH <= maxH) {
      pages.push(lines.slice(index));
      break;
    }

    const chunk: PrintDocumentLine[] = [];
    let used = 0;

    while (index < lines.length) {
      const rowH = rowHeights[index] ?? mm(6);
      const restRowsH = sumHeights(index, lines.length) + opts.summaryH;

      if (chunk.length > 0 && used + restRowsH <= maxH) {
        while (index < lines.length) {
          chunk.push(lines[index]!);
          index += 1;
        }
        break;
      }

      const isLastLine = index === lines.length - 1;
      const need = isLastLine ? rowH + opts.summaryH : rowH;

      if (chunk.length > 0 && used + need > maxH) break;

      if (chunk.length === 0 && need > maxH) {
        chunk.push(lines[index]!);
        index += 1;
        break;
      }

      chunk.push(lines[index]!);
      used += rowH;
      index += 1;
    }

    pages.push(chunk);
    isFirst = false;
  }

  const lastPage = pages[pages.length - 1] ?? [];
  const lastIsFirst = pages.length === 1;
  const lastUsed =
    sumHeights(lines.length - lastPage.length, lines.length) + opts.summaryH;
  const signaturesOnLastPage =
    lastUsed + opts.signatureH <= budget(lastIsFirst);

  return { pages, signaturesOnLastPage };
}

export default function PrintDocumentPage() {
  const params = useParams<{ documentId: string }>();
  const router = useRouter();
  const documentId = params.documentId;

  const [doc, setDoc] = useState<PrintDocumentPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pages, setPages] = useState<PrintDocumentLine[][] | null>(null);
  const [signaturesOnLastPage, setSignaturesOnLastPage] = useState(true);
  const [printedAt, setPrintedAt] = useState<string>("");
  const measureRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function stampPrintedAt() {
      setPrintedAt(
        new Date().toLocaleString("th-TH", {
          day: "numeric",
          month: "numeric",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
      );
    }

    stampPrintedAt();
    window.addEventListener("beforeprint", stampPrintedAt);
    return () => window.removeEventListener("beforeprint", stampPrintedAt);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      setPages(null);
      setSignaturesOnLastPage(true);
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
    const pageTop = root.querySelector<HTMLElement>("[data-m=page-top]");
    const thead = root.querySelector<HTMLElement>("[data-m=thead]");
    const summary = root.querySelector<HTMLElement>("[data-m=summary]");
    const signature = root.querySelector<HTMLElement>("[data-m=signature]");
    const footer = root.querySelector<HTMLElement>("[data-m=footer]");
    const rowEls = [
      ...root.querySelectorAll<HTMLElement>("[data-m-row]"),
    ];

    const packed = packLinesByHeight(
      doc.lines,
      rowEls.map(
        (el) => el.getBoundingClientRect().height * ROW_HEIGHT_PRINT_FACTOR,
      ),
      {
        firstTopH:
          (firstTop?.getBoundingClientRect().height ?? 0) *
          ROW_HEIGHT_PRINT_FACTOR,
        pageTopH:
          (pageTop?.getBoundingClientRect().height ?? 0) *
          ROW_HEIGHT_PRINT_FACTOR,
        theadH:
          (thead?.getBoundingClientRect().height ?? 0) *
          ROW_HEIGHT_PRINT_FACTOR,
        summaryH:
          (summary?.getBoundingClientRect().height ?? 0) *
          ROW_HEIGHT_PRINT_FACTOR,
        signatureH:
          (signature?.getBoundingClientRect().height ?? 0) *
          ROW_HEIGHT_PRINT_FACTOR,
        footerH:
          (footer?.getBoundingClientRect().height ?? 0) *
          ROW_HEIGHT_PRINT_FACTOR,
      },
    );
    setPages(packed.pages);
    setSignaturesOnLastPage(packed.signaturesOnLastPage);
  }, [doc]);

  if (loading) {
    return <PrintDocumentSkeleton />;
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
  const totalPages =
    (pages?.length ?? 0) + (signaturesOnLastPage ? 0 : 1);

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
        className="pointer-events-none absolute top-0 left-[-10000px] text-black"
        style={{ width: PAGE_CONTENT_WIDTH }}
      >
        <div data-m="first-top">
          <DocumentHeader
            documentNo={doc.documentNo}
            documentDate={doc.documentDate}
            locationCode={locationCode}
            locationName={locationName}
            hubLabel={hubLabel}
            versionNo={doc.currentVersionNo}
            countedLines={doc.countedLines}
            totalLines={doc.totalLines}
            variant="full"
          />
          <p className="mt-3 mb-1.5 text-[12px] font-semibold">
            รายการสินค้าที่ตรวจนับ
          </p>
        </div>
        <div data-m="page-top" className="mb-2">
          <DocumentHeader
            documentNo={doc.documentNo}
            documentDate={doc.documentDate}
            locationCode={locationCode}
            locationName={locationName}
            hubLabel={hubLabel}
            versionNo={doc.currentVersionNo}
            countedLines={doc.countedLines}
            totalLines={doc.totalLines}
            variant="compact"
          />
        </div>
        <table className="w-full border-separate border-spacing-0 border border-neutral-400 text-[11.5px] leading-snug">
          <thead>
            <tr data-m="thead" className="bg-neutral-100">
              <th className="w-12 border border-neutral-400 px-1.5 py-1 text-center font-semibold">
                ลำดับ
              </th>
              <th className="w-24 border border-neutral-400 px-1.5 py-1 text-left font-semibold">
                รหัสสินค้า
              </th>
              <th className="border border-neutral-400 px-1.5 py-1 text-left font-semibold">
                ชื่อสินค้า
              </th>
              <th className="w-14 border border-neutral-400 px-1.5 py-1 text-right font-semibold">
                ลัง
              </th>
              <th className="w-14 border border-neutral-400 px-1.5 py-1 text-right font-semibold">
                ชิ้น
              </th>
              <th className="w-16 border border-neutral-400 px-1.5 py-1 text-right font-semibold">
                รวม
              </th>
            </tr>
          </thead>
          <tbody>
            {doc.lines.map((line) => (
              <tr key={`m-${line.lineNo}-${line.productCode}`} data-m-row>
                <td className="border border-neutral-400 px-1.5 py-0.5 text-center align-top">
                  {line.lineNo}
                </td>
                <td className="border border-neutral-400 px-1.5 py-0.5 align-top">
                  {line.productCode}
                </td>
                <td className="border border-neutral-400 px-1.5 py-0.5 align-top">
                  {line.productName}
                </td>
                <td className="border border-neutral-400 px-1.5 py-0.5 text-right align-top tabular-nums">
                  {formatQty(line.qtyCase)}
                </td>
                <td className="border border-neutral-400 px-1.5 py-0.5 text-right align-top tabular-nums">
                  {formatQty(line.qtyPiece)}
                </td>
                <td className="border border-neutral-400 px-1.5 py-0.5 text-right align-top font-medium tabular-nums">
                  {line.isCounted ? formatQty(line.totalBaseQty) : "—"}
                </td>
              </tr>
            ))}
            <tr data-m="summary" className="bg-neutral-50">
              <td
                colSpan={6}
                className="border border-neutral-400 px-1.5 py-1 text-[11px]"
              >
                รวมทั้งสิ้น <strong>{doc.totalLines}</strong> รายการ
                <span className="ml-3">
                  · นับแล้ว <strong>{doc.countedLines}</strong>
                </span>
                <span className="ml-3 text-neutral-700">
                  · ยังไม่นับ{" "}
                  <strong>{doc.totalLines - doc.countedLines}</strong>
                </span>
              </td>
            </tr>
          </tbody>
        </table>
        <div data-m="signature">
          <SignatureBlock printedAt={printedAt || "—"} />
        </div>
        <div data-m="footer">
          <p className="mt-2 border-t border-neutral-400 pt-1 text-center text-[11px] font-medium tabular-nums tracking-wide">
            1/1
          </p>
        </div>
      </div>

      {!pages ? (
        <div className="p-4">
          <PrintDocumentSkeleton />
        </div>
      ) : (
        <div className="mx-auto max-w-[210mm] py-4 print:max-w-none print:py-0">
          {pages.map((rows, pageIndex) => {
            const pageNo = pageIndex + 1;
            const isFirst = pageIndex === 0;
            const isLastLines = pageIndex === pages.length - 1;
            const showSignatures = isLastLines && signaturesOnLastPage;

            return (
              <section
                key={`page-${pageNo}`}
                className={cn(
                  "print-page mx-auto mb-4 flex flex-col bg-white text-black shadow-md",
                  "w-[210mm] px-[12mm] py-[12mm]",
                  "print:mb-0 print:h-auto print:w-auto print:overflow-visible print:px-0 print:py-0 print:shadow-none",
                )}
              >
                <div>
                  <div className={isFirst ? undefined : "mb-2"}>
                    <DocumentHeader
                      documentNo={doc.documentNo}
                      documentDate={doc.documentDate}
                      locationCode={locationCode}
                      locationName={locationName}
                      hubLabel={hubLabel}
                      versionNo={doc.currentVersionNo}
                      countedLines={doc.countedLines}
                      totalLines={doc.totalLines}
                      variant={isFirst ? "full" : "compact"}
                    />
                  </div>
                  {isFirst && (
                    <p className="mt-3 mb-1.5 text-[12px] font-semibold">
                      รายการสินค้าที่ตรวจนับ
                    </p>
                  )}

                  <LinesTable
                    rows={rows}
                    showSummary={isLastLines}
                    totalLines={doc.totalLines}
                    countedLines={doc.countedLines}
                  />

                  {showSignatures && <SignatureBlock printedAt={printedAt} />}
                </div>

                <p className="mt-2 shrink-0 border-t border-neutral-400 pt-1 text-center text-[11px] font-medium tabular-nums tracking-wide">
                  {pageNo}/{totalPages}
                </p>
              </section>
            );
          })}

          {!signaturesOnLastPage && (
            <section
              className={cn(
                "print-page mx-auto mb-4 flex flex-col bg-white text-black shadow-md",
                "w-[210mm] px-[12mm] py-[12mm]",
                "print:mb-0 print:h-auto print:w-auto print:overflow-visible print:px-0 print:py-0 print:shadow-none",
              )}
            >
              <div>
                <div className="mb-2">
                  <DocumentHeader
                    documentNo={doc.documentNo}
                    documentDate={doc.documentDate}
                    locationCode={locationCode}
                    locationName={locationName}
                    hubLabel={hubLabel}
                    versionNo={doc.currentVersionNo}
                    countedLines={doc.countedLines}
                    totalLines={doc.totalLines}
                    variant="compact"
                  />
                </div>
                <SignatureBlock printedAt={printedAt} />
              </div>
              <p className="mt-2 shrink-0 border-t border-neutral-400 pt-1 text-center text-[11px] font-medium tabular-nums tracking-wide">
                {totalPages}/{totalPages}
              </p>
            </section>
          )}
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
  countedLines,
  totalLines,
  variant = "full",
}: {
  documentNo: string;
  documentDate: string;
  locationCode: string;
  locationName: string;
  hubLabel: string;
  versionNo: number;
  countedLines: number;
  totalLines: number;
  variant?: "full" | "compact";
}) {
  return (
    <>
      {variant === "full" ? (
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
      ) : (
        <p className="text-center text-[11px] text-neutral-700">
          StockCount Pro · เอกสารยืนยันผลการตรวจนับ
        </p>
      )}

      <table
        className={cn(
          "w-full border-separate border-spacing-0 border border-neutral-400 text-[12px]",
          variant === "full" ? "mt-3" : "mt-2",
        )}
      >
        <tbody>
          <tr>
            <th className="w-[18%] border border-neutral-400 bg-neutral-100 px-2 py-1 text-left font-semibold">
              เลขที่เอกสาร
            </th>
            <td className="border border-neutral-400 px-2 py-1 font-medium">
              {documentNo}
            </td>
            <th className="w-[14%] border border-neutral-400 bg-neutral-100 px-2 py-1 text-left font-semibold">
              วันที่นับ
            </th>
            <td className="border border-neutral-400 px-2 py-1">{documentDate}</td>
          </tr>
          <tr>
            <th className="border border-neutral-400 bg-neutral-100 px-2 py-1 text-left font-semibold">
              รหัสคลัง
            </th>
            <td className="border border-neutral-400 px-2 py-1">{locationCode}</td>
            <th className="border border-neutral-400 bg-neutral-100 px-2 py-1 text-left font-semibold">
              ชื่อคลัง
            </th>
            <td className="border border-neutral-400 px-2 py-1">{locationName}</td>
          </tr>
          <tr>
            <th className="border border-neutral-400 bg-neutral-100 px-2 py-1 text-left font-semibold">
              Hub / กลุ่ม
            </th>
            <td className="border border-neutral-400 px-2 py-1">{hubLabel}</td>
            <th className="border border-neutral-400 bg-neutral-100 px-2 py-1 text-left font-semibold">
              เวอร์ชัน
            </th>
            <td className="border border-neutral-400 px-2 py-1">
              V{versionNo} · สถานะเสร็จสิ้น
            </td>
          </tr>
          <tr>
            <th className="border border-neutral-400 bg-neutral-100 px-2 py-1 text-left font-semibold">
              ตรวจนับแล้ว
            </th>
            <td
              className="border border-neutral-400 px-2 py-1 font-semibold tabular-nums"
              colSpan={3}
            >
              {countedLines.toLocaleString("th-TH")} /{" "}
              {totalLines.toLocaleString("th-TH")} รายการ
              <span className="ml-2 font-normal text-neutral-700">
                (ยังไม่นับ {(totalLines - countedLines).toLocaleString("th-TH")}{" "}
                รายการ)
              </span>
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
  countedLines,
}: {
  rows: PrintDocumentLine[];
  showSummary: boolean;
  totalLines: number;
  countedLines: number;
}) {
  return (
    <table className="w-full border-separate border-spacing-0 border border-neutral-400 text-[11.5px] leading-snug">
      <thead>
        <tr className="bg-neutral-100">
          <th className="w-12 border border-neutral-400 px-1.5 py-1 text-center font-semibold">
            ลำดับ
          </th>
          <th className="w-24 border border-neutral-400 px-1.5 py-1 text-left font-semibold">
            รหัสสินค้า
          </th>
          <th className="border border-neutral-400 px-1.5 py-1 text-left font-semibold">
            ชื่อสินค้า
          </th>
          <th className="w-14 border border-neutral-400 px-1.5 py-1 text-right font-semibold">
            ลัง
          </th>
          <th className="w-14 border border-neutral-400 px-1.5 py-1 text-right font-semibold">
            ชิ้น
          </th>
          <th className="w-16 border border-neutral-400 px-1.5 py-1 text-right font-semibold">
            รวม
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((line) => (
          <tr key={`${line.lineNo}-${line.productCode}`}>
            <td className="border border-neutral-400 px-1.5 py-0.5 text-center align-top">
              {line.lineNo}
            </td>
            <td className="border border-neutral-400 px-1.5 py-0.5 align-top">
              {line.productCode}
            </td>
            <td className="border border-neutral-400 px-1.5 py-0.5 align-top">
              {line.productName}
            </td>
            <td className="border border-neutral-400 px-1.5 py-0.5 text-right align-top tabular-nums">
              {formatQty(line.qtyCase)}
            </td>
            <td className="border border-neutral-400 px-1.5 py-0.5 text-right align-top tabular-nums">
              {formatQty(line.qtyPiece)}
            </td>
            <td className="border border-neutral-400 px-1.5 py-0.5 text-right align-top font-medium tabular-nums">
              {line.isCounted ? formatQty(line.totalBaseQty) : "—"}
            </td>
          </tr>
        ))}
        {showSummary && (
          <tr className="bg-neutral-50">
            <td
              colSpan={6}
              className="border border-neutral-400 px-1.5 py-1 text-[11px]"
            >
              รวมทั้งสิ้น <strong>{totalLines}</strong> รายการ
              <span className="ml-3">
                · นับแล้ว <strong>{countedLines}</strong>
              </span>
              <span className="ml-3 text-neutral-700">
                · ยังไม่นับ <strong>{totalLines - countedLines}</strong>
              </span>
              <span className="ml-3 text-neutral-700">· หน่วย: ลัง / ชิ้น</span>
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

function SignatureBlock({ printedAt }: { printedAt: string }) {
  return (
    <>
      <p className="mt-2 text-[10.5px] leading-snug text-neutral-700">
        หมายเหตุ: เอกสารฉบับนี้เป็นหลักฐานผลการตรวจนับในระบบ StockCount Pro
        กรุณาลงลายมือชื่อให้ครบทุกช่องก่อนเก็บเข้าแฟ้ม
      </p>

      <section className="mt-3 border border-neutral-400 px-2 py-2">
        <p className="mb-3 text-center text-[12px] font-bold">
          ส่วนลงนามรับรอง
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <FormalSignature action="ตรวจนับโดย" role="พนักงานธุรการ" />
          <FormalSignature action="ร่วมตรวจโดย" role="พนักงานขายหน่วยรถ" />
          <FormalSignature action="อนุมัติโดย" role="ผู้อนุมัติผลตรวจสอบ" />
        </div>
      </section>

      <footer className="mt-2 text-center text-[10px] text-neutral-500">
        พิมพ์จาก StockCount Pro · เอกสารสำหรับเก็บเป็นหลักฐานภายใน
        {printedAt ? ` · พิมพ์เมื่อ ${printedAt}` : null}
      </footer>
    </>
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
    <div className="text-center text-[10.5px]">
      <div className="mx-auto mb-0.5 h-6 w-32 border-b border-black" />
      <p className="text-[9.5px] text-neutral-600">(ลงชื่อ)</p>
      <p className="mt-2 font-medium">{action}</p>
      <div className="mx-auto mt-1 h-3.5 w-36 border-b border-black" />
      <p className="mt-1 text-[9.5px] text-neutral-700">({role})</p>
      <div className="mt-2 flex items-end justify-center gap-1">
        <span>วันที่</span>
        <span className="inline-block w-5 border-b border-black" />
        <span>/</span>
        <span className="inline-block w-5 border-b border-black" />
        <span>/</span>
        <span className="inline-block w-7 border-b border-black" />
      </div>
    </div>
  );
}
