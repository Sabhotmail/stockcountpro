import { DocumentStatusBadge } from "@/components/DocumentStatusBadge";
import { Button } from "@/components/ui/button";
import { dateKeyToDmy } from "@/lib/datetime";
import { cn } from "@/lib/utils";
import { DocumentStatus, type CountDocumentListItem } from "@/types/count";

function primaryTitle(doc: CountDocumentListItem): string {
  const code = doc.locationCode?.trim();
  const name = doc.locationName?.trim();
  if (code && name) return `${code} · ${name}`;
  if (code) return code;
  if (name) return name;
  return doc.documentNo;
}

function secondaryMeta(doc: CountDocumentListItem): string {
  const parts: string[] = [];
  const date = dateKeyToDmy(doc.documentDate) || doc.documentDate;
  if (date) parts.push(date);
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

  const meta = secondaryMeta(doc);

  return (
    <div
      className={cn(
        "flex flex-col gap-3 py-3.5 sm:flex-row sm:items-center sm:justify-between",
        doc.status === DocumentStatus.RECOUNT_REQUESTED && "bg-amber-50/50",
        doc.status === DocumentStatus.COUNTING && "bg-muted/30",
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate font-semibold tracking-tight">
            {primaryTitle(doc)}
          </p>
          <DocumentStatusBadge status={doc.status} compact />
        </div>
        <p className="mt-1 text-sm text-muted-foreground tabular-nums">
          {meta ? `${meta} · ` : ""}
          นับแล้ว{" "}
          <span className="font-medium text-foreground">
            {doc.countedLines}/{doc.totalLines}
          </span>
          {doc.currentVersionNo > 0 ? ` · V${doc.currentVersionNo}` : ""}
        </p>
      </div>

      <div className="flex shrink-0 gap-2">
        {canDelete && (
          <Button
            type="button"
            variant="outline"
            disabled={deleting || starting}
            onClick={onDelete}
            size="lg"
            className="min-h-11 flex-1 sm:flex-none sm:w-auto"
          >
            {deleting ? "กำลังลบ..." : "ลบ"}
          </Button>
        )}
        <Button
          type="button"
          disabled={starting || deleting}
          onClick={onOpen}
          size="lg"
          className="min-h-11 flex-1 bg-green-600 hover:bg-green-700 sm:flex-none sm:w-auto"
        >
          {openLabel}
        </Button>
      </div>
    </div>
  );
}
