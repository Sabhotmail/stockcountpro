import { formatCountQtyCasePiece } from "@/lib/count-qty";
import { cn } from "@/lib/utils";
import type { ReviewLineItem } from "@/types/count";

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

export function ReviewLineCard({ line }: { line: ReviewLineItem }) {
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
      </p>
    </div>
  );
}

export function ReviewLineTable({ lines }: { lines: ReviewLineItem[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[36rem] border-collapse text-sm">
        <thead>
          <tr className="border-b text-left text-xs font-medium tracking-wide text-muted-foreground">
            <th className="whitespace-nowrap px-3 py-2.5 font-medium">รหัส</th>
            <th className="px-3 py-2.5 font-medium">ชื่อสินค้า</th>
            <th className="whitespace-nowrap px-3 py-2.5 text-right font-medium">
              นับได้
            </th>
            <th className="whitespace-nowrap px-3 py-2.5 text-right font-medium">
              สถานะ
            </th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
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
                {line.isCounted ? (
                  <span className="text-emerald-700">นับแล้ว</span>
                ) : (
                  <span className="text-amber-700">ยังไม่นับ</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
