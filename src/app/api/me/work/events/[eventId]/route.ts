import { type NextRequest } from "next/server";

import { apiJsonError, handleApiError } from "@/lib/api-error";
import { updateEventSchema } from "@/lib/personal-workspace-schemas";
import { archiveMyEvent, getMyEvent, updateMyEvent } from "@/lib/my-work-repository";
import { enforcePersonalWriteRateLimit, getPersonalApiContext, jsonNoStore } from "@/app/api/me/_shared";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: { params: Promise<{ eventId: string }> }) {
  try {
    const api = await getPersonalApiContext(request);
    if (api.error || !api.bootstrap) return api.error;

    const { eventId } = await context.params;
    const event = await getMyEvent(api.bootstrap.authUserId, eventId);
    if (!event) {
      return apiJsonError("No se encontro el evento solicitado.", 404, api.requestId);
    }

    return jsonNoStore({ event });
  } catch (error) {
    return handleApiError(error, "No se pudo cargar el evento.");
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ eventId: string }> }) {
  try {
    const api = await getPersonalApiContext(request);
    if (api.error || !api.access || !api.bootstrap) return api.error;

    const rateLimitError = enforcePersonalWriteRateLimit(request, api.requestId, api.access.username);
    if (rateLimitError) return rateLimitError;

    const parsed = updateEventSchema.safeParse(await request.json());
    if (!parsed.success) {
      return apiJsonError("Datos del evento invalidos.", 400, api.requestId);
    }

    const { eventId } = await context.params;
    const event = await updateMyEvent(api.bootstrap.authUserId, eventId, parsed.data, api.access.username);
    return jsonNoStore({ event });
  } catch (error) {
    return handleApiError(error, "No se pudo actualizar el evento.");
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ eventId: string }> }) {
  try {
    const api = await getPersonalApiContext(request);
    if (api.error || !api.access || !api.bootstrap) return api.error;

    const rateLimitError = enforcePersonalWriteRateLimit(request, api.requestId, api.access.username);
    if (rateLimitError) return rateLimitError;

    const { eventId } = await context.params;
    await archiveMyEvent(api.bootstrap.authUserId, eventId, api.access.username);
    return jsonNoStore({ ok: true });
  } catch (error) {
    return handleApiError(error, "No se pudo archivar el evento.");
  }
}
