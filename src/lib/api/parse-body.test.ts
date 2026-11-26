import assert from "node:assert/strict";
import { z } from "zod";
import {
  MAX_JSON_BODY_BYTES,
  formatZodError,
  parseWithSchema,
  readJsonBody,
} from "@/lib/api/parse-body";

function testFormatZodErrorUsesFirstIssue() {
  const result = z
    .object({ name: z.string(), age: z.number() })
    .safeParse({ name: 1, age: "x" });
  assert.equal(result.success, false);
  if (result.success) return;
  const message = formatZodError(result.error);
  assert.match(message, /name/i);
  assert.equal(typeof message, "string");
  assert.ok(message.length > 0);
}

function testParseWithSchemaSuccess() {
  const schema = z.object({ date: z.string().min(1) });
  const parsed = parseWithSchema(schema, { date: "2026-07-14" });
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.deepEqual(parsed.data, { date: "2026-07-14" });
}

function testParseWithSchemaFailure() {
  const schema = z.object({ date: z.string().min(1) });
  const parsed = parseWithSchema(schema, { date: "" });
  assert.equal(parsed.ok, false);
  if (parsed.ok) return;
  assert.equal(typeof parsed.error, "string");
  assert.ok(parsed.error.length > 0);
}

async function testReadJsonBodyParsesObject() {
  const parsed = await readJsonBody(
    new Request("http://local/api", {
      method: "POST",
      body: JSON.stringify({ date: "2026-07-14" }),
      headers: { "Content-Type": "application/json" },
    }),
  );
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.deepEqual(parsed.data, { date: "2026-07-14" });
}

async function testReadJsonBodyRejectsOversizedPayload() {
  const parsed = await readJsonBody(
    new Request("http://local/api", {
      method: "POST",
      body: "x".repeat(MAX_JSON_BODY_BYTES + 1),
      headers: { "Content-Type": "application/json" },
    }),
  );
  assert.equal(parsed.ok, false);
  if (parsed.ok) return;
  assert.equal(parsed.status, 413);
  assert.equal(parsed.error, "Request body is too large");
}

async function main() {
  testFormatZodErrorUsesFirstIssue();
  testParseWithSchemaSuccess();
  testParseWithSchemaFailure();
  await testReadJsonBodyParsesObject();
  await testReadJsonBodyRejectsOversizedPayload();
  console.log("parse-body.test: OK");
}

void main();
