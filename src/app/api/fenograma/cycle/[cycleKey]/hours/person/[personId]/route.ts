import { type NextRequest, NextResponse } from "next/server";

import { handleApiError } from "@/lib/api-error";
import { requireAuth } from "@/lib/api-auth";
import { getCycleLaborPersonDetailByCycleKey } from "@/lib/fenograma-core";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ cycleKey: string; personId: string }> },
) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  try {
    const { cycleKey, personId } = await context.params;
    const data = await getCycleLaborPersonDetailByCycleKey(
      decodeURIComponent(cycleKey),
      decodeURIComponent(personId),
    );

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "private, max-age=60, stale-while-revalidate=300",
      },
    });
  } catch (error) {
    return handleApiError(error, "No se pudo cargar la ficha de horas del personal.");
  }
}

