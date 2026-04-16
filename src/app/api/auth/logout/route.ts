import { NextResponse } from "next/server";

import { clearSessionCookie } from "@/lib/auth";
import { logEvent } from "@/lib/logger";
import { getRequestId } from "@/lib/request-id";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  await clearSessionCookie();
  logEvent("info", "auth.logout", { requestId });
  return NextResponse.json({ ok: true });
}
