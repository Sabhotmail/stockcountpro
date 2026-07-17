import { NextResponse } from "next/server";
import { parseRequestBody } from "@/lib/api/parse-body";
import {
  expressDeleteBodySchema,
  expressDeletePreviewQuerySchema,
  expressDeleteRetryBodySchema,
} from "@/lib/api/schemas";
import { httpStatusForServiceError } from "@/lib/api/error-status";
import {
  executeExpressDelete,
  previewExpressDelete,
  retryExpressDelete,
} from "@/services/express-delete.service";
import { getServerSession } from "@/services/mock-session.service";

function statusForExpressError(message: string): number {
  if (message === "Access denied") return 403;
  if (message.includes("not configured")) return 503;
  if (message.startsWith("Express ")) return 502;
  return 400;
}

export async function GET(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const parsed = expressDeletePreviewQuerySchema.safeParse({
    countDate: searchParams.get("countDate") ?? searchParams.get("date") ?? "",
    locationCode: searchParams.get("locationCode") ?? "",
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid query" },
      { status: 400 },
    );
  }

  const result = await previewExpressDelete(
    session,
    parsed.data.countDate,
    parsed.data.locationCode,
  );
  if ("error" in result) {
    return NextResponse.json(
      { error: result.error },
      { status: statusForExpressError(result.error) },
    );
  }

  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = await parseRequestBody(request, expressDeleteBodySchema);
  if (!parsed.ok) return parsed.response;

  const result = await executeExpressDelete(
    session,
    parsed.data.countDate,
    parsed.data.locationCode,
    parsed.data.documentId,
    parsed.data.confirmPhrase,
  );

  if ("partial" in result && result.partial) {
    return NextResponse.json(result, { status: 207 });
  }

  if ("error" in result) {
    const status =
      result.status ??
      httpStatusForServiceError(result.error);
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json(result);
}

export async function PATCH(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = await parseRequestBody(request, expressDeleteRetryBodySchema);
  if (!parsed.ok) return parsed.response;

  const result = await retryExpressDelete(
    session,
    parsed.data.countDate,
    parsed.data.locationCode,
  );

  if ("error" in result) {
    const status = result.status ?? statusForExpressError(result.error);
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json(result);
}
