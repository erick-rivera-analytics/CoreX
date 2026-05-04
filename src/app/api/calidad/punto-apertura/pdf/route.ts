import { type NextRequest } from "next/server";

import { requireAuth } from "@/lib/api-auth";
import { handleApiError } from "@/lib/api-error";
import {
  getPuntoAperturaDashboardData,
  normalizePuntoAperturaFilters,
  type PuntoAperturaFilters,
} from "@/lib/calidad-punto-apertura";
import { buildPuntoAperturaDataTex } from "@/lib/calidad-punto-apertura-pdf-tex";
import {
  generateCanonicalPdf,
  pdfBufferToResponse,
  PdfCompileError,
} from "@pdf-canon/scripts/generate_pdf_service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PdfRequestBody = {
  filters?: Partial<PuntoAperturaFilters>;
};

export async function POST(request: NextRequest) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  try {
    const body = (await request.json()) as PdfRequestBody;
    const filters = normalizePuntoAperturaFilters(body.filters ?? {});
    const data = await getPuntoAperturaDashboardData(filters);
    const { pdf } = await generateCanonicalPdf({
      templateName: "calidad_punto_apertura",
      dataTexContent: buildPuntoAperturaDataTex(data, new Date()),
      jobId: crypto.randomUUID(),
      passes: 2,
    });

    const filename =
      filters.isoWeek !== "all"
        ? `reporte_gerencial_punto_apertura_semana_${filters.isoWeek}.pdf`
        : "reporte_gerencial_punto_apertura.pdf";

    return pdfBufferToResponse(pdf, filename);
  } catch (error) {
    if (error instanceof PdfCompileError) {
      console.error("[pdf/punto-apertura] LaTeX error:", error.buildLog.slice(-1500));
      return Response.json(
        { message: "Error al compilar el PDF de punto de apertura." },
        { status: 500 },
      );
    }
    console.error("[pdf/punto-apertura] Unexpected error:", error);
    return handleApiError(error, "No se pudo generar el PDF de punto de apertura.");
  }
}
