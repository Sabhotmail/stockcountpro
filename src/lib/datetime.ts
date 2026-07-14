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

/**
 * Calendar `YYYY-MM-DD` → Date at UTC midnight for Prisma `@db.Date`.
 * Using Bangkok midnight shifts back one day when Postgres stores the UTC date.
 */
export function dateKeyToUtcDateOnly(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** `Date` from `@db.Date` → `YYYY-MM-DD` using UTC calendar parts. */
export function toDateKeyUtc(value: Date): string {
  const y = value.getUTCFullYear();
  const m = String(value.getUTCMonth() + 1).padStart(2, "0");
  const d = String(value.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Extract count date from location document ids:
 * `doc_{branchId}_{YYYYMMDD}_loc_{locationCode}`
 */
export function dateKeyFromLocationDocumentId(
  documentId: string,
): string | null {
  const match = /_(\d{8})_loc_/.exec(documentId);
  if (!match) return null;
  const raw = match[1];
  const key = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
  return /^\d{4}-\d{2}-\d{2}$/.test(key) ? key : null;
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

/** `YYYY-MM-DD` → `DD/MM/YYYY` for display inputs. */
export function dateKeyToDmy(value: string | null | undefined): string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  const [y, m, d] = value.split("-");
  return `${d}/${m}/${y}`;
}

/**
 * Parse `DD/MM/YYYY` (also accepts `D/M/YYYY`) into `YYYY-MM-DD`.
 * Returns null when invalid.
 */
export function dmyToDateKey(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);

  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    return null;
  }

  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
