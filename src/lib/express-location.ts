export function normalizeExpressLocationPrefix(
  value: string | null | undefined,
): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim().toUpperCase();
  return trimmed.length > 0 ? trimmed : null;
}

export function validateExpressLocationPrefix(value: string): string | null {
  if (!/^[A-Z0-9]{2}$/.test(value)) {
    return "Express location prefix must be exactly 2 alphanumeric characters";
  }
  return null;
}

export function extractLocationPrefix(locationCode: string): string | null {
  const normalized = locationCode.trim().toUpperCase();
  if (normalized.length < 2) return null;
  return normalized.slice(0, 2);
}

/** @deprecated kept only if needed during migration — remove callers in later tasks */
export function normalizeExpressLocationCode(value: string): string | null {
  const trimmed = value.trim().toUpperCase();
  return trimmed.length > 0 ? trimmed : null;
}

/** @deprecated kept only if needed during migration — remove callers in later tasks */
export function validateExpressLocationCode(value: string): string | null {
  if (!/^[A-Z0-9]{1,16}$/.test(value)) {
    return "Express location code must be 1–16 alphanumeric characters";
  }
  return null;
}

/** @deprecated kept only if needed during migration — remove callers in later tasks */
export function normalizeExpressLocationCodes(values: string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const value of values) {
    const code = normalizeExpressLocationCode(value);
    if (!code || seen.has(code)) continue;
    seen.add(code);
    normalized.push(code);
  }

  return normalized.sort();
}

/** @deprecated kept only if needed during migration — remove callers in later tasks */
export function formatExpressLocationCodes(codes: string[]): string {
  return codes.join(", ");
}
