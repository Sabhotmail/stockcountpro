import assert from "node:assert/strict";
import {
  COUNT_QTY_NOT_COUNTED,
  requiresQtySaveConfirmation,
} from "@/lib/count-qty";

assert.equal(
  requiresQtySaveConfirmation(5, false, null),
  true,
  "first count on Express-counted field needs confirm",
);
assert.equal(
  requiresQtySaveConfirmation(5, false, COUNT_QTY_NOT_COUNTED),
  true,
  "first count from -1 needs confirm",
);
assert.equal(
  requiresQtySaveConfirmation(6, false, 5),
  false,
  "correcting an existing counted qty must autosave without confirm",
);
assert.equal(
  requiresQtySaveConfirmation(5, true, null),
  false,
  "Express-not-counted field skips confirm",
);
assert.equal(
  requiresQtySaveConfirmation(COUNT_QTY_NOT_COUNTED, false, 5),
  false,
  "clearing/-1 never needs confirm",
);

console.log("count-qty.test: OK");
