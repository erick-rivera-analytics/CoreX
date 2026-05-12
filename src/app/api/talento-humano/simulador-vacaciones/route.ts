import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/api-auth";
import { handleApiError } from "@/lib/api-error";
import {
  getVacationSimulatorData,
  normalizeVacationFilters,
} from "@/lib/talento-humano-vacaciones";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  try {
    const sp = request.nextUrl.searchParams;
    const filters = normalizeVacationFilters({
      corteDate: sp.get("corteDate") ?? undefined,
      area: sp.get("area") ?? undefined,
      jobClassification: sp.get("jobClassification") ?? undefined,
      associatedWorker: sp.get("associatedWorker") ?? undefined,
      q: sp.get("q") ?? undefined,
    });

    const data = await getVacationSimulatorData(filters);

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "private, max-age=60, stale-while-revalidate=120",
      },
    });
  } catch (error) {
    return handleApiError(error, "No se pudo cargar el simulador de vacaciones.");
  }
}
