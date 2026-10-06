import assert from "node:assert/strict";
import { calculatePackToPiece } from "@/lib/pack-to-piece";

assert.equal(calculatePackToPiece(5, 12), 60, "5 packs × 12 = 60 pieces");
assert.equal(calculatePackToPiece(0, 12), 0, "0 packs × 12 = 0 pieces");
assert.equal(calculatePackToPiece(3, 0), 0, "3 packs × 0 = 0 pieces");

assert.equal(calculatePackToPiece(-1, 12), null, "negative packs invalid");
assert.equal(calculatePackToPiece(5, -1), null, "negative piecesPerPack invalid");
assert.equal(calculatePackToPiece(1.5, 12), null, "non-integer packs invalid");
assert.equal(calculatePackToPiece(5, 2.5), null, "non-integer piecesPerPack invalid");
assert.equal(calculatePackToPiece(NaN, 12), null, "NaN packs invalid");
assert.equal(calculatePackToPiece(5, NaN), null, "NaN piecesPerPack invalid");

console.log("pack-to-piece.test: OK");
