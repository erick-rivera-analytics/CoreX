import { type NextRequest } from "next/server";

import { apiJsonError, handleApiError } from "@/lib/api-error";
import { updateReminderSchema } from "@/lib/personal-workspace-schemas";
import { updateMyReminder } from "@/lib/my-work-repository";
import { enforcePersonalWriteRateLimit, getPersonalApiContext, jsonNoStore } from "@/app/api/me/_shared";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, context: { params: Promise<{ reminderId: string }> }) {
  try {
    const api = await getPersonalApiContext(request);
    if (api.error || !api.access || !api.bootstrap) return api.error;

    const rateLimitError = enforcePersonalWriteRateLimit(request, api.requestId, api.access.username);
    if (rateLimitError) return rateLimitError;

    const parsed = updateReminderSchema.safeParse(await request.json());
    if (!parsed.success) {
      return apiJsonError("Datos del recordatorio invalidos.", 400, api.requestId);
    }

    const { reminderId } = await context.params;
    const reminder = await updateMyReminder(api.bootstrap.authUserId, reminderId, parsed.data, api.access.username);
    return jsonNoStore({ reminder });
  } catch (error) {
    return handleApiError(error, "No se pudo actualizar el recordatorio.");
  }
}
