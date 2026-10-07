/** sessionStorage receipt proving count-page flush completed before submit. */

export type FlushReceipt = {
  at: number;
  ok: true;
};

export function flushReceiptKey(documentId: string, versionId: string): string {
  return `scp:flush:${documentId}:${versionId}`;
}

export function writeFlushReceipt(
  documentId: string,
  versionId: string,
): void {
  if (typeof sessionStorage === "undefined") return;
  const payload: FlushReceipt = { at: Date.now(), ok: true };
  sessionStorage.setItem(
    flushReceiptKey(documentId, versionId),
    JSON.stringify(payload),
  );
}

export function hasValidFlushReceipt(
  documentId: string,
  versionId: string,
): boolean {
  if (typeof sessionStorage === "undefined") return false;
  const raw = sessionStorage.getItem(flushReceiptKey(documentId, versionId));
  if (!raw) return false;
  try {
    const parsed = JSON.parse(raw) as FlushReceipt;
    return parsed?.ok === true && typeof parsed.at === "number";
  } catch {
    return false;
  }
}

export function clearFlushReceipt(
  documentId: string,
  versionId: string,
): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.removeItem(flushReceiptKey(documentId, versionId));
}
