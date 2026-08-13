import { DocumentStatus } from "@/types/count";

/**
 * Subtle row cue by status. Recount is the only tinted state.
 */
export function documentRowHighlightClass(status: DocumentStatus): string {
  if (status === DocumentStatus.RECOUNT_REQUESTED) {
    return "border-l-2 border-l-destructive pl-3 -ml-3 sm:pl-4 sm:-ml-4";
  }
  return "";
}
