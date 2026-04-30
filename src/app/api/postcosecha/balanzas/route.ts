import { NextRequest, NextResponse } from "next/server";

import { handleApiError } from "@/lib/api-error";
import { requireAuth } from "@/lib/api-auth";
import { getBalanzasDashboardData, normalizeBalanzasFilters } from "@/lib/postcosecha-balanzas";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  try {
    const p = request.nextUrl.searchParams;
    const filters = normalizeBalanzasFilters({
      weekValue: p.get("weekValue") ?? undefined,
      month: p.get("month") ?? undefined,
      year: p.get("year") ?? undefined,
      dateFrom: p.get("dateFrom") ?? undefined,
      dateTo: p.get("dateTo") ?? undefined,
      farm: p.get("farm") ?? undefined,
    });
    const data = await getBalanzasDashboardData(filters);
    return NextResponse.json(data, {
      headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=120" },
    });
  } catch (error) {
    return handleApiError(error, "No se pudo cargar Indicadores Balanzas.");
  }
}
