import { existsSync, readdirSync } from "node:fs";
import nodePath from "node:path";
import { PRODUCT_IMAGE_EXTENSIONS } from "@/lib/product-image";

function normalizeProductCode(productCode: string): string {
  return productCode.trim();
}

// Computed access: a direct path.join(cwd, "public", "products") makes Turbopack
// trace every file under public/products into the server build.
function joinDiskPath(...segments: string[]): string {
  const join = nodePath["join"] as (...parts: string[]) => string;
  return join(...segments);
}

export function getProductImageDirOnDisk(cwd: string = process.cwd()): string {
  return joinDiskPath(cwd, "public", "products");
}

/** Product codes that have at least one image file under public/products. */
export function listProductCodesWithImagesOnDisk(
  productsDir: string = getProductImageDirOnDisk(),
): Set<string> {
  const codes = new Set<string>();
  if (!existsSync(productsDir)) return codes;

  for (const name of readdirSync(productsDir)) {
    const lower = name.toLowerCase();
    for (const ext of PRODUCT_IMAGE_EXTENSIONS) {
      if (lower.endsWith(ext)) {
        codes.add(name.slice(0, -ext.length));
        break;
      }
    }
  }
  return codes;
}

export function productImageExistsOnDisk(
  productCode: string,
  options?: {
    productsDir?: string;
    imageCodes?: Set<string>;
  },
): boolean {
  const code = normalizeProductCode(productCode);
  if (!code) return false;

  if (options?.imageCodes) {
    return options.imageCodes.has(code);
  }

  const dir = options?.productsDir ?? getProductImageDirOnDisk();
  return PRODUCT_IMAGE_EXTENSIONS.some((ext) =>
    existsSync(joinDiskPath(dir, `${code}${ext}`)),
  );
}
