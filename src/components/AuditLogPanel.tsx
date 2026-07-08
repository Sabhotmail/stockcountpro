import type { AuditLog } from "@/types/audit";
import { AuditAction } from "@/types/audit";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const actionLabels: Record<AuditAction, string> = {
  [AuditAction.LOGIN]: "เข้าสู่ระบบ",
  [AuditAction.OPEN_DOCUMENT]: "เปิดเอกสาร",
  [AuditAction.START_COUNT]: "เริ่มนับ",
  [AuditAction.AUTO_SAVE_COUNT]: "บันทึกอัตโนมัติ",
  [AuditAction.SUBMIT_TO_SUPERVISOR]: "ส่งให้หัวหน้างาน",
  [AuditAction.CREATE_VERSION]: "สร้างเวอร์ชัน",
  [AuditAction.REQUEST_RECOUNT]: "ขอนับใหม่",
  [AuditAction.APPROVE_VERSION]: "อนุมัติเวอร์ชัน",
  [AuditAction.COMPLETE_DOCUMENT]: "ปิดเอกสาร",
  [AuditAction.IMPORT_FROM_EXPRESS]: "Sync จาก Express",
};

export function AuditLogPanel({ logs }: { logs: AuditLog[] }) {
  if (logs.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        ยังไม่มี audit log
      </p>
    );
  }

  return (
    <div className="max-h-96 overflow-y-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>เวลา</TableHead>
            <TableHead>การกระทำ</TableHead>
            <TableHead>ผู้ใช้</TableHead>
            <TableHead>รายละเอียด</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.map((log, index) => (
            <TableRow key={`${log.id}-${log.createdAt}-${index}`}>
              <TableCell className="whitespace-nowrap text-muted-foreground">
                {new Date(log.createdAt).toLocaleString("th-TH")}
              </TableCell>
              <TableCell className="font-medium">
                {actionLabels[log.action]}
              </TableCell>
              <TableCell>{log.userName}</TableCell>
              <TableCell className="text-muted-foreground">
                {log.detail ?? "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
