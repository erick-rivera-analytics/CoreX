import { NextRequest, NextResponse } from "next/server";

import { handleApiError } from "@/lib/api-error";
import { requireAuth } from "@/lib/api-auth";
import { getProductividadDashboardData, normalizeProductividadFilters } from "@/lib/productividad";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  try {
    const filters = normalizeProductividadFilters({
      year: request.nextUrl.searchParams.get("year") ?? undefined,
      month: request.nextUrl.searchParams.get("month") ?? undefined,
      spType: request.nextUrl.searchParams.get("spType") ?? undefined,
      variety: request.nextUrl.searchParams.get("variety") ?? undefined,
      area: request.nextUrl.searchParams.get("area") ?? undefined,
      status: request.nextUrl.searchParams.get("status") ?? undefined,
    });

    const data = await getProductividadDashboardData(filters);

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "private, max-age=30, stale-while-revalidate=120",
      },
    });
  } catch (error) {
    return handleApiError(error, "No se pudo cargar el dashboard de productividad.");
  }
}

