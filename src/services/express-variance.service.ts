import { getDocumentForSession } from "@/lib/document-access";
import { indexVarianceByProductCode } from "@/lib/express-variance-map";
import { canPushToExpress } from "@/lib/permissions";
import type {
  ExpressVarianceFetchResult,
  ExpressVarianceLine,
} from "@/types/express-variance";
import type { MockSession } from "@/types/user";

export type ExpressVarianceServiceError = {
  error: string;
  status: number;
};

type VarianceApiConfig =
  | { ok: true; baseUrl: string; token: string }
  | ExpressVarianceServiceError;

export function resolveVarianceApiConfig(): VarianceApiConfig {
  const baseUrl = process.env.EXPRESS_VARIANCE_API_BASE_URL?.trim().replace(
    /\/$/,
    "",
  );
  const token = process.env.EXPRESS_VARIANCE_API_TOKEN?.trim();

  if (!baseUrl || !token) {
    return {
      error: "ยังไม่ได้ตั้ง EXPRESS_VARIANCE_API_BASE_URL หรือ EXPRESS_VARIANCE_API_TOKEN",
      status: 503,
    };
  }

  return { ok: true, baseUrl, token };
}

export function validateDocumentForVariance(doc: {
  documentDate: string;
  locationCode: string | null;
}): ExpressVarianceServiceError | { ok: true; countDate: string; locationCode: string } {
  const locationCode = doc.locationCode?.trim().toUpperCase() ?? "";
  if (!locationCode) {
    return {
      error: "เอกสารนี้ไม่มีรหัสคลัง Express — ดึงผลต่างไม่ได้",
      status: 400,
    };
  }

  const countDate = doc.documentDate.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(countDate)) {
    return {
      error: "วันที่เอกสารไม่ถูกต้อง",
      status: 400,
    };
  }

  return { ok: true, countDate, locationCode };
}

function parseVarianceRows(body: unknown): Array<
  ExpressVarianceLine & { ProductCode: string }
> {
  if (!body || typeof body !== "object") return [];
  const varianceData = (body as { varianceData?: unknown }).varianceData;
  if (!Array.isArray(varianceData)) return [];

  const rows: Array<ExpressVarianceLine & { ProductCode: string }> = [];
  for (const item of varianceData) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const productCode =
      typeof row.ProductCode === "string" ? row.ProductCode : null;
    if (!productCode) continue;
    rows.push({
      ProductCode: productCode,
      PhysicalBalance:
        typeof row.PhysicalBalance === "number" ? row.PhysicalBalance : null,
      LocationBalance:
        typeof row.LocationBalance === "number" ? row.LocationBalance : null,
      DifferentQty:
        typeof row.DifferentQty === "number" ? row.DifferentQty : null,
      CountFlag: typeof row.CountFlag === "string" ? row.CountFlag : "",
    });
  }
  return rows;
}

export async function callExpressVarianceApi(params: {
  baseUrl: string;
  token: string;
  countDate: string;
  locationCode: string;
}): Promise<ExpressVarianceFetchResult | ExpressVarianceServiceError> {
  const url = `${params.baseUrl}/api/stockcount/variance/countdate/${encodeURIComponent(params.countDate)}/locations/${encodeURIComponent(params.locationCode)}`;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${params.token}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });
  } catch {
    return {
      error: "โหลดผลต่างจาก Express ไม่สำเร็จ",
      status: 502,
    };
  }

  if (res.status === 404) {
    return {
      error: "ไม่พบข้อมูลผลต่างใน Express สำหรับวันที่และคลังนี้",
      status: 404,
    };
  }

  if (!res.ok) {
    return {
      error: "โหลดผลต่างจาก Express ไม่สำเร็จ",
      status: 502,
    };
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return {
      error: "โหลดผลต่างจาก Express ไม่สำเร็จ",
      status: 502,
    };
  }

  return {
    success: true,
    countDate: params.countDate,
    locationCode: params.locationCode,
    fetchedAt: new Date().toISOString(),
    varianceByProductCode: indexVarianceByProductCode(parseVarianceRows(body)),
  };
}

export async function fetchExpressVarianceForDocument(
  session: MockSession,
  documentId: string,
): Promise<ExpressVarianceFetchResult | ExpressVarianceServiceError> {
  if (!canPushToExpress(session.role)) {
    return { error: "Access denied", status: 403 };
  }

  const config = resolveVarianceApiConfig();
  if ("error" in config) {
    return config;
  }

  const access = await getDocumentForSession(session, documentId);
  if (!access.ok) {
    return { error: access.error, status: access.status };
  }

  const validated = validateDocumentForVariance(access.document);
  if ("error" in validated) {
    return validated;
  }

  return callExpressVarianceApi({
    baseUrl: config.baseUrl,
    token: config.token,
    countDate: validated.countDate,
    locationCode: validated.locationCode,
  });
}
