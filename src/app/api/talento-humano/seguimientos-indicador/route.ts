import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/api-auth";
import { handleApiError } from "@/lib/api-error";
import { loadFollowupIndicatorData, type FollowupIndicatorFilters } from "@/lib/talento-humano-seguimientos-indicador";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  try {
    const sp = request.nextUrl.searchParams;
    const filters: FollowupIndicatorFilters = {
      year: sp.get("year") ?? "",
      month: sp.get("month") ?? "",
      area: sp.get("area") ?? "",
      worker: sp.get("worker") ?? "",
      route: sp.get("route") ?? "",
    };

    const data = await loadFollowupIndicatorData(filters);

    return NextResponse.json(data, {
      headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=120" },
    });
  } catch (error) {
    return handleApiError(error, "No se pudo cargar el indicador de seguimientos.");
  }
}
