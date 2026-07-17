import { DocumentStatus } from "@/types/count";

/**
 * Single source of truth for subtle row background highlighting by document
 * status, so tablet and supervisor lists flag the same states consistently.
 *
 * - RECOUNT_REQUESTED: amber — needs re-count attention.
 * - COUNTING: blue — actively being counted.
 * - Other statuses: no highlight (use the status badge for detail).
 */
export function documentRowHighlightClass(status: DocumentStatus): string {
  switch (status) {
    case DocumentStatus.RECOUNT_REQUESTED:
      return "bg-amber-50/60";
    case DocumentStatus.COUNTING:
      return "bg-blue-50/40";
    default:
      return "";
  }
}
