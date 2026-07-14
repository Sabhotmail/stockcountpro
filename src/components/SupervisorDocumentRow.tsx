import Link from "next/link";
import { DocumentStatusBadge } from "@/components/DocumentStatusBadge";
import { ExpressPushBadge } from "@/components/ExpressPushBadge";
import { PushExpressButton } from "@/components/PushExpressButton";
import { buttonVariants } from "@/components/ui/button";
import { formatDateTimeShortTH } from "@/lib/datetime";
import { cn } from "@/lib/utils";
import {
  DocumentStatus,
  type SupervisorDocumentListItem,
} from "@/types/count";

type TabKey = "pending" | "completed";

function locationMeta(doc: SupervisorDocumentListItem): string {
  const parts = [
    doc.locationCode ?? doc.branchCode,
    doc.locationName ?? doc.branchName,
  ];
  if (doc.hubShortName) parts.push(`Hub ${doc.hubShortName}`);
  else if (doc.isCentral) parts.push("HQ กลาง");
  return parts.join(" · ");
}

export function isSupervisorDocBulkEligible(doc: SupervisorDocumentListItem) {
  return doc.status === DocumentStatus.COMPLETED && !doc.lastExpressPushAt;
}

export function SupervisorDocumentRow({
  doc,
  mode,
  selected,
  onToggleSelect,
  onPushed,
}: {
  doc: SupervisorDocumentListItem;
  mode: TabKey;
  selected?: boolean;
  onToggleSelect?: (documentId: string, next: boolean) => void;
  onPushed: (documentId: string, message: string) => void;
}) {
  const pushed = Boolean(doc.lastExpressPushAt);
  const eligible = isSupervisorDocBulkEligible(doc);

  return (
    <div
      className={cn(
        "flex flex-col gap-3 border-b border-border/70 py-4 last:border-b-0 sm:flex-row sm:items-start sm:justify-between",
        pushed && mode === "completed" && "bg-emerald-50/40",
      )}
    >
      <div className="flex min-w-0 flex-1 items-start gap-2">
        {mode === "completed" && eligible && onToggleSelect && (
          <input
            type="checkbox"
            className="mt-1 size-4 shrink-0"
            checked={Boolean(selected)}
            onChange={(e) => onToggleSelect(doc.id, e.target.checked)}
            aria-label={`เลือก ${doc.documentNo}`}
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold tracking-tight">{doc.documentNo}</p>
            <DocumentStatusBadge status={doc.status} compact />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{locationMeta(doc)}</p>
          <p className="mt-1 text-xs text-muted-foreground tabular-nums">
            V{doc.currentVersionNo || "—"} · นับแล้ว{" "}
            <span className="font-medium text-foreground">
              {doc.countedLines}/{doc.totalLines}
            </span>
            {doc.hasDocumentNote ? " · มีหมายเหตุ" : ""}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            ส่งโดย {doc.submittedByName ?? "—"} ·{" "}
            {formatDateTimeShortTH(doc.submittedAt)}
          </p>
          {mode === "completed" && (
            <div className="mt-2">
              <ExpressPushBadge at={doc.lastExpressPushAt} />
            </div>
          )}
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
        {mode === "completed" ? (
          <>
            <Link
              href={`/supervisor/review/${doc.id}`}
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "min-h-10 border-orange-200 text-orange-800 hover:bg-orange-50",
              )}
            >
              ขอนับใหม่
            </Link>
            <Link
              href={`/print/documents/${doc.id}`}
              className={cn(buttonVariants({ size: "sm" }), "min-h-10")}
              target="_blank"
              rel="noreferrer"
            >
              พิมพ์
            </Link>
            <PushExpressButton
              documentId={doc.id}
              alreadyPushed={pushed}
              onPushed={(message) => onPushed(doc.id, message)}
            />
          </>
        ) : (
          <Link
            href={`/supervisor/review/${doc.id}`}
            className={cn(buttonVariants({ size: "sm" }), "min-h-10 w-full sm:w-auto")}
          >
            ตรวจสอบ
          </Link>
        )}
      </div>
    </div>
  );
}
