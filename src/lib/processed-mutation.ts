import { prisma } from "@/lib/prisma";
import type { SaveEntryResponse } from "@/types/count";
import type { Prisma } from "@prisma/client";

type Db = Prisma.TransactionClient | typeof prisma;

export function serializeSaveResponse(response: SaveEntryResponse): string {
  return JSON.stringify(response);
}

export function parseSaveResponse(json: string): SaveEntryResponse {
  return JSON.parse(json) as SaveEntryResponse;
}

export function replayIfPresent(
  row: { responseJson: string } | null,
): SaveEntryResponse | null {
  if (!row) return null;
  return parseSaveResponse(row.responseJson);
}

export async function findProcessedMutation(
  userId: string,
  clientMutationId: string,
  db: Db = prisma,
) {
  return db.processedMutation.findUnique({
    where: {
      userId_clientMutationId: { userId, clientMutationId },
    },
  });
}

export async function storeProcessedMutation(
  input: {
    userId: string;
    clientMutationId: string;
    documentId: string;
    lineId: string | null;
    response: SaveEntryResponse;
  },
  db: Db = prisma,
) {
  await db.processedMutation.create({
    data: {
      clientMutationId: input.clientMutationId,
      userId: input.userId,
      documentId: input.documentId,
      lineId: input.lineId,
      responseJson: serializeSaveResponse(input.response),
    },
  });
}
