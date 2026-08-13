const MAX_CODES_IN_WARNING = 5;

export function findDuplicateProductCodes(productCodes: string[]): string[] {
  const counts = new Map<string, number>();

  for (const raw of productCodes) {
    const code = raw.trim();
    if (!code) continue;
    counts.set(code, (counts.get(code) ?? 0) + 1);
  }

  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([code]) => code);
}

export function formatDuplicateProductCodeWarning(
  duplicateCodes: string[],
): string | null {
  if (duplicateCodes.length === 0) return null;

  const shown = duplicateCodes.slice(0, MAX_CODES_IN_WARNING);
  const remaining = duplicateCodes.length - shown.length;
  const list = shown.join(", ");
  const suffix = remaining > 0 ? ` และอีก ${remaining}` : "";

  return `พบรหัสสินค้าซ้ำ ${duplicateCodes.length} รหัส: ${list}${suffix}`;
}
