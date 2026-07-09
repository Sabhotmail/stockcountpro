/** Application timezone (UTC+7 / Thailand). */
export const APP_TIMEZONE = "Asia/Bangkok";

/** UTC ISO string for API/DB timestamps. */
export function toIsoInstant(value: Date = new Date()): string {
  return value.toISOString();
}

/** Calendar date `YYYY-MM-DD` in Bangkok. */
export function toDateKeyBangkok(value: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

export function todayDateKeyBangkok(): string {
  return toDateKeyBangkok(new Date());
}

/** Parse `YYYY-MM-DD` as midnight in Bangkok. */
export function parseDateKeyBangkok(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;

  const parsed = new Date(`${value}T00:00:00+07:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatDateTimeTH(
  value: string | Date,
  options?: Intl.DateTimeFormatOptions,
): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString("th-TH", {
    timeZone: APP_TIMEZONE,
    ...options,
  });
}

export function formatDateTimeShortTH(
  value: string | Date | null | undefined,
): string {
  if (!value) return "—";

  return formatDateTimeTH(value, {
    dateStyle: "short",
    timeStyle: "short",
  });
}
