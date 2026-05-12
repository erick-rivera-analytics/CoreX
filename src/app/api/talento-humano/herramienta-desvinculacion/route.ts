import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/api-auth";
import { handleApiError } from "@/lib/api-error";
import {
  getDesvinculacionToolData,
  normalizeDesvinculacionFilters,
} from "@/lib/talento-humano-herramienta-desvinculacion";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  try {
    const sp = request.nextUrl.searchParams;
    const { filters, weeks } = await normalizeDesvinculacionFilters({
      weekId: sp.get("weekId") ?? undefined,
      area: sp.get("area") ?? undefined,
      jobClassification: sp.get("jobClassification") ?? undefined,
      q: sp.get("q") ?? undefined,
    });

    const data = await getDesvinculacionToolData(filters, weeks);

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "private, max-age=60, stale-while-revalidate=120",
      },
    });
  } catch (error) {
    return handleApiError(error, "No se pudo cargar la herramienta de desvinculación.");
  }
}
