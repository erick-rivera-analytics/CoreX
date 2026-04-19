import { type NextRequest } from "next/server";

import { apiJsonError, handleApiError } from "@/lib/api-error";
import { updateSpaceSchema } from "@/lib/personal-workspace-schemas";
import { archiveMyWorkSpace, updateMyWorkSpace } from "@/lib/my-work-repository";
import { enforcePersonalWriteRateLimit, getPersonalApiContext, jsonNoStore } from "@/app/api/me/_shared";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, context: { params: Promise<{ spaceId: string }> }) {
  try {
    const api = await getPersonalApiContext(request);
    if (api.error || !api.access || !api.bootstrap) return api.error;

    const rateLimitError = enforcePersonalWriteRateLimit(request, api.requestId, api.access.username);
    if (rateLimitError) return rateLimitError;

    const parsed = updateSpaceSchema.safeParse(await request.json());
    if (!parsed.success) {
      return apiJsonError("Datos del espacio invalidos.", 400, api.requestId);
    }

    const { spaceId } = await context.params;
    const space = await updateMyWorkSpace(api.bootstrap.authUserId, spaceId, parsed.data, api.access.username);
    return jsonNoStore({ space });
  } catch (error) {
    return handleApiError(error, "No se pudo actualizar el espacio personal.");
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ spaceId: string }> }) {
  try {
    const api = await getPersonalApiContext(request);
    if (api.error || !api.access || !api.bootstrap) return api.error;

    const rateLimitError = enforcePersonalWriteRateLimit(request, api.requestId, api.access.username);
    if (rateLimitError) return rateLimitError;

    const { spaceId } = await context.params;
    await archiveMyWorkSpace(api.bootstrap.authUserId, spaceId, api.access.username);
    return jsonNoStore({ ok: true });
  } catch (error) {
    return handleApiError(error, "No se pudo archivar el espacio personal.");
  }
}
