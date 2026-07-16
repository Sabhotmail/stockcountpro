import assert from "node:assert/strict";
import {
  assertLoginAllowed,
  clearLoginFailuresForUsername,
  recordLoginFailure,
  resetLoginRateLimitForTests,
} from "@/lib/auth/login-rate-limit";

function testUsernameThrottle() {
  resetLoginRateLimitForTests();
  const ip = "1.2.3.4";
  const username = "brute";

  for (let i = 0; i < 5; i++) {
    assert.equal(assertLoginAllowed(ip, username).ok, true);
    recordLoginFailure(ip, username);
  }
  assert.equal(assertLoginAllowed(ip, username).ok, false);
  clearLoginFailuresForUsername(username);
  assert.equal(assertLoginAllowed(ip, username).ok, true);
}

testUsernameThrottle();
console.log("login-rate-limit.test: OK");
