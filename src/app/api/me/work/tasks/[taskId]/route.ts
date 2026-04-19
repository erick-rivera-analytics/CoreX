import { type NextRequest } from "next/server";

import { apiJsonError, handleApiError } from "@/lib/api-error";
import { updateTaskSchema } from "@/lib/personal-workspace-schemas";
import { archiveMyTask, getMyTask, updateMyTask } from "@/lib/my-work-repository";
import { enforcePersonalWriteRateLimit, getPersonalApiContext, jsonNoStore } from "@/app/api/me/_shared";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: { params: Promise<{ taskId: string }> }) {
  try {
    const api = await getPersonalApiContext(request);
    if (api.error || !api.bootstrap) return api.error;

    const { taskId } = await context.params;
    const task = await getMyTask(api.bootstrap.authUserId, taskId);
    if (!task) {
      return apiJsonError("No se encontro la tarea solicitada.", 404, api.requestId);
    }

    return jsonNoStore({ task });
  } catch (error) {
    return handleApiError(error, "No se pudo cargar la tarea.");
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ taskId: string }> }) {
  try {
    const api = await getPersonalApiContext(request);
    if (api.error || !api.access || !api.bootstrap) return api.error;

    const rateLimitError = enforcePersonalWriteRateLimit(request, api.requestId, api.access.username);
    if (rateLimitError) return rateLimitError;

    const parsed = updateTaskSchema.safeParse(await request.json());
    if (!parsed.success) {
      return apiJsonError("Datos de tarea invalidos.", 400, api.requestId);
    }

    const { taskId } = await context.params;
    const task = await updateMyTask(api.bootstrap.authUserId, taskId, parsed.data, api.access.username);
    return jsonNoStore({ task });
  } catch (error) {
    return handleApiError(error, "No se pudo actualizar la tarea.");
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ taskId: string }> }) {
  try {
    const api = await getPersonalApiContext(request);
    if (api.error || !api.access || !api.bootstrap) return api.error;

    const rateLimitError = enforcePersonalWriteRateLimit(request, api.requestId, api.access.username);
    if (rateLimitError) return rateLimitError;

    const { taskId } = await context.params;
    await archiveMyTask(api.bootstrap.authUserId, taskId, api.access.username);
    return jsonNoStore({ ok: true });
  } catch (error) {
    return handleApiError(error, "No se pudo archivar la tarea.");
  }
}
