import assert from "node:assert/strict";
import {
  SESSION_MAX_AGE_SECONDS,
  createSessionToken,
  verifySessionToken,
  verifySessionTokenMeta,
} from "@/lib/auth/session";
import { UserRole } from "@/types/user";

async function testSessionVersionRoundTrip() {
  process.env.AUTH_SECRET =
    process.env.AUTH_SECRET ?? "test-secret-at-least-32-characters-long!!";

  const token = await createSessionToken({
    userId: "u1",
    userName: "Test",
    role: UserRole.STAFF,
    branchIds: ["b1"],
    hubIds: [],
    sessionVersion: 3,
  });
  const session = await verifySessionToken(token);
  assert.ok(session);
  assert.equal(session!.sessionVersion, 3);
}

async function testSessionTokenIncludesExpiry() {
  process.env.AUTH_SECRET =
    process.env.AUTH_SECRET ?? "test-secret-at-least-32-characters-long!!";

  const before = Math.floor(Date.now() / 1000);
  const token = await createSessionToken({
    userId: "u1",
    userName: "Test",
    role: UserRole.STAFF,
    branchIds: ["b1"],
    hubIds: [],
    sessionVersion: 3,
  });
  const verified = await verifySessionTokenMeta(token);
  assert.ok(verified);
  assert.equal(verified!.session.sessionVersion, 3);
  assert.ok(verified!.exp >= before + SESSION_MAX_AGE_SECONDS - 2);
  assert.ok(verified!.exp <= before + SESSION_MAX_AGE_SECONDS + 2);
}

async function main() {
  await testSessionVersionRoundTrip();
  await testSessionTokenIncludesExpiry();
  console.log("session-version.test: OK");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
