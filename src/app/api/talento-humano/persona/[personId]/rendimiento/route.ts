import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/api-auth";
import { handleApiError } from "@/lib/api-error";
import { getPersonRendimiento } from "@/lib/talento-humano";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ personId: string }> };

function jsonError(message: string, status: number) {
  return NextResponse.json({ message, error: message }, { status });
}

/**
 * Rendimiento de la persona SIN requerir cycleKey.
 *
 * Devuelve las horas/unidades agregadas de los últimos N ciclos donde la
 * persona tuvo registros productivos, agrupado por (ciclo, actividad).
 *
 * Query params:
 *   - cycles: número opcional (1-50). Default 8. Limita los ciclos más recientes.
 *
 * Usado por la tab "Rendimiento" de `PersonProfileDialog` cuando
 * `sourceContext.module === "talento"`.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  try {
    const { personId } = await context.params;
    if (!personId) {
      return jsonError("personId requerido.", 400);
    }

    const url = new URL(request.url);
    const cyclesParam = url.searchParams.get("cycles");
    const cyclesLimit = cyclesParam ? Number(cyclesParam) : undefined;

    const payload = await getPersonRendimiento(decodeURIComponent(personId), cyclesLimit);

    return NextResponse.json(payload, {
      headers: { "Cache-Control": "private, max-age=300, stale-while-revalidate=600" },
    });
  } catch (error) {
    return handleApiError(error, "No se pudo cargar el rendimiento de la persona.");
  }
}
