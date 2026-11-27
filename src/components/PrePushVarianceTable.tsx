import { formatCountQtyCasePiece } from "@/lib/count-qty";
import { normalizeProductCode } from "@/lib/express-variance-map";
import { projectedDiff } from "@/lib/pre-push-variance";
import { cn } from "@/lib/utils";
import type { ReviewLineItem } from "@/types/count";

function formatCountedQty(line: ReviewLineItem): string {
  if (!line.isCounted) return "—";
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

function DiffValue({ value }: { value: number | null }) {
  if (value == null) {
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

type Props = {
  lines: ReviewLineItem[];
  balanceByProductCode: Record<string, number | null> | null;
};

export function PrePushVarianceTable({
  lines,
  balanceByProductCode,
}: Props) {
  if (balanceByProductCode == null) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        ยังไม่ได้ดึงคงเหลือ — กด「ดึงคงเหลือ Express」เพื่อเปรียบเทียบก่อนส่ง
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
      <table className="w-full min-w-[48rem] border-collapse text-sm">
        <thead>
          <tr className="border-b text-xs font-medium tracking-wide text-muted-foreground">
            <th className="whitespace-nowrap px-3 py-2 text-left font-medium">
              รหัส
            </th>
            <th className="px-3 py-2 text-left font-medium">ชื่อ</th>
            <th className="whitespace-nowrap px-3 py-2 text-right font-medium">
              นับได้ (ที่จะส่ง)
            </th>
            <th className="whitespace-nowrap px-3 py-2 text-right font-medium">
              คงเหลือใน Express
            </th>
            <th className="whitespace-nowrap px-3 py-2 text-right font-medium">
              ผลต่างที่คาด
            </th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => {
            const key = normalizeProductCode(line.productCode);
            const hasBalance = Object.prototype.hasOwnProperty.call(
              balanceByProductCode,
              key,
            );
            const locBal = hasBalance ? balanceByProductCode[key] : null;
            const appQty = line.isCounted ? line.totalBaseQty : null;
            const diff = projectedDiff(appQty, hasBalance ? locBal : null);

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
                <td className="max-w-[28rem] px-3 py-2.5">{line.productName}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">
                  {formatCountedQty(line)}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">
                  {hasBalance ? (
                    formatNumber(locBal)
                  ) : (
                    <span className="text-muted-foreground">ไม่พบคงเหลือ</span>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right">
                  <DiffValue value={diff} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
