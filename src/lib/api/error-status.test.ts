import assert from "node:assert/strict";
import { httpStatusForServiceError } from "@/lib/api/error-status";

assert.equal(httpStatusForServiceError("Access denied"), 403);
assert.equal(httpStatusForServiceError("Document not found"), 404);
assert.equal(httpStatusForServiceError("Version not found"), 404);
assert.equal(
  httpStatusForServiceError("Only submitted documents can be approved"),
  400,
);
console.log("error-status.test: OK");
