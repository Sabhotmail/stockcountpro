import assert from "node:assert/strict";
import {
  NKR_EXPRESS_PORT,
  NKR_SESSION_COOKIE,
  PRODUCTION_EXPRESS_PORT,
  PRODUCTION_SESSION_COOKIE,
  TEST_EXPRESS_PORT,
  TEST_SESSION_COOKIE,
  assertAppEnvIsolation,
  databaseNameFromUrl,
  getAppEnv,
  getDocumentTitle,
  getEnvBannerText,
  getEnvBannerTone,
  getSessionCookieName,
  getSessionCookieNameFromHost,
} from "@/lib/app-env";

function testGetAppEnvDefaultsToProduction() {
  assert.equal(getAppEnv(undefined), "production");
  assert.equal(getAppEnv(""), "production");
  assert.equal(getAppEnv("  "), "production");
  assert.equal(getAppEnv("production"), "production");
  assert.equal(getAppEnv("PROD"), "production");
}

function testGetAppEnvAcceptsTest() {
  assert.equal(getAppEnv("test"), "test");
  assert.equal(getAppEnv("TEST"), "test");
}

function testGetAppEnvAcceptsNkr() {
  assert.equal(getAppEnv("nkr"), "nkr");
  assert.equal(getAppEnv("NKR"), "nkr");
}

function testGetAppEnvRejectsUnknown() {
  assert.throws(() => getAppEnv("staging"), /APP_ENV/);
}

function testSessionCookieNameDiffersByEnv() {
  assert.equal(getSessionCookieName("production"), PRODUCTION_SESSION_COOKIE);
  assert.equal(getSessionCookieName("test"), TEST_SESSION_COOKIE);
  assert.equal(getSessionCookieName("nkr"), NKR_SESSION_COOKIE);
}

function testSessionCookieNameFromHostPort() {
  assert.equal(
    getSessionCookieNameFromHost("100.106.34.125:3001", "production"),
    TEST_SESSION_COOKIE,
  );
  assert.equal(
    getSessionCookieNameFromHost("100.106.34.125:3000", "test"),
    PRODUCTION_SESSION_COOKIE,
  );
  assert.equal(
    getSessionCookieNameFromHost("localhost", "test"),
    TEST_SESSION_COOKIE,
  );
  assert.equal(
    getSessionCookieNameFromHost("100.106.34.125:3002", "production"),
    NKR_SESSION_COOKIE,
  );
}

function testDocumentTitleAndBanner() {
  assert.equal(getDocumentTitle("production"), "StockCount Pro");
  assert.equal(getDocumentTitle("test"), "TEST · StockCount Pro");
  assert.equal(getEnvBannerText("production"), null);
  assert.equal(
    getEnvBannerText("test"),
    "ห้องทดสอบ — ข้อมูลนี้ไม่ใช่ของจริง",
  );
  assert.equal(getDocumentTitle("nkr"), "NKR · StockCount Pro");
  assert.equal(
    getEnvBannerText("nkr"),
    "สาขาชั่วคราว · NKR — ข้อมูลนี้ไม่ใช่ของจริง",
  );
  assert.equal(getEnvBannerTone("production"), null);
  assert.equal(getEnvBannerTone("test"), "amber");
  assert.equal(getEnvBannerTone("nkr"), "sky");
}

function testDatabaseNameFromUrl() {
  assert.equal(
    databaseNameFromUrl(
      "postgresql://postgres:secret@localhost:5432/stockcountpro",
    ),
    "stockcountpro",
  );
  assert.equal(
    databaseNameFromUrl(
      "postgresql://postgres:secret@localhost:5432/stockcountpro_test?schema=public",
    ),
    "stockcountpro_test",
  );
}

function testIsolationAllowsMatchingPairs() {
  assert.doesNotThrow(() =>
    assertAppEnvIsolation({
      appEnv: "test",
      databaseUrl: "postgresql://u:p@localhost:5432/stockcountpro_test",
      expressBaseUrl: `http://127.0.0.1:${TEST_EXPRESS_PORT}`,
    }),
  );
  assert.doesNotThrow(() =>
    assertAppEnvIsolation({
      appEnv: "production",
      databaseUrl: "postgresql://u:p@localhost:5432/stockcountpro",
      expressBaseUrl: `http://127.0.0.1:${PRODUCTION_EXPRESS_PORT}`,
    }),
  );
  assert.doesNotThrow(() =>
    assertAppEnvIsolation({
      appEnv: "nkr",
      databaseUrl: "postgresql://u:p@localhost:5432/stockcountpro_nkr",
      expressBaseUrl: `http://127.0.0.1:${NKR_EXPRESS_PORT}`,
    }),
  );
}

