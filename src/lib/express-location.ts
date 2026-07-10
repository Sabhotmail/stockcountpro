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
