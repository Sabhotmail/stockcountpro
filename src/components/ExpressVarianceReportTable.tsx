import { formatCountQtyCasePiece } from "@/lib/count-qty";
import { normalizeProductCode } from "@/lib/express-variance-map";
import { cn } from "@/lib/utils";
import type { ReviewLineItem } from "@/types/count";
import type { ExpressVarianceLine } from "@/types/express-variance";

function formatCountedQty(line: ReviewLineItem): string {
  return formatCountQtyCasePiece({
    qtyCase: line.qtyCase,
    qtyPack: line.qtyPack,
    qtyPiece: line.qtyPiece,
    allowCase: line.allowCase,
    allowPack: line.allowPack,
    allowPiece: line.allowPiece,
    unitCaseName: line.unitCaseName,
    unitPackName: line.unitPackName,
    unitPieceName: line.unitPieceName,
    isCounted: line.isCounted,
  });
}

function formatNumber(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("th-TH", {
    maximumFractionDigits: 3,
  }).format(value);
}

function DiffValue({ value }: { value: number | null | undefined }) {
  if (value == null || Number.isNaN(value)) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <span
      className={cn(
        "tabular-nums",
        value > 0 && "text-emerald-700",
        value < 0 && "text-destructive",
      )}
    >
      {formatNumber(value)}
    </span>
  );
}

function lookupExpress(
  map: Record<string, ExpressVarianceLine> | null | undefined,
  productCode: string,
): ExpressVarianceLine | undefined {
  if (!map) return undefined;
  return map[normalizeProductCode(productCode)];
}

type Props = {
  lines: ReviewLineItem[];
  expressVarianceByProductCode: Record<string, ExpressVarianceLine> | null;
};

export function ExpressVarianceReportTable({
  lines,
  expressVarianceByProductCode,
}: Props) {
  const fetched = expressVarianceByProductCode != null;

  if (!fetched) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        ยังไม่ได้ดึงรายงาน — กด「ดึงรายงานผลต่างจาก Express」เพื่อโหลด
      </p>
    );
  }

  if (lines.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        ไม่พบรายการสินค้า
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[56rem] border-collapse text-sm">
        <thead>
          <tr className="border-b text-xs font-medium tracking-wide text-muted-foreground">
            <th
              rowSpan={2}
              className="whitespace-nowrap px-3 py-2 text-left font-medium align-bottom"
            >
              รหัส
            </th>
            <th
              rowSpan={2}
              className="px-3 py-2 text-left font-medium align-bottom"
            >
              ชื่อ
            </th>
            <th
              colSpan={2}
              className="whitespace-nowrap px-3 py-1.5 text-center font-semibold text-foreground/80"
            >
              ฝั่งแอป
            </th>
            <th
              colSpan={3}
              className="whitespace-nowrap px-3 py-1.5 text-center font-semibold text-foreground/80"
            >
              ฝั่ง Express
            </th>
          </tr>
          <tr className="border-b text-left text-xs font-medium tracking-wide text-muted-foreground">
            <th className="whitespace-nowrap px-3 py-2.5 text-right font-medium">
              นับได้
            </th>
            <th className="whitespace-nowrap px-3 py-2.5 text-right font-medium">
              ผลต่างแอป
            </th>
            <th className="whitespace-nowrap px-3 py-2.5 text-right font-medium">
              ยอดนับ
            </th>
            <th className="whitespace-nowrap px-3 py-2.5 text-right font-medium">
              คงเหลือ
            </th>
            <th className="whitespace-nowrap px-3 py-2.5 text-right font-medium">
              ผลต่าง
            </th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => {
            const express = lookupExpress(
              expressVarianceByProductCode,
              line.productCode,
            );
            return (
              <tr
                key={line.lineId}
                className={cn(
                  "border-b border-border/60 transition-colors hover:bg-muted/40",
                  !line.isCounted && "bg-amber-50/30",
                )}
              >
                <td className="whitespace-nowrap px-3 py-2.5 font-medium tabular-nums">
                  {line.productCode}
                </td>
                <td className="max-w-[28rem] px-3 py-2.5 text-foreground/90">
                  {line.productName}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">
                  {formatCountedQty(line)}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right">
                  <DiffValue value={line.difference} />
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">
                  {express ? (
                    formatNumber(express.PhysicalBalance)
                  ) : (
                    <span className="text-muted-foreground">ไม่พบใน Express</span>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">
                  {express ? formatNumber(express.LocationBalance) : "—"}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right">
                  {express ? <DiffValue value={express.DifferentQty} /> : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function ExpressVarianceReportCards({
  lines,
  expressVarianceByProductCode,
}: Props) {
  const fetched = expressVarianceByProductCode != null;

  if (!fetched) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        ยังไม่ได้ดึงรายงาน — กด「ดึงรายงานผลต่างจาก Express」เพื่อโหลด
      </p>
    );
  }

  return (
    <div>
      {lines.map((line) => {
        const express = lookupExpress(
          expressVarianceByProductCode,
          line.productCode,
        );
        return (
          <div
            key={line.lineId}
            className={cn(
              "border-b border-border/70 px-1 py-3 last:border-b-0",
              !line.isCounted && "bg-amber-50/40",
            )}
          >
            <p className="font-medium tabular-nums tracking-tight">
              {line.productCode}
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {line.productName}
            </p>
            <p className="mt-2 text-sm tabular-nums">
              <span className="text-muted-foreground">แอป นับได้ </span>
              <span className="font-medium">{formatCountedQty(line)}</span>
              <span className="mx-2 text-muted-foreground">·</span>
              <span className="text-muted-foreground">ผลต่าง </span>
              <DiffValue value={line.difference} />
            </p>
            <p className="mt-1.5 text-sm tabular-nums">
              {express ? (
                <>
                  <span className="text-muted-foreground">Express นับ </span>
                  <span className="font-medium">
                    {formatNumber(express.PhysicalBalance)}
                  </span>
                  <span className="mx-2 text-muted-foreground">·</span>
                  <span className="text-muted-foreground">คงเหลือ </span>
                  <span className="font-medium">
                    {formatNumber(express.LocationBalance)}
                  </span>
                  <span className="mx-2 text-muted-foreground">·</span>
                  <span className="text-muted-foreground">ผลต่าง </span>
                  <DiffValue value={express.DifferentQty} />
                </>
              ) : (
                <span className="text-muted-foreground">ไม่พบใน Express</span>
              )}
            </p>
          </div>
        );
      })}
      {lines.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          ไม่พบรายการสินค้า
        </p>
      )}
    </div>
  );
}
