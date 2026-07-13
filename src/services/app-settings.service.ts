import {
  DEFAULT_LINE_LOCK_TTL_SECONDS,
  LINE_LOCK_TTL_MAX_SECONDS,
  LINE_LOCK_TTL_MIN_SECONDS,
} from "@/lib/count-collab-constants";
import { prisma } from "@/lib/prisma";
import { canManageSystem } from "@/services/admin.service";
import type { MockSession } from "@/types/user";

const SETTINGS_ID = "default";

let cachedTtlMs: number | null = null;
let cachedAt = 0;
const CACHE_MS = 5_000;

export type AppSettings = {
  lineLockTtlSeconds: number;
  updatedAt: string;
  updatedBy: string | null;
};

export function invalidateLineLockTtlCache(): void {
  cachedTtlMs = null;
  cachedAt = 0;
}

export async function getLineLockTtlMs(): Promise<number> {
  const now = Date.now();
  if (cachedTtlMs !== null && now - cachedAt < CACHE_MS) {
    return cachedTtlMs;
  }

  const row = await prisma.appSetting.findUnique({
    where: { id: SETTINGS_ID },
  });

  const seconds = row?.lineLockTtlSeconds ?? DEFAULT_LINE_LOCK_TTL_SECONDS;
  cachedTtlMs = seconds * 1000;
  cachedAt = now;
  return cachedTtlMs;
}

function mapAppSettings(row: {
  lineLockTtlSeconds: number;
  updatedAt: Date;
  updatedBy: string | null;
}): AppSettings {
  return {
    lineLockTtlSeconds: row.lineLockTtlSeconds,
    updatedAt: row.updatedAt.toISOString(),
    updatedBy: row.updatedBy,
  };
}

export async function getAppSettingsForAdmin(
  session: MockSession,
): Promise<AppSettings | { error: string }> {
  if (!canManageSystem(session)) {
    return { error: "Access denied" };
  }

  const row = await prisma.appSetting.findUnique({
    where: { id: SETTINGS_ID },
  });

  if (!row) {
    return {
      lineLockTtlSeconds: DEFAULT_LINE_LOCK_TTL_SECONDS,
      updatedAt: new Date().toISOString(),
      updatedBy: null,
    };
  }

  return mapAppSettings(row);
}

export async function updateAppSettingsForAdmin(
  session: MockSession,
  input: { lineLockTtlSeconds: number },
): Promise<AppSettings | { error: string }> {
  if (!canManageSystem(session)) {
    return { error: "Access denied" };
  }

  const seconds = Math.round(input.lineLockTtlSeconds);
  if (
    !Number.isFinite(seconds) ||
    seconds < LINE_LOCK_TTL_MIN_SECONDS ||
    seconds > LINE_LOCK_TTL_MAX_SECONDS
  ) {
    return {
      error: `ระยะเวลา lock ต้องอยู่ระหว่าง ${LINE_LOCK_TTL_MIN_SECONDS}–${LINE_LOCK_TTL_MAX_SECONDS} วินาที`,
    };
  }

  const now = new Date();
  const row = await prisma.appSetting.upsert({
    where: { id: SETTINGS_ID },
    create: {
      id: SETTINGS_ID,
      lineLockTtlSeconds: seconds,
      updatedAt: now,
      updatedBy: session.userId,
    },
    update: {
      lineLockTtlSeconds: seconds,
      updatedAt: now,
      updatedBy: session.userId,
    },
  });

  invalidateLineLockTtlCache();
  return mapAppSettings(row);
}
