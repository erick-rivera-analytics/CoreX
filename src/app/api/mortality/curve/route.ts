import { NextRequest, NextResponse } from "next/server";

import { handleApiError } from "@/lib/api-error";
import { requireAuth } from "@/lib/api-auth";
import { getAggregatedMortalityCurve, normalizeMortalityFilters } from "@/lib/mortality";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  try {
    const filters = normalizeMortalityFilters({
      block: request.nextUrl.searchParams.get("block") ?? undefined,
      status: request.nextUrl.searchParams.get("status") ?? undefined,
    });
    const data = await getAggregatedMortalityCurve(filters);

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "private, max-age=30, stale-while-revalidate=120",
      },
    });
  } catch (error) {
    return handleApiError(error, "No se pudo cargar la curva agregada de mortandad.");
  }
}

