import { NextRequest, NextResponse } from "next/server";

import { handleApiError } from "@/lib/api-error";
import { requireAuth } from "@/lib/api-auth";
import {
  getPostharvestProductivityDashboardData,
  normalizePostharvestProductivityFilters,
} from "@/lib/postcosecha-productividad";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  try {
    const filters = normalizePostharvestProductivityFilters({
      year: request.nextUrl.searchParams.get("year") ?? undefined,
      month: request.nextUrl.searchParams.get("month") ?? undefined,
      area: request.nextUrl.searchParams.get("area") ?? undefined,
      pathPost: request.nextUrl.searchParams.get("pathPost") ?? undefined,
      finalDestination: request.nextUrl.searchParams.get("finalDestination") ?? undefined,
      variety: request.nextUrl.searchParams.get("variety") ?? undefined,
      dateFrom: request.nextUrl.searchParams.get("dateFrom") ?? undefined,
      dateTo: request.nextUrl.searchParams.get("dateTo") ?? undefined,
    });

    const data = await getPostharvestProductivityDashboardData(filters);

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "private, max-age=30, stale-while-revalidate=120",
      },
    });
  } catch (error) {
    return handleApiError(error, "No se pudo cargar el dashboard de productividad de postcosecha.");
  }
}
