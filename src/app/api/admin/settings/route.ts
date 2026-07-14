import { NextResponse } from "next/server";
import { parseRequestBody } from "@/lib/api/parse-body";
import { appSettingsBodySchema } from "@/lib/api/schemas";
import {
  getAppSettingsForAdmin,
  updateAppSettingsForAdmin,
} from "@/services/app-settings.service";
import { getServerSession } from "@/services/mock-session.service";

export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await getAppSettingsForAdmin(session);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 403 });
  }

  return NextResponse.json({ settings: result });
}

export async function PATCH(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = await parseRequestBody(request, appSettingsBodySchema);
  if (!parsed.ok) return parsed.response;

  const result = await updateAppSettingsForAdmin(session, {
    lineLockTtlSeconds: parsed.data.lineLockTtlSeconds,
  });

  if ("error" in result) {
    const status = result.error === "Access denied" ? 403 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ settings: result });
}
