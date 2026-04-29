import { NextRequest, NextResponse } from "next/server";

import { requireAuth, getCurrentUserAccess } from "@/lib/api-auth";
import { apiJsonError, handleApiError } from "@/lib/api-error";
import { getRequestId, createRequestId } from "@/lib/request-id";
import { canAccessResource } from "@/lib/access-control";
import { checkRequestRateLimit, getEnvNumber } from "@/server/security/rate-limit";
import { updateFollowupResponseSchema } from "@/lib/talento-humano-seguimientos-schemas";
import { getFollowupResponseDetail, updateFollowupResponse } from "@/lib/talento-humano-seguimientos-responses";

export const dynamic = "force-dynamic";

// ── GET: detalle de una respuesta ─────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  const access = await getCurrentUserAccess();
  if (!access) return NextResponse.json({ message: "No autenticado." }, { status: 401 });

  try {
    const { eventId: rawEventId } = await params;
    const eventId = rawEventId?.trim();
    if (!eventId) {
      return NextResponse.json({ message: "eventId requerido." }, { status: 400 });
    }

    const canSensitive = access.isSuperadmin
      || canAccessResource("panel:tthh.followups.sensitive", access.allowedResources, access.isSuperadmin);

    const detail = await getFollowupResponseDetail(eventId, canSensitive);

    if (!detail) {
      return NextResponse.json({ message: "Seguimiento no encontrado." }, { status: 404 });
    }

    return NextResponse.json(detail, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return handleApiError(error, "No se pudo cargar el detalle del seguimiento.");
  }
}

// PATCH: actualizar respuesta preservando historial.

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const requestId = getRequestId(request);
  const authError = await requireAuth(request);
  if (authError) return authError;

  const access = await getCurrentUserAccess();
  if (!access) return apiJsonError("No autenticado.", 401, requestId);

  // RBAC: requiere admin o superadmin
  const canAdmin = access.isSuperadmin
    || canAccessResource("panel:tthh.followups.admin", access.allowedResources, access.isSuperadmin);
  if (!canAdmin) {
    return apiJsonError("No tienes permiso para corregir seguimientos.", 403, requestId);
  }

  // Rate limit
  const rl = checkRequestRateLimit({
    request,
    scope: "tthh-followups:write",
    suffix: access.username,
    limit: getEnvNumber("TTHH_FOLLOWUPS_WRITE_RATE_LIMIT", 30),
    windowMs: getEnvNumber("TTHH_FOLLOWUPS_WRITE_RATE_LIMIT_WINDOW_MS", 60_000),
  });
  if (!rl.allowed) {
    return apiJsonError("Demasiados intentos. Intente más tarde.", 429, requestId, {
      "Retry-After": String(rl.retryAfterSeconds),
    });
  }

  const { eventId: rawEventId } = await params;
  const eventId = rawEventId?.trim();
  if (!eventId) {
    return apiJsonError("eventId requerido.", 400, requestId);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiJsonError("Cuerpo de la solicitud inválido.", 400, requestId);
  }

  const parsed = updateFollowupResponseSchema.safeParse(body);
  if (!parsed.success) {
    return apiJsonError("Datos de la solicitud inválidos.", 400, requestId);
  }

  try {
    const runId = createRequestId();
    const result = await updateFollowupResponse(eventId, parsed.data, access.username, runId);

    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return handleApiError(error, "No se pudo actualizar el seguimiento.", requestId);
  }
}
