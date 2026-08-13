import { DocumentStatusBadge } from "@/components/DocumentStatusBadge";
import { Button } from "@/components/ui/button";
import { dateKeyToDmy } from "@/lib/datetime";
import { documentRowHighlightClass } from "@/lib/document-row-style";
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
  onOpen,
}: {
  doc: CountDocumentListItem;
  starting: boolean;
  onOpen: () => void;
}) {
  const openLabel =
    starting
      ? "กำลังเปิด..."
      : doc.status === DocumentStatus.IMPORTED ||
          doc.status === DocumentStatus.RECOUNT_REQUESTED
        ? "เริ่มนับ"
        : "เปิดเอกสาร";

  const meta = secondaryMeta(doc);
  const progress =
    doc.totalLines > 0 ? Math.round((doc.countedLines / doc.totalLines) * 100) : 0;

  return (
    <div
      className={cn(
        "flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between",
        documentRowHighlightClass(doc.status),
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate font-medium tracking-tight">{primaryTitle(doc)}</p>
          <DocumentStatusBadge status={doc.status} compact />
        </div>
        <p className="mt-1 text-sm text-muted-foreground tabular-nums">
          {meta ? `${meta} · ` : ""}
          {doc.countedLines}/{doc.totalLines}
          {doc.currentVersionNo > 0 ? ` · V${doc.currentVersionNo}` : ""}
        </p>
        {doc.totalLines > 0 && (
          <div className="mt-2 h-1 w-full max-w-xs overflow-hidden bg-muted">
            <div
              className="h-full bg-foreground transition-[width]"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>

      <div className="flex shrink-0 gap-2">
        <Button
          type="button"
          disabled={starting}
          onClick={onOpen}
          size="lg"
          className="min-h-11 flex-1 sm:flex-none sm:min-w-28"
        >
          {openLabel}
        </Button>
      </div>
    </div>
  );
}
