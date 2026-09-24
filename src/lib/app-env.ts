export type AppEnv = "production" | "test" | "nkr";
export type EnvBannerTone = "amber" | "sky";

/** Content height of the env banner, excluding the notch safe-area. */
export const ENV_BANNER_HEIGHT = "2.75rem";

export function getEnvBannerCssVars(
  hasBanner: boolean,
): { "--env-banner-h": string } | undefined {
  if (!hasBanner) return undefined;
  return {
    "--env-banner-h": `calc(${ENV_BANNER_HEIGHT} + env(safe-area-inset-top, 0px))`,
  };
}

export const PRODUCTION_EXPRESS_PORT = "8080";
export const TEST_EXPRESS_PORT = "8081";
export const NKR_EXPRESS_HOST = "100.71.103.65";
export const NKR_EXPRESS_PORT = "8080";
export const PRODUCTION_APP_PORT = "3000";
export const TEST_APP_PORT = "3001";
export const NKR_APP_PORT = "3003";
export const PRODUCTION_SESSION_COOKIE = "stockcount_session";
export const TEST_SESSION_COOKIE = "stockcount_session_test";
export const NKR_SESSION_COOKIE = "stockcount_session_nkr";

type RoomConfig = {
  expressHostname: string | null;
  expressPort: string;
  appPort: string;
  cookie: string;
  title: string;
  banner: string | null;
  tone: EnvBannerTone | null;
  dbSuffix: string | null;
};

const ROOMS: Record<AppEnv, RoomConfig> = {
  production: {
    expressHostname: null,
    expressPort: PRODUCTION_EXPRESS_PORT,
    appPort: PRODUCTION_APP_PORT,
    cookie: PRODUCTION_SESSION_COOKIE,
    title: "StockCount Pro",
    banner: null,
    tone: null,
    dbSuffix: null,
  },
  test: {
    expressHostname: null,
    expressPort: TEST_EXPRESS_PORT,
    appPort: TEST_APP_PORT,
    cookie: TEST_SESSION_COOKIE,
    title: "TEST · StockCount Pro",
    banner: "ห้องทดสอบ — ข้อมูลนี้ไม่ใช่ของจริง",
    tone: "amber",
    dbSuffix: "_test",
  },
  nkr: {
    expressHostname: NKR_EXPRESS_HOST,
    expressPort: NKR_EXPRESS_PORT,
    appPort: NKR_APP_PORT,
    cookie: NKR_SESSION_COOKIE,
    title: "NKR · StockCount Pro",
    banner: "สาขาชั่วคราว · NKR — แยกจากห้องของจริง",
    tone: "sky",
    dbSuffix: "_nkr",
  },
};

const APP_ENVS = Object.keys(ROOMS) as AppEnv[];

export type AppEnvIsolationInput = {
  appEnv: AppEnv;
  databaseUrl?: string;
  expressBaseUrl?: string;
};

export function getAppEnv(raw: string | undefined = process.env.APP_ENV): AppEnv {
  const value = raw?.trim().toLowerCase() ?? "";
  if (value === "" || value === "production" || value === "prod") {
    return "production";
  }
  if (value === "test" || value === "nkr") return value;
  throw new Error(
    `APP_ENV must be "production", "test", or "nkr"${raw ? `, got "${raw.trim()}"` : ""}`,
  );
}

export function isTestAppEnv(
  raw: string | undefined = process.env.APP_ENV,
): boolean {
  return getAppEnv(raw) === "test";
}

function room(env: AppEnv = getAppEnv()): RoomConfig {
  return ROOMS[env];
}

export function getSessionCookieName(
  env: AppEnv = getAppEnv(),
): string {
  return room(env).cookie;
}

/** Request Host port wins so one `next build` can serve :3000, :3001, and :3003. */
export function getSessionCookieNameFromHost(
  host: string | null | undefined,
  env: AppEnv = getAppEnv(),
): string {
  const port = host?.match(/:(\d+)$/)?.[1];
  if (port === TEST_APP_PORT) return TEST_SESSION_COOKIE;
  if (port === NKR_APP_PORT) return NKR_SESSION_COOKIE;
  if (port === PRODUCTION_APP_PORT) return PRODUCTION_SESSION_COOKIE;
  return getSessionCookieName(env);
}

