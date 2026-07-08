import { getMockDb } from "@/mock/mock-db";
import { canAccessBranch } from "@/lib/permissions";
import type { CountDocument } from "@/types/count";
import type { MockSession } from "@/types/user";

export type DocumentAccessResult =
  | { ok: true; document: CountDocument }
  | { ok: false; error: string; status: 403 | 404 };

export function getDocumentForSession(
  session: MockSession,
  documentId: string,
): DocumentAccessResult {
  const db = getMockDb();
  const document = db.documents.find((item) => item.id === documentId);
  if (!document) {
    return { ok: false, error: "Document not found", status: 404 };
  }

  if (!canAccessBranch(session.role, session.branchIds, document.branchId)) {
    return { ok: false, error: "Access denied", status: 403 };
  }

  return { ok: true, document };
}
