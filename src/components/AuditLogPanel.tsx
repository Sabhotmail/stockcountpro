import type { AuditLog } from "@/types/audit";
import { AuditAction } from "@/types/audit";

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
};

export function AuditLogPanel({ logs }: { logs: AuditLog[] }) {
  if (logs.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-slate-500">ยังไม่มี audit log</p>
    );
  }

  return (
    <div className="max-h-96 overflow-y-auto">
      <table className="w-full text-left text-sm">
        <thead className="sticky top-0 bg-slate-50 text-slate-600">
          <tr>
            <th className="px-3 py-2 font-medium">เวลา</th>
            <th className="px-3 py-2 font-medium">การกระทำ</th>
            <th className="px-3 py-2 font-medium">ผู้ใช้</th>
            <th className="px-3 py-2 font-medium">รายละเอียด</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log, index) => (
            <tr
              key={`${log.id}-${log.createdAt}-${index}`}
              className="border-t border-slate-100"
            >
              <td className="px-3 py-2 whitespace-nowrap text-slate-500">
                {new Date(log.createdAt).toLocaleString("th-TH")}
              </td>
              <td className="px-3 py-2 font-medium text-slate-800">
                {actionLabels[log.action]}
              </td>
              <td className="px-3 py-2 text-slate-600">{log.userName}</td>
              <td className="px-3 py-2 text-slate-500">{log.detail ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
