import { getDocumentForSession } from "@/lib/document-access";
import { indexBalancesByProductCode } from "@/lib/pre-push-variance";
import { canPushToExpress } from "@/lib/permissions";
import type { PrePushBalancesResult } from "@/types/express-variance";
import type { MockSession } from "@/types/user";

export type PrePushVarianceServiceError = {
  error: string;
  status: number;
};

function resolveVarianceApiConfig():
  | { ok: true; baseUrl: string; token: string }
  | PrePushVarianceServiceError {
  const baseUrl = process.env.EXPRESS_VARIANCE_API_BASE_URL?.trim().replace(
    /\/$/,
    "",
  );
  const token = process.env.EXPRESS_VARIANCE_API_TOKEN?.trim();
  if (!baseUrl || !token) {
    return {
      error:
        "ยังไม่ได้ตั้ง EXPRESS_VARIANCE_API_BASE_URL หรือ EXPRESS_VARIANCE_API_TOKEN",
      status: 503,
    };
  }
  return { ok: true, baseUrl, token };
}

export async function fetchPrePushBalancesForDocument(
  session: MockSession,
  documentId: string,
): Promise<PrePushBalancesResult | PrePushVarianceServiceError> {
  if (!canPushToExpress(session.role)) {
    return { error: "Access denied", status: 403 };
  }

  const config = resolveVarianceApiConfig();
  if ("error" in config) return config;

  const access = await getDocumentForSession(session, documentId);
  if (!access.ok) {
    return { error: access.error, status: access.status };
  }

  const locationCode = access.document.locationCode?.trim().toUpperCase() ?? "";
  if (!locationCode) {
    return {
      error: "เอกสารนี้ไม่มีรหัสคลัง Express — ดึงคงเหลือไม่ได้",
      status: 400,
    };
  }

  const url = `${config.baseUrl}/api/stockcount/locations/${encodeURIComponent(locationCode)}/balances`;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${config.token}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });
  } catch {
    return { error: "โหลดคงเหลือจาก Express ไม่สำเร็จ", status: 502 };
  }

  if (!res.ok) {
    return { error: "โหลดคงเหลือจาก Express ไม่สำเร็จ", status: 502 };
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return { error: "โหลดคงเหลือจาก Express ไม่สำเร็จ", status: 502 };
  }

  const balances =
    body &&
    typeof body === "object" &&
    Array.isArray((body as { balances?: unknown }).balances)
      ? ((body as { balances: Array<{ ProductCode?: unknown; LocationBalance?: unknown }> })
          .balances)
      : [];

  const rows = balances
    .filter((row) => typeof row.ProductCode === "string")
    .map((row) => ({
      ProductCode: row.ProductCode as string,
      LocationBalance:
        typeof row.LocationBalance === "number" ? row.LocationBalance : null,
    }));

  return {
    success: true,
    locationCode,
    fetchedAt: new Date().toISOString(),
    balanceByProductCode: indexBalancesByProductCode(rows),
  };
}
