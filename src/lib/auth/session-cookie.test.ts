import assert from "node:assert/strict";
import {
  SESSION_COOKIE,
  clearSessionCookieHeaders,
  serializeSessionCookie,
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

function testClearBothVariants() {
  const clears = clearSessionCookieHeaders();
  assert.equal(clears.length, 2);
  assert.ok(clears.some((c) => c.includes("Secure")));
  assert.ok(clears.some((c) => !c.includes("Secure")));
}

testShouldUseSecureFromRequest();
testSerializeMatchesSecureFlag();
testClearBothVariants();
console.log("session-cookie.test: OK");
