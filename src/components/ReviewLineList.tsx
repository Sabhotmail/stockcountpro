import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ReviewLineItem } from "@/types/count";

function differenceClass(difference: number | null): string {
  if (difference === null) return "text-muted-foreground";
  if (difference === 0) return "text-green-600";
  if (difference > 0) return "text-blue-600";
  return "text-red-600";
}

export function ReviewLineCard({ line }: { line: ReviewLineItem }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold">{line.productCode}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {line.productName}
            </p>
          </div>
          <span
            className={`shrink-0 text-xs font-medium ${
              line.isCounted ? "text-green-600" : "text-amber-600"
            }`}
          >
            {line.isCounted ? "นับแล้ว" : "ยังไม่นับ"}
          </span>
        </div>

        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-muted-foreground">คาดหวัง</dt>
            <dd className="font-medium">{line.expectedQty}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">นับได้</dt>
            <dd className="font-medium">{line.totalBaseQty ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">ต่าง</dt>
            <dd className={`font-semibold ${differenceClass(line.difference)}`}>
              {line.difference ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">เวอร์ชัน</dt>
            <dd className="font-medium">V{line.versionNo}</dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}

export function ReviewLineTable({ lines }: { lines: ReviewLineItem[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>รหัส</TableHead>
          <TableHead>ชื่อสินค้า</TableHead>
          <TableHead className="text-right">คาดหวัง</TableHead>
          <TableHead className="text-right">นับได้</TableHead>
          <TableHead className="text-right">ต่าง</TableHead>
          <TableHead className="text-center">เวอร์ชัน</TableHead>
          <TableHead className="text-center">สถานะ</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {lines.map((line) => (
          <TableRow key={line.lineId}>
            <TableCell className="whitespace-nowrap font-medium">
              {line.productCode}
            </TableCell>
            <TableCell>{line.productName}</TableCell>
            <TableCell className="text-right">{line.expectedQty}</TableCell>
            <TableCell className="text-right">
              {line.totalBaseQty ?? "—"}
            </TableCell>
            <TableCell
              className={`text-right font-medium ${differenceClass(line.difference)}`}
            >
              {line.difference ?? "—"}
            </TableCell>
            <TableCell className="text-center text-muted-foreground">
              V{line.versionNo}
            </TableCell>
            <TableCell className="text-center">
              {line.isCounted ? (
                <span className="text-green-600">นับแล้ว</span>
              ) : (
                <span className="text-amber-600">ยังไม่นับ</span>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
