import { type NextRequest } from "next/server";

import { apiJsonError, handleApiError } from "@/lib/api-error";
import { calendarFiltersSchema } from "@/lib/personal-workspace-schemas";
import { listMyCalendarItems } from "@/lib/my-work-repository";
import { getPersonalApiContext, jsonNoStore } from "@/app/api/me/_shared";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const context = await getPersonalApiContext(request);
    if (context.error || !context.bootstrap) return context.error;

    const parsed = calendarFiltersSchema.safeParse({
      spaceId: request.nextUrl.searchParams.get("spaceId") || undefined,
      dateFrom: request.nextUrl.searchParams.get("dateFrom") || undefined,
      dateTo: request.nextUrl.searchParams.get("dateTo") || undefined,
    });
    if (!parsed.success) {
      return apiJsonError("Filtros invalidos.", 400, context.requestId);
    }

    const items = await listMyCalendarItems(context.bootstrap.authUserId, parsed.data);
    return jsonNoStore({ items });
  } catch (error) {
    return handleApiError(error, "No se pudo cargar el calendario personal.");
  }
}
