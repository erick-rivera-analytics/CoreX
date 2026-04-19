import { type NextRequest, NextResponse } from "next/server";

import { apiJsonError } from "@/lib/api-error";
import { getCurrentUserAccess, requireAuth } from "@/lib/api-auth";
import { ensurePersonalWorkspaceBootstrap } from "@/lib/personal-workspace-bootstrap";
import { getRequestId } from "@/lib/request-id";
import { checkRequestRateLimit, getEnvNumber } from "@/server/security/rate-limit";

const WRITE_RATE_LIMIT = getEnvNumber("PERSONAL_WORKSPACE_WRITE_RATE_LIMIT", 30);
const WRITE_RATE_LIMIT_WINDOW_MS = getEnvNumber("PERSONAL_WORKSPACE_WRITE_RATE_LIMIT_WINDOW_MS", 60_000);

export async function getPersonalApiContext(request: NextRequest) {
  const requestId = getRequestId(request);
  const authError = await requireAuth(request);
  if (authError) {
    return { error: authError, requestId, access: null, bootstrap: null };
  }

  const access = await getCurrentUserAccess();
  if (!access || !access.isActive) {
    return {
      error: apiJsonError("Missing authentication token", 401, requestId),
      requestId,
      access: null,
      bootstrap: null,
    };
  }

  const bootstrap = await ensurePersonalWorkspaceBootstrap(access);
  return { error: null, requestId, access, bootstrap };
}

export function enforcePersonalWriteRateLimit(request: NextRequest, requestId: string, username: string) {
  const gate = checkRequestRateLimit({
    request,
    scope: "personal-workspace:write",
    suffix: username,
    limit: WRITE_RATE_LIMIT,
    windowMs: WRITE_RATE_LIMIT_WINDOW_MS,
  });

  if (gate.allowed) {
    return null;
  }

  return NextResponse.json(
    {
      message: "Demasiados intentos. Intenta nuevamente en un momento.",
      error: "RATE_LIMIT",
      requestId,
    },
    {
      status: 429,
      headers: { "Retry-After": String(gate.retryAfterSeconds) },
    },
  );
}

export function jsonNoStore(payload: unknown, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
    },
  });
}
