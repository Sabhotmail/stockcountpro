import { DocumentStatus } from "@/types/count";

const RESET_ALLOWED_STATUSES = new Set<DocumentStatus>([
  DocumentStatus.COUNTING,
  DocumentStatus.RECOUNT_REQUESTED,
  DocumentStatus.SUBMITTED,
  DocumentStatus.REVIEWING,
]);

export function canResetDocumentStatus(status: DocumentStatus): boolean {
  return RESET_ALLOWED_STATUSES.has(status);
}

/** Short code users type to confirm reset (location code when available). */
export function resetConfirmCode(doc: {
  locationCode?: string | null;
  documentNo: string;
}): string {
  const location = doc.locationCode?.trim();
  return location || doc.documentNo;
}
