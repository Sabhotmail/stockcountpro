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
      <p className="py-6 text-center text-sm text-slate-500">ยังไม่มีเวอร์ชัน</p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-slate-600">
          <tr>
            <th className="px-3 py-2 font-medium">เวอร์ชัน</th>
            <th className="px-3 py-2 font-medium">สถานะ</th>
            <th className="px-3 py-2 font-medium">สร้างโดย</th>
            <th className="px-3 py-2 font-medium">สร้างเมื่อ</th>
            <th className="px-3 py-2 font-medium">ส่งเมื่อ</th>
            <th className="px-3 py-2 font-medium">อ้างอิง</th>
          </tr>
        </thead>
        <tbody>
          {versions.map((version) => (
            <tr key={version.id} className="border-t border-slate-100">
              <td className="px-3 py-2 font-semibold text-slate-900">
                V{version.versionNo}
              </td>
              <td className="px-3 py-2 text-slate-700">
                {statusLabels[version.status]}
              </td>
              <td className="px-3 py-2 text-slate-600">{version.createdBy}</td>
              <td className="px-3 py-2 text-slate-500">
                {formatDateTimeShortTH(version.createdAt)}
              </td>
              <td className="px-3 py-2 text-slate-500">
                {formatDateTimeShortTH(version.submittedAt)}
              </td>
              <td className="px-3 py-2 text-slate-500">
                {version.baseVersionId ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
