import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { VersionCompareResult } from "@/types/count";

function qtyClass(value: number | null): string {
  if (value === null) return "text-muted-foreground";
  if (value === 0) return "text-amber-600";
  return "";
}

function differenceClass(difference: number | null): string {
  if (difference === null) return "text-muted-foreground";
  if (difference === 0) return "text-green-600";
  if (difference > 0) return "text-blue-600";
  return "text-red-600";
}

export function VersionCompareDetail({
  compare,
}: {
  compare: VersionCompareResult;
}) {
  return (
    <div>
      <p className="mb-3 text-sm text-muted-foreground">
        เปรียบเทียบ V{compare.fromVersion.versionNo} → V
        {compare.toVersion.versionNo}
      </p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>รหัส</TableHead>
            <TableHead>ชื่อสินค้า</TableHead>
            <TableHead className="text-right">
              V{compare.fromVersion.versionNo}
            </TableHead>
            <TableHead className="text-right">
              V{compare.toVersion.versionNo}
            </TableHead>
            <TableHead className="text-right">ต่าง</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {compare.lines.map((line) => (
            <TableRow key={line.lineId}>
              <TableCell className="font-medium">{line.productCode}</TableCell>
              <TableCell>{line.productName}</TableCell>
              <TableCell className={`text-right ${qtyClass(line.fromQty)}`}>
                {line.fromQty ?? "—"}
              </TableCell>
              <TableCell className={`text-right ${qtyClass(line.toQty)}`}>
                {line.toQty ?? "—"}
              </TableCell>
              <TableCell
                className={`text-right font-medium ${differenceClass(line.difference)}`}
              >
                {line.difference ?? "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
