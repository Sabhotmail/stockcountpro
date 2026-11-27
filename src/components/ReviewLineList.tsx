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

type ReviewLineProps = {
  line: ReviewLineItem;
  expressVarianceByProductCode?: Record<string, ExpressVarianceLine> | null;
  showExpressColumns?: boolean;
};

export function ReviewLineCard({
  line,
  expressVarianceByProductCode,
  showExpressColumns = false,
}: ReviewLineProps) {
  const express = showExpressColumns
    ? lookupExpress(expressVarianceByProductCode, line.productCode)
    : undefined;

  return (
    <div
      className={cn(
        "border-b border-border/70 px-1 py-3 last:border-b-0",
        !line.isCounted && "bg-amber-50/40",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium tabular-nums tracking-tight">
            {line.productCode}
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {line.productName}
          </p>
        </div>
        <span
          className={cn(
            "shrink-0 text-xs font-medium",
            line.isCounted ? "text-emerald-700" : "text-amber-700",
          )}
        >
          {line.isCounted ? "นับแล้ว" : "ยังไม่นับ"}
        </span>
      </div>
      <p className="mt-2 text-sm tabular-nums">
        <span className="text-muted-foreground">นับได้ </span>
        <span className="font-medium">{formatCountedQty(line)}</span>
        <span className="mx-2 text-muted-foreground">·</span>
        <span className="text-muted-foreground">ผลต่างแอป </span>
        <DiffValue value={line.difference} />
      </p>
      {showExpressColumns && (
        <p className="mt-1.5 text-sm tabular-nums">
          {express ? (
            <>
              <span className="text-muted-foreground">นับ Express </span>
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
      )}
    </div>
  );
}

type ReviewLineTableProps = {
  lines: ReviewLineItem[];
  expressVarianceByProductCode?: Record<string, ExpressVarianceLine> | null;
  showExpressColumns?: boolean;
};

export function ReviewLineTable({
  lines,
  expressVarianceByProductCode,
  showExpressColumns = false,
}: ReviewLineTableProps) {
  return (
    <div className="overflow-x-auto">
      <table
        className={cn(
          "w-full border-collapse text-sm",
          showExpressColumns ? "min-w-[56rem]" : "min-w-[40rem]",
        )}
      >
        <thead>
          <tr className="border-b text-left text-xs font-medium tracking-wide text-muted-foreground">
            <th className="whitespace-nowrap px-3 py-2.5 font-medium">รหัส</th>
            <th className="px-3 py-2.5 font-medium">ชื่อสินค้า</th>
            <th className="whitespace-nowrap px-3 py-2.5 text-right font-medium">
              นับได้
            </th>
            <th className="whitespace-nowrap px-3 py-2.5 text-right font-medium">
              ผลต่างแอป
            </th>
            {showExpressColumns && (
              <>
                <th className="whitespace-nowrap px-3 py-2.5 text-right font-medium">
                  ยอดนับ Express
                </th>
                <th className="whitespace-nowrap px-3 py-2.5 text-right font-medium">
                  คงเหลือ Express
                </th>
                <th className="whitespace-nowrap px-3 py-2.5 text-right font-medium">
                  ผลต่าง Express
                </th>
              </>
            )}
            <th className="whitespace-nowrap px-3 py-2.5 text-right font-medium">
              สถานะ
            </th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => {
            const express = showExpressColumns
              ? lookupExpress(expressVarianceByProductCode, line.productCode)
              : undefined;

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
                {showExpressColumns && (
                  <>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">
                      {express ? (
                        formatNumber(express.PhysicalBalance)
                      ) : (
                        <span className="text-muted-foreground">
                          ไม่พบใน Express
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">
                      {express ? formatNumber(express.LocationBalance) : "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right">
                      {express ? (
                        <DiffValue value={express.DifferentQty} />
                      ) : (
                        "—"
                      )}
                    </td>
                  </>
                )}
                <td className="whitespace-nowrap px-3 py-2.5 text-right">
                  {line.isCounted ? (
                    <span className="text-emerald-700">นับแล้ว</span>
                  ) : (
                    <span className="text-amber-700">ยังไม่นับ</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
