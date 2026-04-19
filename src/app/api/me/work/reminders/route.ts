import { type NextRequest } from "next/server";

import { apiJsonError, handleApiError } from "@/lib/api-error";
import { createReminderSchema, reminderFiltersSchema } from "@/lib/personal-workspace-schemas";
import { createMyReminder, listMyReminders } from "@/lib/my-work-repository";
import { enforcePersonalWriteRateLimit, getPersonalApiContext, jsonNoStore } from "@/app/api/me/_shared";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const context = await getPersonalApiContext(request);
    if (context.error || !context.bootstrap) return context.error;

    const parsed = reminderFiltersSchema.safeParse({
      statusCode: request.nextUrl.searchParams.get("statusCode") || undefined,
      limit: request.nextUrl.searchParams.get("limit") || undefined,
    });
    if (!parsed.success) {
      return apiJsonError("Filtros invalidos.", 400, context.requestId);
    }

    const reminders = await listMyReminders(context.bootstrap.authUserId, parsed.data);
    return jsonNoStore({ reminders });
  } catch (error) {
    return handleApiError(error, "No se pudieron cargar los recordatorios.");
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await getPersonalApiContext(request);
    if (context.error || !context.access || !context.bootstrap) return context.error;

    const rateLimitError = enforcePersonalWriteRateLimit(request, context.requestId, context.access.username);
    if (rateLimitError) return rateLimitError;

    const parsed = createReminderSchema.safeParse(await request.json());
    if (!parsed.success) {
      return apiJsonError("Datos del recordatorio invalidos.", 400, context.requestId);
    }

    const reminder = await createMyReminder(context.bootstrap.authUserId, parsed.data, context.access.username);
    return jsonNoStore({ reminder }, 201);
  } catch (error) {
    return handleApiError(error, "No se pudo crear el recordatorio.");
  }
}
