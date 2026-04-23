/**
 * GET /api/postcosecha/balanzas/schema
 *
 * Endpoint de diagnóstico (internal-dev-only).
 * Devuelve el schema detectado por `loadBalanzasViewSchema` para cada
 * nodo del proceso — columnas reales de la BD, aliases resueltos y
 * cuáles aliases quedaron en null.
 *
 * Útil cuando las vistas gld.mv_camp_ind_bal_* son modificadas y el
 * sistema deja de detectar source/target/ratio automáticamente.
 *
 * Ejemplo de uso:
 *   GET /api/postcosecha/balanzas/schema?metric=peso
 */
import { NextRequest, NextResponse } from "next/server";

import { handleApiError } from "@/lib/api-error";
import { requireAuth } from "@/lib/api-auth";
import { getBalanzasDiagnosticSchema } from "@/lib/postcosecha-balanzas";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  try {
    const metric = request.nextUrl.searchParams.get("metric") === "tallos" ? "tallos" : "peso";
    const data = await getBalanzasDiagnosticSchema(metric);
    return NextResponse.json(data);
  } catch (error) {
    return handleApiError(error, "No se pudo obtener el schema de Balanzas.");
  }
}
