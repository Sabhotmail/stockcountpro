import assert from "node:assert/strict";
import {
  callExpressVarianceApi,
  resolveVarianceApiConfig,
  validateDocumentForVariance,
} from "@/services/express-variance.service";

function withEnv(
  values: Record<string, string | undefined>,
  fn: () => void | Promise<void>,
): Promise<void> {
  const previous = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(values)) {
    previous.set(key, process.env[key]);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  return Promise.resolve(fn()).finally(() => {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });
}

async function testMissingEnv() {
  await withEnv(
    {
      EXPRESS_VARIANCE_API_BASE_URL: undefined,
      EXPRESS_VARIANCE_API_TOKEN: undefined,
    },
    () => {
      const cfg = resolveVarianceApiConfig();
      assert.equal("error" in cfg, true);
      if ("error" in cfg) {
        assert.equal(cfg.status, 503);
        assert.match(cfg.error, /EXPRESS_VARIANCE_API/);
      }
    },
  );
}

function testMissingLocationCode() {
  const result = validateDocumentForVariance({
    documentDate: "2026-11-26",
    locationCode: null,
  });
  assert.equal("error" in result, true);
  if ("error" in result) {
    assert.equal(result.status, 400);
    assert.match(result.error, /ไม่มีรหัสคลัง Express/);
  }
}

async function testFastApi404() {
  const original = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ detail: "not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    })) as typeof fetch;

  try {
    const result = await callExpressVarianceApi({
      baseUrl: "http://127.0.0.1:8090",
      token: "secret",
      countDate: "2026-11-26",
      locationCode: "2411",
    });
    assert.equal("error" in result, true);
    if ("error" in result) {
      assert.equal(result.status, 404);
      assert.match(result.error, /ไม่พบข้อมูลผลต่างใน Express/);
    }
  } finally {
    globalThis.fetch = original;
  }
}

async function testFastApi200() {
  const original = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        varianceData: [
          {
            ProductCode: " 1060010004 ",
            PhysicalBalance: 3648,
            LocationBalance: 3600,
            DifferentQty: 48,
            CountFlag: "3",
          },
        ],
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    )) as typeof fetch;

  try {
    const result = await callExpressVarianceApi({
      baseUrl: "http://127.0.0.1:8090/",
      token: "secret",
      countDate: "2026-11-26",
      locationCode: "2411",
    });
    assert.equal("success" in result && result.success, true);
    if ("success" in result) {
      assert.equal(result.countDate, "2026-11-26");
      assert.equal(result.locationCode, "2411");
      assert.equal(result.varianceByProductCode["1060010004"]?.DifferentQty, 48);
      assert.ok(result.fetchedAt);
    }
  } finally {
    globalThis.fetch = original;
  }
}

async function main() {
  await testMissingEnv();
  testMissingLocationCode();
  await testFastApi404();
  await testFastApi200();
  console.log("express-variance.service.test: OK");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
