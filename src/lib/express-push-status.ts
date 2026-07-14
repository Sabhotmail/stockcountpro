import { prisma } from "@/lib/prisma";

/** Latest successful PUSH_TO_EXPRESS audit time per document (ISO). */
export async function getLastSuccessfulExpressPushes(
  documentIds: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (documentIds.length === 0) return map;

  const logs = await prisma.auditLog.findMany({
    where: {
      documentId: { in: documentIds },
      action: "PUSH_TO_EXPRESS",
      detail: { startsWith: "ok;" },
    },
    orderBy: { createdAt: "desc" },
    select: { documentId: true, createdAt: true },
  });

  for (const log of logs) {
    if (!log.documentId || map.has(log.documentId)) continue;
    map.set(log.documentId, log.createdAt.toISOString());
  }
  return map;
}
