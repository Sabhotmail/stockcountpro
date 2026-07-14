import { DocumentStatusBadge } from "@/components/DocumentStatusBadge";
import { Button } from "@/components/ui/button";
import { dateKeyToDmy } from "@/lib/datetime";
import { cn } from "@/lib/utils";
import { DocumentStatus, type CountDocumentListItem } from "@/types/count";

function locationMeta(doc: CountDocumentListItem): string {
  const parts: string[] = [];
  const date = dateKeyToDmy(doc.documentDate) || doc.documentDate;
  if (date) parts.push(date);
  if (doc.locationCode) parts.push(doc.locationCode);
  if (doc.locationName) parts.push(doc.locationName);
  if (doc.hubShortName) parts.push(`Hub ${doc.hubShortName}`);
  else if (doc.isCentral) parts.push("HQ กลาง");
  return parts.join(" · ");
}

export function TabletDocumentRow({
  doc,
  starting,
  deleting,
  onOpen,
  onDelete,
}: {
  doc: CountDocumentListItem;
  starting: boolean;
  deleting: boolean;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const canDelete = doc.status === DocumentStatus.IMPORTED;
  const openLabel =
    starting
      ? "กำลังเปิด..."
      : doc.status === DocumentStatus.IMPORTED ||
          doc.status === DocumentStatus.RECOUNT_REQUESTED
        ? "เริ่มนับ"
        : "เปิดเอกสาร";

  return (
    <div
      className={cn(
        "flex flex-col gap-3 border-b border-border/70 py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between",
        doc.status === DocumentStatus.RECOUNT_REQUESTED && "bg-orange-50/40",
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold tracking-tight">{doc.documentNo}</p>
          <DocumentStatusBadge status={doc.status} compact />
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{locationMeta(doc)}</p>
        <p className="mt-1 text-xs text-muted-foreground tabular-nums">
          เวอร์ชัน {doc.currentVersionNo || "—"} · นับแล้ว{" "}
          <span className="font-medium text-foreground">
            {doc.countedLines}/{doc.totalLines}
          </span>
        </p>
      </div>

      <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
        {canDelete && (
          <Button
            type="button"
            variant="outline"
            disabled={deleting || starting}
            onClick={onDelete}
            size="lg"
            className="min-h-11 w-full sm:w-auto"
          >
            {deleting ? "กำลังลบ..." : "ลบ"}
          </Button>
        )}
        <Button
          type="button"
          disabled={starting || deleting}
          onClick={onOpen}
          size="lg"
          className="min-h-11 w-full sm:w-auto"
        >
          {openLabel}
        </Button>
      </div>
    </div>
  );
}
