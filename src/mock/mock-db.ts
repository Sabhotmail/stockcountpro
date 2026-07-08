import { initialAuditLogs } from "@/mock/audit-logs";
import { initialCountDocuments } from "@/mock/count-documents";
import { documentProductLines, initialCountEntries } from "@/mock/count-entries";
import { initialCountVersions } from "@/mock/count-versions";
import { initialRecountRequests } from "@/mock/recount-requests";
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
  entrySnapshots: Record<string, CountEntry[]>;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function seedEntrySnapshots(db: MockDatabase): void {
  const seedVersion = (documentId: string, versionId: string) => {
    const lines = db.productLines[documentId] ?? [];
    const lineIds = new Set(lines.map((line) => line.lineId));
    db.entrySnapshots[versionId] = clone(
      db.entries.filter((entry) => lineIds.has(entry.lineId)),
    );
  };

  seedVersion("doc_bkk1_003", "ver_bkk1_003_v1");
  seedVersion("doc_chm_001", "ver_chm_001_v1");
  seedVersion("doc_bkk1_004", "ver_bkk1_004_v1");

  const bkk1004Lines = db.productLines.doc_bkk1_004 ?? [];
  const bkk1004LineIds = new Set(bkk1004Lines.map((line) => line.lineId));
  db.entries = db.entries.filter((entry) => !bkk1004LineIds.has(entry.lineId));
  db.entries.push(
    {
      lineId: bkk1004Lines[1].lineId,
      qtyCase: null,
      qtyPack: 1,
      qtyPiece: 8,
      totalBaseQty: 1 * bkk1004Lines[1].packRatio + 8,
      note: null,
      revision: 1,
      updatedAt: "2026-07-08T11:40:00.000Z",
      updatedBy: "user_bkk1_staff",
    },
    {
      lineId: bkk1004Lines[4].lineId,
      qtyCase: null,
      qtyPack: null,
      qtyPiece: 15,
      totalBaseQty: 15,
      note: null,
      revision: 1,
      updatedAt: "2026-07-08T11:42:00.000Z",
      updatedBy: "user_bkk1_staff",
    },
  );
}

function createInitialDb(): MockDatabase {
  const db = {
    documents: clone(initialCountDocuments),
    versions: clone(initialCountVersions),
    entries: clone(initialCountEntries),
    productLines: clone(documentProductLines),
    auditLogs: clone(initialAuditLogs),
    recountRequests: clone(initialRecountRequests),
    entrySnapshots: {},
  };

  seedEntrySnapshots(db);
  return db;
}

const globalForMockDb = globalThis as typeof globalThis & {
  __stockcountMockDb?: MockDatabase;
};

function migrateMockDb(db: MockDatabase): void {
  // Hot reload may keep an older singleton missing Phase 3 fields.
  if (!db.recountRequests) {
    db.recountRequests = clone(initialRecountRequests);
  }
  if (!db.entrySnapshots) {
    db.entrySnapshots = {};
  }
}

export function getMockDb(): MockDatabase {
  if (!globalForMockDb.__stockcountMockDb) {
    globalForMockDb.__stockcountMockDb = createInitialDb();
  } else {
    migrateMockDb(globalForMockDb.__stockcountMockDb);
  }
  return globalForMockDb.__stockcountMockDb;
}

export function resetMockDb(): void {
  globalForMockDb.__stockcountMockDb = createInitialDb();
}
