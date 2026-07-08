import { Badge } from "@/components/ui/badge";
import { DocumentStatus } from "@/types/count";
import { cn } from "@/lib/utils";

const statusConfig: Record<
  DocumentStatus,
  { label: string; variant: "default" | "secondary" | "outline" | "destructive" }
> = {
  [DocumentStatus.IMPORTED]: { label: "ยังไม่เริ่ม", variant: "secondary" },
  [DocumentStatus.COUNTING]: { label: "กำลังนับ", variant: "default" },
  [DocumentStatus.SUBMITTED]: { label: "ส่งแล้ว", variant: "outline" },
  [DocumentStatus.REVIEWING]: { label: "กำลังตรวจ", variant: "outline" },
  [DocumentStatus.RECOUNT_REQUESTED]: {
    label: "ขอนับใหม่",
    variant: "destructive",
  },
  [DocumentStatus.APPROVED]: { label: "อนุมัติแล้ว", variant: "default" },
  [DocumentStatus.COMPLETED]: { label: "เสร็จสิ้น", variant: "secondary" },
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
    <Badge
      variant={config.variant}
      className={cn(compact ? "text-xs" : "text-sm")}
    >
      {config.label}
    </Badge>
  );
}
