import type { VersionCompareResult } from "@/types/count";

function qtyClass(value: number | null): string {
  if (value === null) return "text-slate-400";
  if (value === 0) return "text-amber-600";
  return "text-slate-800";
}

export function VersionCompareDetail({
  compare,
}: {
  compare: VersionCompareResult;
}) {
  return (
    <div className="overflow-x-auto">
      <p className="mb-3 text-sm text-slate-600">
        เปรียบเทียบ V{compare.fromVersion.versionNo} → V
        {compare.toVersion.versionNo}
      </p>
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="bg-slate-50 text-slate-600">
          <tr>
            <th className="px-4 py-3 font-medium">รหัส</th>
            <th className="px-4 py-3 font-medium">ชื่อสินค้า</th>
            <th className="px-4 py-3 font-medium text-right">
              V{compare.fromVersion.versionNo}
            </th>
            <th className="px-4 py-3 font-medium text-right">
              V{compare.toVersion.versionNo}
            </th>
            <th className="px-4 py-3 font-medium text-right">ต่าง</th>
          </tr>
        </thead>
        <tbody>
          {compare.lines.map((line) => (
            <tr key={line.lineId} className="border-t border-slate-100">
              <td className="px-4 py-3 font-medium text-slate-900">
                {line.productCode}
              </td>
              <td className="px-4 py-3 text-slate-700">{line.productName}</td>
              <td className={`px-4 py-3 text-right ${qtyClass(line.fromQty)}`}>
                {line.fromQty ?? "—"}
              </td>
              <td className={`px-4 py-3 text-right ${qtyClass(line.toQty)}`}>
                {line.toQty ?? "—"}
              </td>
              <td
                className={`px-4 py-3 text-right font-medium ${
                  line.difference === null
                    ? "text-slate-400"
                    : line.difference === 0
                      ? "text-green-600"
                      : line.difference > 0
                        ? "text-blue-600"
                        : "text-red-600"
                }`}
              >
                {line.difference ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
