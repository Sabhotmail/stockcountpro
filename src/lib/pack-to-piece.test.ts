import assert from "node:assert/strict";
import {
  calculatePackToPiece,
  parsePiecesPerPackFromProductName,
} from "@/lib/pack-to-piece";

assert.equal(calculatePackToPiece(5, 12), 60, "5 packs × 12 = 60 pieces");
assert.equal(calculatePackToPiece(0, 12), 0, "0 packs × 12 = 0 pieces");
assert.equal(calculatePackToPiece(3, 0), 0, "3 packs × 0 = 0 pieces");

assert.equal(calculatePackToPiece(-1, 12), null, "negative packs invalid");
assert.equal(calculatePackToPiece(5, -1), null, "negative piecesPerPack invalid");
assert.equal(calculatePackToPiece(1.5, 12), null, "non-integer packs invalid");
assert.equal(calculatePackToPiece(5, 2.5), null, "non-integer piecesPerPack invalid");
assert.equal(calculatePackToPiece(NaN, 12), null, "NaN packs invalid");
assert.equal(calculatePackToPiece(5, NaN), null, "NaN piecesPerPack invalid");

assert.equal(
  parsePiecesPerPackFromProductName("เจเล่ไลท์ ส้ม 5 (6x12)"),
  12,
  "parses (6x12) pieces-per-pack",
);
assert.equal(
  parsePiecesPerPackFromProductName("สินค้า (6X12)"),
  12,
  "parses uppercase X",
);
assert.equal(
  parsePiecesPerPackFromProductName("สินค้า (6×12)"),
  12,
  "parses multiply sign",
);
assert.equal(
  parsePiecesPerPackFromProductName("สินค้า (6 x 12)"),
  12,
  "parses spaced x",
);
assert.equal(
  parsePiecesPerPackFromProductName("A (2x6) B (3x24)"),
  24,
  "uses last packing hint",
);
assert.equal(
  parsePiecesPerPackFromProductName("ไม่มีแพ็กกิ้ง"),
  null,
  "no hint → null",
);
assert.equal(
  parsePiecesPerPackFromProductName("สินค้า (0x12)"),
  null,
  "zero pieces invalid",
);

console.log("pack-to-piece.test: OK");
