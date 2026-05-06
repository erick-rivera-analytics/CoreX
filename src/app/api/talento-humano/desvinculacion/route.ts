import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/api-auth";
import { handleApiError } from "@/lib/api-error";
import { getDesvinculacionData, normalizeTalentoExitFilters } from "@/lib/talento-humano";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  try {
    const searchParams = request.nextUrl.searchParams;
    const filters = normalizeTalentoExitFilters({
      year: searchParams.get("year") ?? undefined,
      month: searchParams.get("month") ?? undefined,
      associatedWorker: searchParams.get("associatedWorker") ?? undefined,
      exitReason: searchParams.get("exitReason") ?? undefined,
      resignationReason: searchParams.get("resignationReason") ?? undefined,
      resignationCategory: searchParams.get("resignationCategory") ?? undefined,
      resignationClassification: searchParams.get("resignationClassification") ?? undefined,
      complianceBucket: searchParams.get("complianceBucket") ?? undefined,
      tenureBucket: searchParams.get("tenureBucket") ?? undefined,
    });

    const data = await getDesvinculacionData(filters);

    return NextResponse.json(data, {
      headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=120" },
    });
  } catch (error) {
    return handleApiError(error, "No se pudo cargar desvinculacion personal.");
  }
}
