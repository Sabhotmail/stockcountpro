import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTimeShortTH } from "@/lib/datetime";
import type { CountVersion } from "@/types/count";
import { VersionStatus } from "@/types/count";

const statusLabels: Record<VersionStatus, string> = {
  [VersionStatus.DRAFT]: "ร่าง",
  [VersionStatus.SUBMITTED]: "ส่งแล้ว",
  [VersionStatus.RECOUNT]: "นับใหม่",
  [VersionStatus.APPROVED]: "อนุมัติ",
  [VersionStatus.LOCKED]: "ล็อก",
};

export function VersionCompareTable({ versions }: { versions: CountVersion[] }) {
  if (versions.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        ยังไม่มีเวอร์ชัน
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>เวอร์ชัน</TableHead>
          <TableHead>สถานะ</TableHead>
          <TableHead>สร้างโดย</TableHead>
          <TableHead>สร้างเมื่อ</TableHead>
          <TableHead>ส่งเมื่อ</TableHead>
          <TableHead>อ้างอิง</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {versions.map((version) => (
          <TableRow key={version.id}>
            <TableCell className="font-semibold">V{version.versionNo}</TableCell>
            <TableCell>{statusLabels[version.status]}</TableCell>
            <TableCell>{version.createdBy}</TableCell>
            <TableCell className="text-muted-foreground">
              {formatDateTimeShortTH(version.createdAt)}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {formatDateTimeShortTH(version.submittedAt)}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {version.baseVersionId ?? "—"}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
