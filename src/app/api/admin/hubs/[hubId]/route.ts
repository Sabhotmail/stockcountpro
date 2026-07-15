import { getServerSession } from "@/services/mock-session.service";
import { updateHubForAdmin } from "@/services/admin.service";
import { NextResponse } from "next/server";
import { parseRequestBody } from "@/lib/api/parse-body";
import { updateHubBodySchema } from "@/lib/api/schemas";

type RouteContext = {
  params: Promise<{ hubId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { hubId } = await context.params;
  const parsed = await parseRequestBody(request, updateHubBodySchema);
  if (!parsed.ok) return parsed.response;

  const result = await updateHubForAdmin(session, hubId, parsed.data);
  if ("error" in result) {
    const status =
      result.error === "Access denied"
        ? 403
        : result.error === "Hub not found"
          ? 404
          : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ hub: result });
}
