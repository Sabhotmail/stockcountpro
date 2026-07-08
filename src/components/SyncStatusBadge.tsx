import type { SyncStatus } from "@/types/count";

const statusConfig: Record<
  SyncStatus,
  { label: string; className: string }
> = {
  idle: { label: "", className: "" },
  saving: { label: "กำลังบันทึก...", className: "text-blue-600" },
  saved: { label: "บันทึกแล้ว", className: "text-green-600" },
  failed: { label: "บันทึกไม่สำเร็จ", className: "text-red-600" },
  waiting: { label: "รอซิงค์", className: "text-amber-600" },
};

export function SyncStatusBadge({ status }: { status: SyncStatus }) {
  if (status === "idle") return null;
  const config = statusConfig[status];
  return (
    <span className={`text-sm font-medium ${config.className}`}>
      {config.label}
    </span>
  );
}
