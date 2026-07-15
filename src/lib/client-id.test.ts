import assert from "node:assert/strict";
import { newClientMutationId } from "@/lib/client-id";

const a = newClientMutationId();
const b = newClientMutationId();
assert.ok(typeof a === "string" && a.length >= 8);
assert.ok(typeof b === "string" && b.length >= 8);
assert.notEqual(a, b);
console.log("client-id.test: OK");
