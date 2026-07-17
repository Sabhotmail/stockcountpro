/**
 * Integration-style flow tests for Express stock count deletion.
 *
 * The orchestration in `executeExpressDelete` / `retryExpressDelete` is exercised
 * with injected fakes (no DB, no Express server) so we can assert the ordering and
 * failure handling: app document is deleted before Express, Express failure yields
 * a retryable partial result, audit is always written, and access/confirm guards
 * reject bad input.
 */
import assert from "node:assert/strict";
import {
  executeExpressDelete,
  retryExpressDelete,
  type ExpressDeleteDeps,
  type ExpressDeletePreviewResult,
} from "@/services/express-delete.service";
import { DocumentStatus } from "@/types/count";
import { UserRole, type MockSession } from "@/types/user";

const COUNT_DATE = "2026-07-09";
const LOCATION = "2413";
const DOCUMENT_ID = "doc_1";
const CONFIRM = `DELETE ${COUNT_DATE} ${LOCATION}`;

function supervisorSession(): MockSession {
  return {
    userId: "user_sup",
    userName: "Supervisor",
    role: UserRole.SUPERVISOR,
    branchIds: ["branch_1"],
    hubIds: ["hub_1"],
    sessionVersion: 0,
  };
}

function previewWithDeletableDoc(): ExpressDeletePreviewResult {
  return {
    countDate: COUNT_DATE,
    locationCode: LOCATION,
    deletableDocuments: [
      {
        id: DOCUMENT_ID,
        documentNo: "2413",
        status: DocumentStatus.IMPORTED,
        locationCode: LOCATION,
        locationName: "คลังทดสอบ",
        branchCode: "PNL",
        branchName: "สาขา",
        hubCode: null,
        hubName: null,
        countedLines: 0,
        totalLines: 10,
        deletable: true,
        blockedReason: null,
      },
    ],
    blockedDocuments: [],
  };
}

type AuditCall = { branchId: string | undefined; detail: string };

type Behavior = {
  preview?: ExpressDeletePreviewResult | { error: string };
  appResult?:
    | { success: true; branchId: string; detail: string }
    | { error: string; status: 403 | 404 | 400 };
  expressResult?: { success: true; response: unknown } | { error: string };
  canAccess?: boolean;
};

function makeDeps(behavior: Behavior = {}): {
  deps: ExpressDeleteDeps;
  calls: {
    order: string[];
    audits: AuditCall[];
  };
} {
  const calls = { order: [] as string[], audits: [] as AuditCall[] };

  const deps: ExpressDeleteDeps = {
    preview: async () => {
      calls.order.push("preview");
      return behavior.preview ?? previewWithDeletableDoc();
    },
    deleteAppDocument: async () => {
      calls.order.push("deleteApp");
      return (
        behavior.appResult ?? {
          success: true,
          branchId: "branch_1",
          detail: "documentNo=2413",
        }
      );
    },
    deleteExpress: async () => {
      calls.order.push("deleteExpress");
      return behavior.expressResult ?? { success: true, response: { success: true } };
    },
    canAccessLocation: async () => {
      calls.order.push("canAccessLocation");
      return behavior.canAccess ?? true;
    },
    writeAudit: async (_session, branchId, detail) => {
      calls.order.push("writeAudit");
      calls.audits.push({ branchId, detail });
    },
  };

  return { deps, calls };
}

async function testHappyPathDeletesAppThenExpress() {
  const { deps, calls } = makeDeps();
  const result = await executeExpressDelete(
    supervisorSession(),
    COUNT_DATE,
    LOCATION,
    DOCUMENT_ID,
    CONFIRM,
    deps,
  );

  assert.ok("success" in result && result.success, "expected success result");
  assert.deepEqual(calls.order, [
    "preview",
    "deleteApp",
    "deleteExpress",
    "writeAudit",
  ]);
  assert.equal(calls.audits.length, 1);
  assert.match(calls.audits[0]!.detail, /express=deleted/);
}

async function testExpressFailureYieldsRetryablePartial() {
  const { deps, calls } = makeDeps({
    expressResult: { error: "Express delete failed (500)" },
  });

  const result = await executeExpressDelete(
    supervisorSession(),
    COUNT_DATE,
    LOCATION,
    DOCUMENT_ID,
    CONFIRM,
    deps,
  );

  assert.ok("partial" in result && result.partial, "expected partial result");
  if ("partial" in result) {
    assert.equal(result.canRetryExpress, true);
    assert.equal(result.appDeleted, true);
    assert.match(result.expressError, /Express delete failed/);
  }
  // App delete happened before Express, and audit still recorded the partial state.
  assert.deepEqual(calls.order, [
    "preview",
    "deleteApp",
    "deleteExpress",
    "writeAudit",
  ]);
  assert.match(calls.audits[0]!.detail, /express=failed/);
}

