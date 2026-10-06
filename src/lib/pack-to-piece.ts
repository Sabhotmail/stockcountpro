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
