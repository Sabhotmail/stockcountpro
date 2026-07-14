import { formatDateTimeShortTH } from "@/lib/datetime";

export function ExpressPushBadge({ at }: { at: string | null | undefined }) {
  if (!at) {
    return (
      <span className="inline-flex whitespace-nowrap rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-800">
        ยังไม่ส่ง
      </span>
    );
  }

  return (
    <span
      className="inline-flex flex-col gap-0.5 rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium leading-tight text-emerald-800"
      title={`ส่ง Express แล้ว · ${formatDateTimeShortTH(at)}`}
    >
      <span>ส่งแล้ว</span>
      <span className="font-normal text-emerald-700/80">
        {formatDateTimeShortTH(at)}
      </span>
    </span>
  );
}
