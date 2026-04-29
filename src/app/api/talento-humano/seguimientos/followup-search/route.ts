import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/api-auth";
import { apiJsonError, handleApiError } from "@/lib/api-error";
import { loadScheduledFollowups } from "@/lib/talento-humano-seguimientos-schedule";
import { followupFiltersSchema } from "@/lib/talento-humano-seguimientos-schemas";
import type { EmployeeFollowupFilters } from "@/modules/talento-humano/seguimientos/server/types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  try {
    const searchParams = request.nextUrl.searchParams;
    const asOfDate = searchParams.get("asOfDate")?.trim() || new Date().toISOString().slice(0, 10);

    const parsed = followupFiltersSchema.safeParse({
      asOfDate,
      personSearch: searchParams.get("q")?.trim() || undefined,
      associatedWorker: searchParams.get("associatedWorker")?.trim() || undefined,
      area: searchParams.get("area")?.trim() || undefined,
      route: searchParams.get("route")?.trim() || undefined,
      status: searchParams.get("status")?.trim() || "all",
      year: searchParams.get("year")?.trim() || undefined,
      month: searchParams.get("month")?.trim() || undefined,
      dateFrom: searchParams.get("dateFrom")?.trim() || undefined,
      dateTo: searchParams.get("dateTo")?.trim() || undefined,
      uniqueFollowUpCode: searchParams.get("uniqueFollowUpCode")?.trim() || undefined,
    });

    if (!parsed.success) {
      return apiJsonError("Filtros de seguimiento invalidos.", 400);
    }

    const filters = parsed.data as EmployeeFollowupFilters;

    const rows = await loadScheduledFollowups(filters);

    return NextResponse.json({ rows }, {
      headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" },
    });
  } catch (error) {
    return handleApiError(error, "No se pudo buscar seguimientos programados.");
  }
}
