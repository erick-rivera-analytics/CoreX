import { type NextRequest, NextResponse } from "next/server";

import { handleApiError } from "@/lib/api-error";
import { requireAuth } from "@/lib/api-auth";
import { getValveProfileByCycleAndValve } from "@/lib/fenograma-core";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ cycleKey: string; valveId: string }> },
) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  try {
    const { cycleKey, valveId } = await context.params;
    const data = await getValveProfileByCycleAndValve(
      decodeURIComponent(cycleKey),
      decodeURIComponent(valveId),
    );

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "private, max-age=60, stale-while-revalidate=300",
      },
    });
  } catch (error) {
    return handleApiError(error, "No se pudo cargar el detalle de la valvula.");
  }
}

