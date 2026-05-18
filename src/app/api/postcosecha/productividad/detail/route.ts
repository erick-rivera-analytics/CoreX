import { NextRequest, NextResponse } from "next/server";

import { handleApiError } from "@/lib/api-error";
import { requireAuth } from "@/lib/api-auth";
import {
  getPostharvestProductivityActivityDetailData,
  normalizePostharvestProductivityActivityDetailFilters,
} from "@/lib/postcosecha-productividad";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  try {
    const filters = normalizePostharvestProductivityActivityDetailFilters({
      year: request.nextUrl.searchParams.get("year") ?? undefined,
      month: request.nextUrl.searchParams.get("month") ?? undefined,
      area: request.nextUrl.searchParams.get("area") ?? undefined,
      pathPost: request.nextUrl.searchParams.get("pathPost") ?? undefined,
      finalDestination: request.nextUrl.searchParams.get("finalDestination") ?? undefined,
      variety: request.nextUrl.searchParams.get("variety") ?? undefined,
      dateFrom: request.nextUrl.searchParams.get("dateFrom") ?? undefined,
      dateTo: request.nextUrl.searchParams.get("dateTo") ?? undefined,
      yearScope: request.nextUrl.searchParams.get("yearScope") ?? undefined,
      monthScope: request.nextUrl.searchParams.get("monthScope") ?? undefined,
      isoWeekId: request.nextUrl.searchParams.get("isoWeekId") ?? undefined,
      areaScope: request.nextUrl.searchParams.get("areaScope") ?? undefined,
      pathPostScope: request.nextUrl.searchParams.get("pathPostScope") ?? undefined,
      finalDestinationScope: request.nextUrl.searchParams.get("finalDestinationScope") ?? undefined,
      varietyScope: request.nextUrl.searchParams.get("varietyScope") ?? undefined,
    });

    const data = await getPostharvestProductivityActivityDetailData(filters);

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    return handleApiError(error, "No se pudo cargar el detalle de productividad de postcosecha.");
  }
}
