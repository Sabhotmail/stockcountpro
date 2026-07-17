import type {
  ExpressCountDateByLocationsResponse,
  ExpressCountDateResponse,
  ExpressLocationItem,
  ExpressLocationsResponse,
  ExpressLoginResponse,
} from "@/types/express";
import { assertSafeExpressLocationCodes } from "@/lib/express-location";
import { isExpressPushDebug, logExpressPush } from "@/lib/express-push-log";

let warnedExpressHttp = false;

function warnExpressHttpOnce(baseUrl: string): void {
  if (warnedExpressHttp) return;
  if (!baseUrl.toLowerCase().startsWith("http://")) return;
  warnedExpressHttp = true;
  console.warn(
    "[express] EXPRESS_API_BASE_URL is http:// — credentials and bearer tokens travel in cleartext.",
  );
}

function getExpressConfig():
  | { baseUrl: string; username: string; password: string }
  | { error: string } {
  const baseUrl = process.env.EXPRESS_API_BASE_URL;
  const username = process.env.EXPRESS_API_USERNAME;
  const password = process.env.EXPRESS_API_PASSWORD;

  if (!baseUrl || !username || !password) {
    return { error: "Express API is not configured" };
  }

  const normalized = baseUrl.replace(/\/$/, "");
  warnExpressHttpOnce(normalized);
  return { baseUrl: normalized, username, password };
}

let cachedToken: { token: string; expiresAtMs: number } | null = null;

function parseExpireMs(expire: string | undefined): number {
  if (!expire) return Date.now() + 55 * 60 * 1000;

  const dotnetMatch = /\/Date\((\d+)\)\//.exec(expire);
  if (dotnetMatch) {
    return Number.parseInt(dotnetMatch[1], 10);
  }

  const parsed = Date.parse(expire);
  return Number.isNaN(parsed) ? Date.now() + 55 * 60 * 1000 : parsed;
}

export async function loginExpressApi(): Promise<
  { token: string } | { error: string }
