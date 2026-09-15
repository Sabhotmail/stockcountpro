import assert from "node:assert/strict";
import { NKR_SESSION_COOKIE, TEST_SESSION_COOKIE } from "@/lib/app-env";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  clearSessionCookieHeaders,
  serializeSessionCookie,
  shouldRefreshSession,
  shouldUseSecureCookies,
} from "@/lib/auth/session";

function testShouldUseSecureFromRequest() {
  const prev = process.env.AUTH_COOKIE_SECURE;
  delete process.env.AUTH_COOKIE_SECURE;

  assert.equal(
    shouldUseSecureCookies(new Request("http://100.106.34.125:3000/api/auth/login")),
    false,
  );
  assert.equal(
    shouldUseSecureCookies(new Request("https://count.example.com/api/auth/login")),
    true,
  );

  const forwardedHttp = new Request("http://127.0.0.1/api/auth/login", {
    headers: { "x-forwarded-proto": "https" },
  });
  assert.equal(shouldUseSecureCookies(forwardedHttp), true);

  process.env.AUTH_COOKIE_SECURE = "false";
  assert.equal(
    shouldUseSecureCookies(new Request("https://count.example.com/login")),
    false,
  );

  process.env.AUTH_COOKIE_SECURE = "true";
  assert.equal(
    shouldUseSecureCookies(new Request("http://localhost:3000/login")),
    true,
  );

  if (prev === undefined) delete process.env.AUTH_COOKIE_SECURE;
  else process.env.AUTH_COOKIE_SECURE = prev;
}

function testSerializeMatchesSecureFlag() {
  const insecure = serializeSessionCookie("tok", false);
  assert.ok(insecure.includes(`${SESSION_COOKIE}=tok`));
  assert.ok(!insecure.includes("Secure"));

  const secure = serializeSessionCookie("tok", true);
  assert.ok(secure.includes("; Secure"));
}

function testSerializeIncludesExpiresForOldBrowsers() {
  const now = Date.now();
  const cookie = serializeSessionCookie("tok", false);
  const match = cookie.match(/Expires=([^;]+)/);
  assert.ok(match, "cookie must include Expires for browsers that ignore Max-Age");
  const expires = Date.parse(match[1] ?? "");
  const expected = now + SESSION_MAX_AGE_SECONDS * 1000;
  assert.ok(Number.isFinite(expires));
  assert.ok(Math.abs(expires - expected) < 2000);
}

function testShouldRefreshWhenPastHalfway() {
  const nowMs = Date.UTC(2026, 7, 27, 12, 0, 0);
  const half = SESSION_MAX_AGE_SECONDS / 2;
  const expSoon = Math.floor(nowMs / 1000) + half - 1;
  const expFresh = Math.floor(nowMs / 1000) + SESSION_MAX_AGE_SECONDS;

  assert.equal(shouldRefreshSession(expSoon, nowMs), true);
  assert.equal(shouldRefreshSession(expFresh, nowMs), false);
}

function testClearBothVariants() {
  const clears = clearSessionCookieHeaders();
  assert.equal(clears.length, 2);
  assert.ok(clears.some((c) => c.includes("Secure")));
  assert.ok(clears.some((c) => !c.includes("Secure")));
}

function testTestEnvUsesSeparateCookieName() {
  const prev = process.env.APP_ENV;
  process.env.APP_ENV = "test";
  try {
    const cookie = serializeSessionCookie("tok", false);
    assert.ok(cookie.startsWith(`${TEST_SESSION_COOKIE}=tok`));
    assert.ok(!cookie.startsWith(`${SESSION_COOKIE}=tok`));

    const clears = clearSessionCookieHeaders();
    assert.ok(clears.every((c) => c.startsWith(`${TEST_SESSION_COOKIE}=`)));
  } finally {
    if (prev === undefined) delete process.env.APP_ENV;
    else process.env.APP_ENV = prev;
  }
}

function testNkrEnvUsesSeparateCookieName() {
  const prev = process.env.APP_ENV;
  process.env.APP_ENV = "nkr";
  try {
    const cookie = serializeSessionCookie("tok", false);
    assert.ok(cookie.startsWith(`${NKR_SESSION_COOKIE}=tok`));
    assert.ok(!cookie.startsWith(`${SESSION_COOKIE}=tok`));
    assert.ok(!cookie.startsWith(`${TEST_SESSION_COOKIE}=tok`));
  } finally {
    if (prev === undefined) delete process.env.APP_ENV;
    else process.env.APP_ENV = prev;
  }
}

testShouldUseSecureFromRequest();
testSerializeMatchesSecureFlag();
testSerializeIncludesExpiresForOldBrowsers();
testShouldRefreshWhenPastHalfway();
testClearBothVariants();
testTestEnvUsesSeparateCookieName();
testNkrEnvUsesSeparateCookieName();
console.log("session-cookie.test: OK");
