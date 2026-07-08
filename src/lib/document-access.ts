import { mapCountDocument } from "@/lib/db/mappers";
import { canAccessBranch } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import type { CountDocument } from "@/types/count";
import type { MockSession } from "@/types/user";

export type DocumentAccessResult =
  | { ok: true; document: CountDocument }
  | { ok: false; error: string; status: 403 | 404 };

export async function getDocumentForSession(
  session: MockSession,
  documentId: string,
): Promise<DocumentAccessResult> {
  const documentRow = await prisma.countDocument.findUnique({
    where: { id: documentId },
  });

  if (!documentRow) {
    return { ok: false, error: "Document not found", status: 404 };
  }

  if (!canAccessBranch(session.role, session.branchIds, documentRow.branchId)) {
    return { ok: false, error: "Access denied", status: 403 };
  }

  return { ok: true, document: mapCountDocument(documentRow) };
}