> {
  const config = getExpressConfig();
  if ("error" in config) return { error: config.error };

  const res = await fetch(`${config.baseUrl}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: config.username,
      password: config.password,
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    return { error: `Express login failed (${res.status})` };
  }

  const data = (await res.json()) as ExpressLoginResponse;
  if (!data.success || !data.token) {
    return { error: data.message ?? "Express login failed" };
  }

  cachedToken = {
    token: data.token,
    expiresAtMs: parseExpireMs(data.expire),
  };

  return { token: data.token };
}

async function getExpressToken(): Promise<{ token: string } | { error: string }> {
  if (cachedToken && cachedToken.expiresAtMs > Date.now() + 30_000) {
    return { token: cachedToken.token };
  }

  return loginExpressApi();
}

async function expressGet<T>(
  path: string,
  errorLabel: string,
): Promise<T | { error: string }> {
  const config = getExpressConfig();
  if ("error" in config) return { error: config.error };

  const tokenResult = await getExpressToken();
  if ("error" in tokenResult) return tokenResult;

  const url = `${config.baseUrl}${path}`;

  const doFetch = async (token: string) =>
    fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });

  let res = await doFetch(tokenResult.token);
  if (res.status === 401) {
    cachedToken = null;
    const retryToken = await loginExpressApi();
    if ("error" in retryToken) return retryToken;
    res = await doFetch(retryToken.token);
  }

  if (!res.ok) {
    return { error: `${errorLabel} failed (${res.status}) for ${path}` };
  }

  return (await res.json()) as T;
}

async function expressPutJson<T>(
  path: string,
  body: unknown,
  errorLabel: string,
): Promise<T | { error: string }> {
  const config = getExpressConfig();
  if ("error" in config) return { error: config.error };

  const tokenResult = await getExpressToken();
  if ("error" in tokenResult) return tokenResult;

  const url = `${config.baseUrl}${path}`;

  const doFetch = async (token: string) =>
    fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });

  let res = await doFetch(tokenResult.token);
  if (res.status === 401) {
    cachedToken = null;
    const retryToken = await loginExpressApi();
    if ("error" in retryToken) return retryToken;
    res = await doFetch(retryToken.token);
  }

  if (!res.ok) {
    let detail = "";
    try {
      const text = await res.text();
      detail = text ? `: ${text.slice(0, 300)}` : "";
    } catch {
      /* ignore body parse errors */
    }
    return {
      error: `${errorLabel} failed (${res.status}) for ${path}${detail}`,
    };
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return (await res.json()) as T;
  }

  return { success: true } as T;
}

function normalizeLocationList(
  data: ExpressLocationsResponse,
): ExpressLocationItem[] {
  return (
    data.locationData ??
    data.locations ??
    data.stockCountLocations ??
    data.data ??
    []
  );
}

export async function fetchExpressCountDate(
  countDate: string,
): Promise<ExpressCountDateResponse | { error: string }> {
  return expressGet<ExpressCountDateResponse>(
    `/api/stockcount/countdate/${encodeURIComponent(countDate)}`,
    "Express countdate",
  );
}

export async function fetchExpressLocations(): Promise<
  { locations: ExpressLocationItem[] } | { error: string }
> {
  const result = await expressGet<ExpressLocationsResponse>(
    "/api/stockcount/locations",
    "Express locations",
  );
  if ("error" in result) return result;
  if (!result.success) {
    return { error: result.message ?? "Express locations failed" };
  }
  return { locations: normalizeLocationList(result) };
}

export async function fetchExpressLocationsByCountDate(
  countDate: string,
): Promise<{ locations: ExpressLocationItem[] } | { error: string }> {
  const result = await expressGet<ExpressLocationsResponse>(
    `/api/stockcount/locations/countdate/${encodeURIComponent(countDate)}`,
    "Express locations by countdate",
  );
  if ("error" in result) {
    if (/\(404\)/.test(result.error)) {
      return {
        error: `ไม่พบข้อมูลคลังใน Express สำหรับวันที่ ${countDate} — กรุณาเลือกวันอื่น หรือตรวจสอบว่ามีใบตรวจนับใน Express แล้ว`,
      };
    }
    return {
      error: "โหลดรายการคลังจาก Express ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
    };
  }
  if (!result.success) {
    return {
      error:
        result.message?.trim() ||
        `ไม่พบข้อมูลคลังใน Express สำหรับวันที่ ${countDate}`,
    };
  }
  return { locations: normalizeLocationList(result) };
}

export async function fetchExpressCountDateByLocations(
  countDate: string,
  locationCodes: string[],
): Promise<ExpressCountDateByLocationsResponse | { error: string }> {
  // Express expects literal commas in the path, e.g. .../locations/32F1,32G1
  // Do not encodeURIComponent the joined list (that turns "," into "%2C").
  const safe = assertSafeExpressLocationCodes(locationCodes);
  if (!safe.ok) return { error: safe.error };

  return expressGet<ExpressCountDateByLocationsResponse>(
    `/api/stockcount/countdate/${encodeURIComponent(countDate)}/locations/${safe.joined}`,
    "Express countdate by locations",
  );
}

export interface ExpressPushCountDetail {
  LocationCode: string;
  ProductCode: string;
  CountDate: string;
  CaseQty: number;
  CaseUnitFactor: number;
  PieceQty: number;
  PhysicalBalance: number;
  CountFlag: string;
  UserID: string;
  ChangedDate: string;
}

export type ExpressPushRequestLog = {
  method: "PUT";
  url: string;
  locationCode: string;
  countDate: string;
  lineCount: number;
  /** First rows sent (for UI / quick inspection). */
  sampleDetails: ExpressPushCountDetail[];
  /** Full payload when EXPRESS_PUSH_DEBUG=1. */
  details?: ExpressPushCountDetail[];
};

export async function putExpressCountByLocation(
  countDate: string,
  locationCode: string,
  details: ExpressPushCountDetail[],
): Promise<
  | { success: true; response: unknown; requestLog: ExpressPushRequestLog }
  | { error: string }
> {
  const code = locationCode.trim().toUpperCase();
  if (!code) return { error: "locationCode is required" };
  if (details.length === 0) return { error: "details are required" };

  const config = getExpressConfig();
  if ("error" in config) return { error: config.error };

  const tokenResult = await getExpressToken();
  if ("error" in tokenResult) return tokenResult;

  const path = `/api/stockcount/countdate/${encodeURIComponent(countDate)}/locationcode/${encodeURIComponent(code)}`;
  const url = `${config.baseUrl}${path}`;
  const body = { details };
  const requestLog: ExpressPushRequestLog = {
    method: "PUT",
    url,
    locationCode: code,
    countDate,
    lineCount: details.length,
    sampleDetails: details.slice(0, 3),
    ...(isExpressPushDebug() ? { details } : {}),
  };

  logExpressPush("request", {
    url,
    lineCount: details.length,
    locationCode: code,
    countDate,
    userId: details[0]?.UserID,
    changedDate: details[0]?.ChangedDate,
    countFlag: details[0]?.CountFlag,
    sample: requestLog.sampleDetails,
    ...(isExpressPushDebug() ? { body } : {}),
  });

  const doFetch = async (token: string) =>
    fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });

  let res = await doFetch(tokenResult.token);
  if (res.status === 401) {
    cachedToken = null;
    const retryToken = await loginExpressApi();
    if ("error" in retryToken) return retryToken;
    res = await doFetch(retryToken.token);
  }

  const responseText = await res.text();
  let parsed: { success?: boolean; message?: string } | null = null;
  if (responseText) {
    try {
      parsed = JSON.parse(responseText) as { success?: boolean; message?: string };
    } catch {
      parsed = null;
    }
  }

  logExpressPush("response", {
    status: res.status,
    ok: res.ok,
    contentType: res.headers.get("content-type"),
    body: responseText.slice(0, isExpressPushDebug() ? 8000 : 2000),
    parsed,
  });

  if (!res.ok) {
    const detail = responseText ? `: ${responseText.slice(0, 300)}` : "";
    return {
      error: `Express push countdate by location failed (${res.status}) for ${path}${detail}`,
    };
  }

  if (parsed?.success === false) {
    return { error: parsed.message ?? "Express push failed" };
  }

  const response =
    parsed ??
    (responseText ? { raw: responseText } : { success: true, emptyBody: true });

  return { success: true, response, requestLog };
}

export async function deleteExpressCountByLocation(
  countDate: string,
  locationCode: string,
): Promise<{ success: true; response: unknown } | { error: string }> {
  const code = locationCode.trim().toUpperCase();
  if (!code) return { error: "locationCode is required" };

  const safe = assertSafeExpressLocationCodes([code]);
  if (!safe.ok) return { error: safe.error };

  const config = getExpressConfig();
  if ("error" in config) return { error: config.error };

  const tokenResult = await getExpressToken();
  if ("error" in tokenResult) return tokenResult;

  const path = `/api/stockcount/countdate/${encodeURIComponent(countDate)}/locationcode/${encodeURIComponent(code)}`;
  const url = `${config.baseUrl}${path}`;

  const doFetch = async (token: string) =>
    fetch(url, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });

  let res = await doFetch(tokenResult.token);
  if (res.status === 401) {
    cachedToken = null;
    const retryToken = await loginExpressApi();
    if ("error" in retryToken) return retryToken;
    res = await doFetch(retryToken.token);
  }

  const responseText = await res.text();
  let parsed: { success?: boolean; message?: string } | null = null;
  if (responseText) {
    try {
      parsed = JSON.parse(responseText) as { success?: boolean; message?: string };
    } catch {
      parsed = null;
    }
  }

  if (!res.ok) {
    const detail = responseText ? `: ${responseText.slice(0, 300)}` : "";
    return {
      error: `Express delete countdate by location failed (${res.status}) for ${path}${detail}`,
    };
  }

  if (parsed?.success === false) {
    return { error: parsed.message ?? "Express delete failed" };
  }

  const response =
    parsed ??
    (responseText ? { raw: responseText } : { success: true, emptyBody: true });

  return { success: true, response };
}

export function summarizeExpressCountDate(data: ExpressCountDateResponse) {
  const lines = data.stockCountData ?? [];
  const locations = new Set(lines.map((line) => line.LocationCode));

  return {
    countDate: lines[0]?.CountDate ?? null,
    totalLines: lines.length,
    locationCount: locations.size,
    locations: Array.from(locations).sort(),
  };
}
