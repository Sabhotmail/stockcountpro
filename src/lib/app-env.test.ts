import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  NKR_EXPRESS_HOST,
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
  getEnvBannerCssVars,
  getEnvBannerText,
  getEnvBannerTone,
  getSessionCookieName,
  getSessionCookieNameFromHost,
} from "@/lib/app-env";

const NKR_EXPRESS_URL = `http://${NKR_EXPRESS_HOST}:${NKR_EXPRESS_PORT}`;

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
    getSessionCookieNameFromHost("100.106.34.125:3003", "production"),
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
    "สาขาชั่วคราว · NKR — แยกจากห้องของจริง",
  );
  assert.equal(getEnvBannerTone("production"), null);
  assert.equal(getEnvBannerTone("test"), "amber");
  assert.equal(getEnvBannerTone("nkr"), "sky");
}

function testEnvBannerCssVarsReserveSafeArea() {
  assert.equal(getEnvBannerCssVars(false), undefined);
  assert.equal(
    getEnvBannerCssVars(true)?.["--env-banner-h"],
    "calc(2.75rem + env(safe-area-inset-top, 0px))",
  );
}

function testLayoutDoesNotLetBannerCoverPage() {
  const root = join(__dirname, "..");
  const layout = readFileSync(join(root, "app/layout.tsx"), "utf8");
  const banner = readFileSync(join(root, "components/EnvBanner.tsx"), "utf8");
  assert.match(layout, /pt-\[var\(--env-banner-h,0px\)\]/);
  assert.match(banner, /h-\[var\(--env-banner-h/);
  assert.doesNotMatch(banner, /min-h-\[var\(--env-banner-h/);
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
      expressBaseUrl: NKR_EXPRESS_URL,
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
    /100\.71\.103\.65/,
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
        expressBaseUrl: NKR_EXPRESS_URL,
      }),
    /100\.71\.103\.65/,
  );
  assert.throws(
    () =>
      assertAppEnvIsolation({
        appEnv: "test",
        databaseUrl: "postgresql://u:p@localhost:5432/stockcountpro_test",
        expressBaseUrl: NKR_EXPRESS_URL,
      }),
    /100\.71\.103\.65/,
  );
}

testGetAppEnvDefaultsToProduction();
testGetAppEnvAcceptsTest();
testGetAppEnvAcceptsNkr();
testGetAppEnvRejectsUnknown();
testSessionCookieNameDiffersByEnv();
testSessionCookieNameFromHostPort();
testDocumentTitleAndBanner();
testEnvBannerCssVarsReserveSafeArea();
testLayoutDoesNotLetBannerCoverPage();
testDatabaseNameFromUrl();
testIsolationAllowsMatchingPairs();
testIsolationRejectsTestPointingAtProd();
testIsolationRejectsProductionPointingAtTest();
testIsolationRejectsNkrPointingAtOtherRooms();
testIsolationRejectsProductionAndTestPointingAtNkr();
console.log("app-env.test: OK");
