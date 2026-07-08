import { initialAuditLogs } from "@/mock/audit-logs";
import { initialCountDocuments } from "@/mock/count-documents";
import { documentProductLines, initialCountEntries } from "@/mock/count-entries";
import { initialCountVersions } from "@/mock/count-versions";
import type { AuditLog } from "@/types/audit";
import type { RecountRequestRecord } from "@/types/count";
import type {
  CountDocument,
  CountEntry,
  CountVersion,
  ProductLine,
} from "@/types/count";

// TODO: Move mutable mock state to dev DB / Prisma
interface MockDatabase {
  documents: CountDocument[];
  versions: CountVersion[];
  entries: CountEntry[];
  productLines: Record<string, ProductLine[]>;
  auditLogs: AuditLog[];
  recountRequests: RecountRequestRecord[];
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function createInitialDb(): MockDatabase {
  return {
    documents: clone(initialCountDocuments),
    versions: clone(initialCountVersions),
    entries: clone(initialCountEntries),
    productLines: clone(documentProductLines),
    auditLogs: clone(initialAuditLogs),
    recountRequests: [],
  };
}

const globalForMockDb = globalThis as typeof globalThis & {
  __stockcountMockDb?: MockDatabase;
};

export function getMockDb(): MockDatabase {
  if (!globalForMockDb.__stockcountMockDb) {
    globalForMockDb.__stockcountMockDb = createInitialDb();
  }
  return globalForMockDb.__stockcountMockDb;
}

export function resetMockDb(): void {
  globalForMockDb.__stockcountMockDb = createInitialDb();
}
