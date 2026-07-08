import { NextResponse } from "next/server";
import { getServerSession } from "@/services/mock-session.service";

export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ user: session });
}
