import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  getProductImageDirOnDisk,
  listProductCodesWithImagesOnDisk,
  productImageExistsOnDisk,
} from "@/lib/product-image-fs";

function testProductImageDirOnDisk() {
  assert.equal(
    getProductImageDirOnDisk("/app/stockcountpro"),
    join("/app/stockcountpro", "public", "products"),
  );
}

function testListAndExistsFromTempDir() {
  const root = mkdtempSync(join(tmpdir(), "scp-img-"));
  const dir = join(root, "public", "products");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "1010030013.jpg"), "");
  writeFileSync(join(dir, "ABC.webp"), "");
  writeFileSync(join(dir, "notes.txt"), "");

  try {
    const codes = listProductCodesWithImagesOnDisk(dir);
    assert.equal(codes.has("1010030013"), true);
    assert.equal(codes.has("ABC"), true);
    assert.equal(codes.has("notes"), false);

    assert.equal(productImageExistsOnDisk("1010030013", { productsDir: dir }), true);
    assert.equal(productImageExistsOnDisk("ABC", { productsDir: dir }), true);
    assert.equal(productImageExistsOnDisk("missing", { productsDir: dir }), false);
    assert.equal(productImageExistsOnDisk("  ", { productsDir: dir }), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function testMissingDirMeansNoImages() {
  const missing = join(tmpdir(), "scp-img-missing-dir-does-not-exist");
  assert.equal(listProductCodesWithImagesOnDisk(missing).size, 0);
  assert.equal(
    productImageExistsOnDisk("1010030013", { productsDir: missing }),
    false,
  );
}

testProductImageDirOnDisk();
testListAndExistsFromTempDir();
testMissingDirMeansNoImages();
console.log("product-image-fs.test: OK");
