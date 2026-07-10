import { NextResponse } from "next/server";
import {
  previewExpressCountDate,
  syncExpressCountDate,
} from "@/services/express-sync.service";
import { getServerSession } from "@/services/mock-session.service";

export async function GET(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  if (!date) {
    return NextResponse.json({ error: "date is required" }, { status: 400 });
  }

  const result = await previewExpressCountDate(session, date);
  if ("error" in result) {
    const message = result.error ?? "Preview failed";
    const status =
      message === "Access denied"
        ? 403
        : message.includes("not configured")
          ? 503
          : 400;
    return NextResponse.json({ error: message }, { status });
  }

  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    date?: string;
    locations?: unknown;
  };
  if (!body.date) {
    return NextResponse.json({ error: "date is required" }, { status: 400 });
  }

  if (
    !Array.isArray(body.locations) ||
    !body.locations.every((item) => typeof item === "string")
  ) {
    return NextResponse.json(
      { error: "locations must be an array of strings" },
      { status: 400 },
    );
  }

  const result = await syncExpressCountDate(session, body.date, body.locations);
  if ("error" in result) {
    const message = result.error ?? "Sync failed";
    const status =
      message === "Access denied"
        ? 403
        : message.includes("not configured") || message.includes("Express")
          ? 502
          : 400;
    return NextResponse.json({ error: message }, { status });
  }

  return NextResponse.json(result);
}