async function testExpressNotCalledWhenAppDeleteFails() {
  const { deps, calls } = makeDeps({
    appResult: {
      error: "เอกสารส่งให้หัวหน้างานแล้ว ไม่สามารถลบได้",
      status: 400,
    },
  });

  const result = await executeExpressDelete(
    supervisorSession(),
    COUNT_DATE,
    LOCATION,
    DOCUMENT_ID,
    CONFIRM,
    deps,
  );

  assert.ok("error" in result, "expected error result");
  if ("error" in result) assert.equal(result.status, 400);
  assert.ok(
    !calls.order.includes("deleteExpress"),
    "Express must not be called when app delete fails",
  );
  assert.equal(calls.audits.length, 0);
}

async function testWrongConfirmPhraseRejected() {
  const { deps, calls } = makeDeps();
  const result = await executeExpressDelete(
    supervisorSession(),
    COUNT_DATE,
    LOCATION,
    DOCUMENT_ID,
    "DELETE wrong",
    deps,
  );

  assert.ok("error" in result, "expected error result");
  if ("error" in result) assert.equal(result.status, 400);
  assert.deepEqual(calls.order, [], "no side effects on bad confirm phrase");
}

async function testSelectedDocumentMustBeDeletable() {
  const { deps, calls } = makeDeps({
    preview: {
      countDate: COUNT_DATE,
      locationCode: LOCATION,
      deletableDocuments: [],
      blockedDocuments: [
        {
          id: DOCUMENT_ID,
          documentNo: "2413",
          status: DocumentStatus.SUBMITTED,
          locationCode: LOCATION,
          locationName: null,
          branchCode: "PNL",
          branchName: "สาขา",
          hubCode: null,
          hubName: null,
          countedLines: 5,
          totalLines: 10,
          deletable: false,
          blockedReason: "เอกสารส่งให้หัวหน้างานแล้ว ไม่สามารถลบได้",
        },
      ],
    },
  });

  const result = await executeExpressDelete(
    supervisorSession(),
    COUNT_DATE,
    LOCATION,
    DOCUMENT_ID,
    CONFIRM,
    deps,
  );

  assert.ok("error" in result, "expected error result");
  if ("error" in result) assert.equal(result.status, 404);
  assert.ok(
    !calls.order.includes("deleteApp"),
    "must not delete a blocked document",
  );
}

async function testUnauthorizedRoleRejected() {
  const { deps, calls } = makeDeps();
  const staff: MockSession = {
    ...supervisorSession(),
    role: UserRole.STAFF,
  };

  const result = await executeExpressDelete(
    staff,
    COUNT_DATE,
    LOCATION,
    DOCUMENT_ID,
    CONFIRM,
    deps,
  );

  assert.ok("error" in result, "expected error result");
  if ("error" in result) assert.equal(result.status, 403);
  assert.deepEqual(calls.order, [], "no side effects for unauthorized role");
}

async function testRetrySucceedsAfterAccessCheck() {
  const { deps, calls } = makeDeps();
  const result = await retryExpressDelete(
    supervisorSession(),
    COUNT_DATE,
    LOCATION,
    deps,
  );

  assert.ok("success" in result && result.success, "expected retry success");
  assert.deepEqual(calls.order, [
    "canAccessLocation",
    "deleteExpress",
    "writeAudit",
  ]);
  assert.match(calls.audits[0]!.detail, /express=deleted-retry/);
}

async function testRetryDeniedWithoutLocationAccess() {
  const { deps, calls } = makeDeps({
    canAccess: false,
  });

  const result = await retryExpressDelete(
    supervisorSession(),
    COUNT_DATE,
    LOCATION,
    deps,
  );

  assert.ok("error" in result, "expected error result");
  if ("error" in result) assert.equal(result.status, 403);
  assert.ok(
    !calls.order.includes("deleteExpress"),
    "Express must not be called without location access",
  );
}

async function testRetryExpressFailureReturns502() {
  const { deps } = makeDeps({
    expressResult: { error: "Express delete failed (503)" },
  });

  const result = await retryExpressDelete(
    supervisorSession(),
    COUNT_DATE,
    LOCATION,
    deps,
  );

  assert.ok("error" in result, "expected error result");
  if ("error" in result) assert.equal(result.status, 502);
}

async function main() {
  await testHappyPathDeletesAppThenExpress();
  await testExpressFailureYieldsRetryablePartial();
  await testExpressNotCalledWhenAppDeleteFails();
  await testWrongConfirmPhraseRejected();
  await testSelectedDocumentMustBeDeletable();
  await testUnauthorizedRoleRejected();
  await testRetrySucceedsAfterAccessCheck();
  await testRetryDeniedWithoutLocationAccess();
  await testRetryExpressFailureReturns502();
  console.log("express-delete.flow.test: OK");
}

void main();
