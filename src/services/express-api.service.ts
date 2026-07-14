import type {
  ExpressCountDateByLocationsResponse,
  ExpressCountDateResponse,
  ExpressLocationItem,
  ExpressLocationsResponse,
  ExpressLoginResponse,
} from "@/types/express";

function getExpressConfig():
  | { baseUrl: string; username: string; password: string }
  | { error: string } {
  const baseUrl = process.env.EXPRESS_API_BASE_URL;
  const username = process.env.EXPRESS_API_USERNAME;
  const password = process.env.EXPRESS_API_PASSWORD;

  if (!baseUrl || !username || !password) {
    return { error: "Express API is not configured" };
  }

  return { baseUrl: baseUrl.replace(/\/$/, ""), username, password };
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
  const joined = locationCodes
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean)
    .join(",");
  if (!joined) return { error: "locations are required" };

  return expressGet<ExpressCountDateByLocationsResponse>(
    `/api/stockcount/countdate/${encodeURIComponent(countDate)}/locations/${joined}`,
    "Express countdate by locations",
  );
}

export interface ExpressPushCountDetail {
  LocationCode: string;
  ProductCode: string;
  CountDate: string;
  CaseQty: number;
  PieceQty: number;
  PhysicalBalance: number;
  CountFlag: string;
  UserID: string;
  ChangedDate: string;
}

export async function putExpressCountByLocation(
  countDate: string,
  locationCode: string,
  details: ExpressPushCountDetail[],
): Promise<{ success: true; response: unknown } | { error: string }> {
  const code = locationCode.trim().toUpperCase();
  if (!code) return { error: "locationCode is required" };
  if (details.length === 0) return { error: "details are required" };

  const result = await expressPutJson<{ success?: boolean; message?: string }>(
    `/api/stockcount/countdate/${encodeURIComponent(countDate)}/locationcode/${encodeURIComponent(code)}`,
    { details },
    "Express push countdate by location",
  );

  if ("error" in result) return result;
  if (result.success === false) {
    return { error: result.message ?? "Express push failed" };
  }

  return { success: true, response: result };
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
