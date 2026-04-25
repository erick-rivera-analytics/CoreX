import { type NextRequest, NextResponse } from "next/server";

import { handleApiError } from "@/lib/api-error";
import { requireAuth } from "@/lib/api-auth";
import { getCycleLaborHoursByCycleKey } from "@/lib/fenograma-core";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ cycleKey: string }> },
) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  try {
    const { cycleKey } = await context.params;
    const data = await getCycleLaborHoursByCycleKey(decodeURIComponent(cycleKey));

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "private, max-age=30, stale-while-revalidate=120",
      },
    });
  } catch (error) {
    return handleApiError(error, "No se pudo cargar el detalle de horas del ciclo.");
  }
}

