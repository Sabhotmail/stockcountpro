import {
  dateKeyFromLocationDocumentId,
  dateKeyToUtcDateOnly,
  toDateKeyUtc,
} from "@/lib/datetime";
import { prisma } from "@/lib/prisma";

/**
 * Fix documents whose `@db.Date` was stored one day earlier because Bangkok
 * midnight was written as UTC. Prefer the date embedded in the document id.
 */
export async function repairOffByOneDocumentDates(): Promise<number> {
  const docs = await prisma.countDocument.findMany({
    select: { id: true, documentDate: true },
  });

  let fixed = 0;
  for (const doc of docs) {
    const key = dateKeyFromLocationDocumentId(doc.id);
    if (!key) continue;

    const stored = toDateKeyUtc(doc.documentDate);
    if (stored === key) continue;

    const next = dateKeyToUtcDateOnly(key);
    if (!next) continue;

    await prisma.countDocument.update({
      where: { id: doc.id },
      data: { documentDate: next },
    });
    fixed += 1;
  }

  return fixed;
}
