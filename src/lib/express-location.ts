export function normalizeExpressLocationCode(value: string): string | null {
  const trimmed = value.trim().toUpperCase();
  return trimmed.length > 0 ? trimmed : null;
}

export function validateExpressLocationCode(value: string): string | null {
  if (!/^[A-Z0-9]{1,16}$/.test(value)) {
    return "Express location code must be 1–16 alphanumeric characters";
  }
  return null;
}

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

export function formatExpressLocationCodes(codes: string[]): string {
  return codes.join(", ");
}
