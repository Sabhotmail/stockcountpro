import type { ReviewLineItem } from "@/types/count";

function differenceClass(difference: number | null): string {
  if (difference === null) return "text-slate-400";
  if (difference === 0) return "text-green-600";
  if (difference > 0) return "text-blue-600";
  return "text-red-600";
}

export function ReviewLineCard({ line }: { line: ReviewLineItem }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-slate-900">{line.productCode}</p>
          <p className="mt-0.5 text-sm text-slate-700">{line.productName}</p>
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
          <dt className="text-slate-500">คาดหวัง</dt>
          <dd className="font-medium text-slate-800">{line.expectedQty}</dd>
        </div>
        <div>
          <dt className="text-slate-500">นับได้</dt>
          <dd className="font-medium text-slate-800">
            {line.totalBaseQty ?? "—"}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">ต่าง</dt>
          <dd className={`font-semibold ${differenceClass(line.difference)}`}>
            {line.difference ?? "—"}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">เวอร์ชัน</dt>
          <dd className="font-medium text-slate-800">V{line.versionNo}</dd>
        </div>
      </dl>
    </div>
  );
}

export function ReviewLineTable({ lines }: { lines: ReviewLineItem[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="bg-slate-50 text-slate-600">
          <tr>
            <th className="px-4 py-3 font-medium">รหัส</th>
            <th className="px-4 py-3 font-medium">ชื่อสินค้า</th>
            <th className="px-4 py-3 font-medium text-right">คาดหวัง</th>
            <th className="px-4 py-3 font-medium text-right">นับได้</th>
            <th className="px-4 py-3 font-medium text-right">ต่าง</th>
            <th className="px-4 py-3 font-medium text-center">เวอร์ชัน</th>
            <th className="px-4 py-3 font-medium text-center">สถานะ</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr key={line.lineId} className="border-t border-slate-100">
              <td className="px-4 py-3 font-medium whitespace-nowrap text-slate-900">
                {line.productCode}
              </td>
              <td className="px-4 py-3 text-slate-700">{line.productName}</td>
              <td className="px-4 py-3 text-right text-slate-700">
                {line.expectedQty}
              </td>
              <td className="px-4 py-3 text-right text-slate-700">
                {line.totalBaseQty ?? "—"}
              </td>
              <td
                className={`px-4 py-3 text-right font-medium ${differenceClass(line.difference)}`}
              >
                {line.difference ?? "—"}
              </td>
              <td className="px-4 py-3 text-center text-slate-600">
                V{line.versionNo}
              </td>
              <td className="px-4 py-3 text-center">
                {line.isCounted ? (
                  <span className="text-green-600">นับแล้ว</span>
                ) : (
                  <span className="text-amber-600">ยังไม่นับ</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
