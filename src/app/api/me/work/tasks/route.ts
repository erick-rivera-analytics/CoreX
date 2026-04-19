import { type NextRequest } from "next/server";

import { apiJsonError, handleApiError } from "@/lib/api-error";
import { createTaskSchema, taskFiltersSchema } from "@/lib/personal-workspace-schemas";
import { createMyTask, listMyTasks } from "@/lib/my-work-repository";
import { enforcePersonalWriteRateLimit, getPersonalApiContext, jsonNoStore } from "@/app/api/me/_shared";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const context = await getPersonalApiContext(request);
    if (context.error || !context.bootstrap) return context.error;

    const parsed = taskFiltersSchema.safeParse({
      spaceId: request.nextUrl.searchParams.get("spaceId") || undefined,
      statusCode: request.nextUrl.searchParams.get("statusCode") || undefined,
      priorityCode: request.nextUrl.searchParams.get("priorityCode") || undefined,
      dateFrom: request.nextUrl.searchParams.get("dateFrom") || undefined,
      dateTo: request.nextUrl.searchParams.get("dateTo") || undefined,
      search: request.nextUrl.searchParams.get("search") || undefined,
    });
    if (!parsed.success) {
      return apiJsonError("Filtros invalidos.", 400, context.requestId);
    }

    const tasks = await listMyTasks(context.bootstrap.authUserId, parsed.data);
    return jsonNoStore({ tasks });
  } catch (error) {
    return handleApiError(error, "No se pudieron cargar las tareas.");
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await getPersonalApiContext(request);
    if (context.error || !context.access || !context.bootstrap) return context.error;

    const rateLimitError = enforcePersonalWriteRateLimit(request, context.requestId, context.access.username);
    if (rateLimitError) return rateLimitError;

    const parsed = createTaskSchema.safeParse(await request.json());
    if (!parsed.success) {
      return apiJsonError("Datos de tarea invalidos.", 400, context.requestId);
    }

    const task = await createMyTask(context.bootstrap.authUserId, parsed.data, context.access.username);
    return jsonNoStore({ task }, 201);
  } catch (error) {
    return handleApiError(error, "No se pudo crear la tarea.");
  }
}
