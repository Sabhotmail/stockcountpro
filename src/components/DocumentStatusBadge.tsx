import { DocumentStatus } from "@/types/count";

const statusConfig: Record<
  DocumentStatus,
  { label: string; className: string }
> = {
  [DocumentStatus.IMPORTED]: {
    label: "ยังไม่เริ่ม",
    className: "bg-slate-100 text-slate-700",
  },
  [DocumentStatus.COUNTING]: {
    label: "กำลังนับ",
    className: "bg-blue-100 text-blue-800",
  },
  [DocumentStatus.SUBMITTED]: {
    label: "ส่งแล้ว",
    className: "bg-amber-100 text-amber-800",
  },
  [DocumentStatus.REVIEWING]: {
    label: "กำลังตรวจ",
    className: "bg-purple-100 text-purple-800",
  },
  [DocumentStatus.RECOUNT_REQUESTED]: {
    label: "ขอนับใหม่",
    className: "bg-orange-100 text-orange-800",
  },
  [DocumentStatus.APPROVED]: {
    label: "อนุมัติแล้ว",
    className: "bg-green-100 text-green-800",
  },
  [DocumentStatus.COMPLETED]: {
    label: "เสร็จสิ้น",
    className: "bg-emerald-100 text-emerald-800",
  },
};

export function DocumentStatusBadge({
  status,
  compact,
}: {
  status: DocumentStatus;
  compact?: boolean;
}) {
  const config = statusConfig[status];
  return (
    <span
      className={`inline-flex shrink-0 whitespace-nowrap rounded-full font-medium ${config.className} ${
        compact ? "px-2.5 py-0.5 text-xs" : "px-3 py-1 text-sm"
      }`}
    >
      {config.label}
    </span>
  );
}
