import type { CountEntry, SaveEntryPayload } from "@/types/count";

export function payloadForSend(
  pending: SaveEntryPayload,
  knownServerRevision: number | undefined,
): SaveEntryPayload {
  const next: SaveEntryPayload = { ...pending };
  if (knownServerRevision === undefined) {
    delete next.baseRevision;
    return next;
  }
  next.baseRevision = knownServerRevision;
  return next;
}

export function replacePendingSave(
  existing: SaveEntryPayload | undefined,
  incoming: SaveEntryPayload,
  requestAlreadySent: boolean,
): SaveEntryPayload {
  if (!existing || requestAlreadySent) return incoming;
  return { ...incoming, clientMutationId: existing.clientMutationId };
}

export function resolveSuccessfulLineSave(input: {
  serverEntry: CountEntry;
  localEntry: CountEntry;
  pending: SaveEntryPayload | null;
  nextClientMutationId: string;
}): {
  entry: CountEntry;
  nextPayload: SaveEntryPayload | null;
  status: "saved" | "saving";
} {
  const { serverEntry, localEntry, pending, nextClientMutationId } = input;
  if (!pending) {
    return { entry: serverEntry, nextPayload: null, status: "saved" };
  }

  return {
    entry: {
      ...localEntry,
      revision: serverEntry.revision,
      updatedAt: serverEntry.updatedAt,
      updatedBy: serverEntry.updatedBy,
      updatedByName: serverEntry.updatedByName,
    },
    nextPayload: {
      ...pending,
      baseRevision: serverEntry.revision,
      clientMutationId: nextClientMutationId,
    },
    status: "saving",
  };
}