export function getDocumentTitle(env: AppEnv = getAppEnv()): string {
  return room(env).title;
}

export function getEnvBannerText(env: AppEnv = getAppEnv()): string | null {
  return room(env).banner;
}

export function getEnvBannerTone(env: AppEnv = getAppEnv()): EnvBannerTone | null {
  return room(env).tone;
}

export function databaseNameFromUrl(databaseUrl: string): string {
  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error(`[app-env] DATABASE_URL is not a valid URL`);
  }
  const name = decodeURIComponent(parsed.pathname.replace(/^\//, "")).split(
    "/",
  )[0];
  if (!name) {
    throw new Error(`[app-env] DATABASE_URL is missing a database name`);
  }
  return name;
}

function parseExpressUrl(expressBaseUrl: string): {
  hostname: string;
  port: string;
} {
  let parsed: URL;
  try {
    parsed = new URL(expressBaseUrl);
  } catch {
    throw new Error(`[app-env] EXPRESS_API_BASE_URL is not a valid URL`);
  }
  const port = parsed.port || (parsed.protocol === "https:" ? "443" : "80");
  return { hostname: parsed.hostname.toLowerCase(), port };
}

function expressMatchesRoom(
  env: AppEnv,
  parsed: { hostname: string; port: string },
): boolean {
  const cfg = ROOMS[env];
  if (parsed.port !== cfg.expressPort) return false;
  if (cfg.expressHostname && parsed.hostname !== cfg.expressHostname) {
    return false;
  }
  if (env === "production" && parsed.hostname === NKR_EXPRESS_HOST) {
    return false;
  }
  return true;
}

function expectedExpressHint(env: AppEnv): string {
  const cfg = ROOMS[env];
  if (cfg.expressHostname) {
    return `${cfg.expressHostname}:${cfg.expressPort}`;
  }
  return `port ${cfg.expressPort}`;
}

export function assertAppEnvIsolation(
  input: AppEnvIsolationInput = {
    appEnv: getAppEnv(),
    databaseUrl: process.env.DATABASE_URL,
    expressBaseUrl: process.env.EXPRESS_API_BASE_URL,
  },
): void {
  const databaseUrl = input.databaseUrl?.trim();
  if (!databaseUrl) {
    throw new Error("[app-env] DATABASE_URL is required");
  }
  const dbName = databaseNameFromUrl(databaseUrl);
  const current = room(input.appEnv);

  if (current.dbSuffix && !dbName.toLowerCase().endsWith(current.dbSuffix)) {
    throw new Error(
      `[app-env] APP_ENV=${input.appEnv} requires DATABASE_URL database name to end with ${current.dbSuffix} (got "${dbName}")`,
    );
  }
  if (!current.dbSuffix) {
    for (const other of APP_ENVS) {
      const suffix = ROOMS[other].dbSuffix;
      if (suffix && dbName.toLowerCase().endsWith(suffix)) {
        throw new Error(
          `[app-env] APP_ENV=production refuses database name ending with ${suffix} (got "${dbName}")`,
        );
      }
    }
  }

  const expressBaseUrl = input.expressBaseUrl?.trim();
  if (!expressBaseUrl) {
    throw new Error("[app-env] EXPRESS_API_BASE_URL is required");
  }
  const parsed = parseExpressUrl(expressBaseUrl);

  if (!expressMatchesRoom(input.appEnv, parsed)) {
    const owner =
      APP_ENVS.find((key) => expressMatchesRoom(key, parsed)) ??
      `${parsed.hostname}:${parsed.port}`;
    throw new Error(
      `[app-env] APP_ENV=${input.appEnv} refuses Express ${parsed.hostname}:${parsed.port} (${owner}). Use ${expectedExpressHint(input.appEnv)}.`,
    );
  }
}
