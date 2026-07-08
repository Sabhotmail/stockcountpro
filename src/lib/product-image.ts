export const PRODUCT_IMAGE_DIR = "/products";

export const PRODUCT_IMAGE_EXTENSIONS = [
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
] as const;

function normalizeProductCode(productCode: string): string {
  return productCode.trim();
}

export function getProductImageCandidates(productCode: string): string[] {
  const code = normalizeProductCode(productCode);
  if (!code) return [];

  const encodedCode = encodeURIComponent(code);
  return PRODUCT_IMAGE_EXTENSIONS.map(
    (extension) => `${PRODUCT_IMAGE_DIR}/${encodedCode}${extension}`,
  );
}

export function getDefaultProductImageUrl(productCode: string): string | null {
  const candidates = getProductImageCandidates(productCode);
  return candidates[0] ?? null;
}

export function resolveProductImageUrl(
  productCode: string,
  productImageUrl?: string | null,
): string | undefined {
  const explicit = productImageUrl?.trim();
  if (explicit) return explicit;

  return getDefaultProductImageUrl(productCode) ?? undefined;
}
