import { NextRequest, NextResponse } from "next/server";

import { handleApiError } from "@/lib/api-error";
import { requireAuth } from "@/lib/api-auth";
import { getFenogramaDashboardData, normalizeFenogramaFilters } from "@/lib/fenograma-core";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  try {
    const filters = normalizeFenogramaFilters({
      includeActive: request.nextUrl.searchParams.get("includeActive") ?? undefined,
      includePlanned: request.nextUrl.searchParams.get("includePlanned") ?? undefined,
      includeHistory: request.nextUrl.searchParams.get("includeHistory") ?? undefined,
      area: request.nextUrl.searchParams.get("area") ?? undefined,
      variety: request.nextUrl.searchParams.get("variety") ?? undefined,
      spType: request.nextUrl.searchParams.get("spType") ?? undefined,
      startWeek: request.nextUrl.searchParams.get("startWeek") ?? undefined,
      endWeek: request.nextUrl.searchParams.get("endWeek") ?? undefined,
    });
    const data = await getFenogramaDashboardData(filters);

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "private, max-age=30, stale-while-revalidate=120",
      },
    });
  } catch (error) {
    return handleApiError(error, "No se pudo cargar el fenograma.");
  }
}

