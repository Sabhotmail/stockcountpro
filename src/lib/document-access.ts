import { mapCountDocument } from "@/lib/db/mappers";
import { canAccessDocument } from "@/lib/permissions";
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

  const document = mapCountDocument(documentRow);
  if (
    !canAccessDocument(
      session.role,
      session.branchIds,
      session.hubIds,
      document,
    )
  ) {
    return { ok: false, error: "Access denied", status: 403 };
  }

  return { ok: true, document };
}
