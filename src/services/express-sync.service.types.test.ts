import type {
  ExpressSyncLocationPreview,
  ExpressSyncPreviewResult,
  ExpressSyncResult,
} from "@/services/express-sync.service";
import { previewExpressCountDate, syncExpressCountDate } from "@/services/express-sync.service";
import { UserRole, type MockSession } from "@/types/user";

function expectType<T>(_value: T): void {}

const session: MockSession = {
  userId: "user_1",
  userName: "Tester",
  role: UserRole.STAFF,
  branchIds: ["branch_1"],
  hubIds: ["hub_1"],
};

async function assertPreviewContract() {
  const result = await previewExpressCountDate(session, "2026-07-10");
  if ("error" in result) return;

  expectType<ExpressSyncPreviewResult>(result);

  const location = result.locations[0];
  expectType<ExpressSyncLocationPreview>(location);
  expectType<string>(location.locationCode);
  expectType<string | null>(location.prefix);
  expectType<boolean>(location.accessible);
  expectType<boolean>(location.selectable);
  expectType<string | null>(location.disabledReason);
}

async function assertSyncContract() {
  const result = await syncExpressCountDate(session, "2026-07-10", [
    "32F1",
    "32F2",
  ]);
  if ("error" in result) return;

  expectType<ExpressSyncResult>(result);
}

void assertPreviewContract;
void assertSyncContract;