function testIsolationRejectsTestPointingAtProd() {
  assert.throws(
    () =>
      assertAppEnvIsolation({
        appEnv: "test",
        databaseUrl: "postgresql://u:p@localhost:5432/stockcountpro",
        expressBaseUrl: `http://127.0.0.1:${TEST_EXPRESS_PORT}`,
      }),
    /_test/,
  );
  assert.throws(
    () =>
      assertAppEnvIsolation({
        appEnv: "test",
        databaseUrl: "postgresql://u:p@localhost:5432/stockcountpro_test",
        expressBaseUrl: `http://127.0.0.1:${PRODUCTION_EXPRESS_PORT}`,
      }),
    /8080/,
  );
}

function testIsolationRejectsProductionPointingAtTest() {
  assert.throws(
    () =>
      assertAppEnvIsolation({
        appEnv: "production",
        databaseUrl: "postgresql://u:p@localhost:5432/stockcountpro_test",
        expressBaseUrl: `http://127.0.0.1:${PRODUCTION_EXPRESS_PORT}`,
      }),
    /_test/,
  );
  assert.throws(
    () =>
      assertAppEnvIsolation({
        appEnv: "production",
        databaseUrl: "postgresql://u:p@localhost:5432/stockcountpro",
        expressBaseUrl: `http://127.0.0.1:${TEST_EXPRESS_PORT}`,
      }),
    /8081/,
  );
}

function testIsolationRejectsNkrPointingAtOtherRooms() {
  assert.throws(
    () =>
      assertAppEnvIsolation({
        appEnv: "nkr",
        databaseUrl: "postgresql://u:p@localhost:5432/stockcountpro",
        expressBaseUrl: `http://127.0.0.1:${NKR_EXPRESS_PORT}`,
      }),
    /_nkr/,
  );
  assert.throws(
    () =>
      assertAppEnvIsolation({
        appEnv: "nkr",
        databaseUrl: "postgresql://u:p@localhost:5432/stockcountpro_nkr",
        expressBaseUrl: `http://127.0.0.1:${PRODUCTION_EXPRESS_PORT}`,
      }),
    /8080/,
  );
  assert.throws(
    () =>
      assertAppEnvIsolation({
        appEnv: "nkr",
        databaseUrl: "postgresql://u:p@localhost:5432/stockcountpro_nkr",
        expressBaseUrl: `http://127.0.0.1:${TEST_EXPRESS_PORT}`,
      }),
    /8081/,
  );
}

function testIsolationRejectsProductionAndTestPointingAtNkr() {
  assert.throws(
    () =>
      assertAppEnvIsolation({
        appEnv: "production",
        databaseUrl: "postgresql://u:p@localhost:5432/stockcountpro_nkr",
        expressBaseUrl: `http://127.0.0.1:${PRODUCTION_EXPRESS_PORT}`,
      }),
    /_nkr/,
  );
  assert.throws(
    () =>
      assertAppEnvIsolation({
        appEnv: "production",
        databaseUrl: "postgresql://u:p@localhost:5432/stockcountpro",
        expressBaseUrl: `http://127.0.0.1:${NKR_EXPRESS_PORT}`,
      }),
    /8082/,
  );
  assert.throws(
    () =>
      assertAppEnvIsolation({
        appEnv: "test",
        databaseUrl: "postgresql://u:p@localhost:5432/stockcountpro_test",
        expressBaseUrl: `http://127.0.0.1:${NKR_EXPRESS_PORT}`,
      }),
    /8082/,
  );
}

testGetAppEnvDefaultsToProduction();
testGetAppEnvAcceptsTest();
testGetAppEnvAcceptsNkr();
testGetAppEnvRejectsUnknown();
testSessionCookieNameDiffersByEnv();
testSessionCookieNameFromHostPort();
testDocumentTitleAndBanner();
testDatabaseNameFromUrl();
testIsolationAllowsMatchingPairs();
testIsolationRejectsTestPointingAtProd();
testIsolationRejectsProductionPointingAtTest();
testIsolationRejectsNkrPointingAtOtherRooms();
testIsolationRejectsProductionAndTestPointingAtNkr();
console.log("app-env.test: OK");
