import type {
  ExpressCountDateResponse,
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

export async function fetchExpressCountDate(
  countDate: string,
): Promise<ExpressCountDateResponse | { error: string }> {
  const config = getExpressConfig();
  if ("error" in config) return { error: config.error };

  const tokenResult = await getExpressToken();
  if ("error" in tokenResult) return tokenResult;

  const res = await fetch(
    `${config.baseUrl}/api/stockcount/countdate/${encodeURIComponent(countDate)}`,
    {
      headers: {
        Authorization: `Bearer ${tokenResult.token}`,
        Accept: "application/json",
      },
      cache: "no-store",
    },
  );

  if (res.status === 401) {
    cachedToken = null;
    const retryToken = await loginExpressApi();
    if ("error" in retryToken) return retryToken;

    const retryRes = await fetch(
      `${config.baseUrl}/api/stockcount/countdate/${encodeURIComponent(countDate)}`,
      {
        headers: {
          Authorization: `Bearer ${retryToken.token}`,
          Accept: "application/json",
        },
        cache: "no-store",
      },
    );

    if (!retryRes.ok) {
      return { error: `Express countdate failed (${retryRes.status})` };
    }

    return (await retryRes.json()) as ExpressCountDateResponse;
  }

  if (!res.ok) {
    return { error: `Express countdate failed (${res.status})` };
  }

  return (await res.json()) as ExpressCountDateResponse;
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
