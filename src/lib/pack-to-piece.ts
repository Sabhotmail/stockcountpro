/**
 * Convert pack count × pieces-per-pack into piece quantity.
 * Returns null when either value is not a non-negative integer.
 */
export function calculatePackToPiece(
  packs: number,
  piecesPerPack: number,
): number | null {
  if (!Number.isInteger(packs) || !Number.isInteger(piecesPerPack)) {
    return null;
  }
  if (packs < 0 || piecesPerPack < 0) {
    return null;
  }
  return packs * piecesPerPack;
}

/**
 * Parse pieces-per-pack from a product name packing hint like "(6x12)".
 * Uses the last `(packs x pieces)` group; returns the second number (pieces).
 */
export function parsePiecesPerPackFromProductName(
  productName: string,
): number | null {
  const pattern = /\((\d+)\s*[xX×]\s*(\d+)\)/g;
  let match: RegExpExecArray | null = null;
  let last: RegExpExecArray | null = null;
  while ((match = pattern.exec(productName)) !== null) {
    last = match;
  }
  if (!last) return null;

  const packsPerCase = Number.parseInt(last[1]!, 10);
  const piecesPerPack = Number.parseInt(last[2]!, 10);
  if (
    !Number.isInteger(packsPerCase) ||
    !Number.isInteger(piecesPerPack) ||
    packsPerCase <= 0 ||
    piecesPerPack <= 0
  ) {
    return null;
  }
  return piecesPerPack;
}
