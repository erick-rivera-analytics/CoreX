import { NextRequest, NextResponse } from "next/server";

import { handleApiError } from "@/lib/api-error";
import { requireAuth } from "@/lib/api-auth";
import { decodeMultiSelectValue } from "@/lib/multi-select";
import { loadNodeDetail, normalizeBalanzasFilters } from "@/lib/postcosecha-balanzas";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ nodeKey: string }> },
) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  try {
    const { nodeKey } = await params;
    const p = request.nextUrl.searchParams;
    const filters = normalizeBalanzasFilters({
      weekValue: p.get("weekValue") ?? undefined,
      month: p.get("month") ?? undefined,
      year: p.get("year") ?? undefined,
      dateFrom: p.get("dateFrom") ?? undefined,
      dateTo: p.get("dateTo") ?? undefined,
      farm: p.get("farm") ?? undefined,
    });
    const localFilters = {
      destinations: decodeMultiSelectValue(p.get("destinations")),
      grades: decodeMultiSelectValue(p.get("grades")),
      gradeGroups: decodeMultiSelectValue(p.get("gradeGroups")),
      years: decodeMultiSelectValue(p.get("detailYears")),
      months: decodeMultiSelectValue(p.get("detailMonths")),
      weeks: decodeMultiSelectValue(p.get("detailWeeks")),
      dates: decodeMultiSelectValue(p.get("detailDates")),
    };
    const data = await loadNodeDetail(nodeKey, filters, localFilters);
    return NextResponse.json(data, {
      headers: { "Cache-Control": "private, max-age=15, stale-while-revalidate=60" },
    });
  } catch (error) {
    return handleApiError(error, "No se pudo cargar el detalle del nodo.");
  }
}
