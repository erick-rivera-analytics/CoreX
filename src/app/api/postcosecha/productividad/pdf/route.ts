import { type NextRequest } from "next/server";

import { requireAuth } from "@/lib/api-auth";
import { handleApiError } from "@/lib/api-error";
import { logEvent } from "@/lib/logger";
import {
  getPostharvestProductivityDashboardData,
  normalizePostharvestProductivityFilters,
} from "@/lib/postcosecha-productividad";
import { generatePostharvestProductivityFallbackPdf } from "@/lib/postcosecha-productividad-pdf-fallback";
import { buildPostharvestProductivityPdfDocument } from "@/lib/postcosecha-productividad-pdf-tex";
import type { PostharvestProductivityFilters } from "@/lib/postcosecha-productividad-contract";
import { getRequestId } from "@/lib/request-id";
import {
  generateCanonicalPdf,
  pdfBufferToResponse,
  PdfCompileError,
} from "@pdf-canon/scripts/generate_pdf_service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PdfRequestBody = {
  filters?: Partial<PostharvestProductivityFilters>;
};

function shouldUseFallback(buildLog: string) {
  const normalized = buildLog.toLowerCase();
  return (
    normalized.includes("pdflatex") && normalized.includes("no se reconoce") ||
    normalized.includes("tectonic") && normalized.includes("no se reconoce") ||
    normalized.includes("not found") ||
    normalized.includes("is not recognized")
  );
}

export async function POST(request: NextRequest) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  let parsedBody: PdfRequestBody = {};

  try {
    parsedBody = (await request.json()) as PdfRequestBody;
    const filters = normalizePostharvestProductivityFilters(parsedBody.filters ?? {});
    const data = await getPostharvestProductivityDashboardData(filters);
    const { dataTexContent, assets } = await buildPostharvestProductivityPdfDocument(data, new Date());

    const { pdf } = await generateCanonicalPdf({
      templateName: "postcosecha_productividad",
      dataTexContent,
      assets,
      jobId: crypto.randomUUID(),
      passes: 2,
    });

    const filename = `reporte_productividad_postcosecha_${new Date().toISOString().slice(0, 10)}.pdf`;
    return pdfBufferToResponse(pdf, filename);
  } catch (error) {
    const requestId = getRequestId(request);
    if (error instanceof PdfCompileError) {
      logEvent("error", "pdf.postharvest_productivity.latex_compile_error", {
        requestId,
        buildLogTail: error.buildLog.slice(-1500),
        jobId: error.jobId,
      });
      if (shouldUseFallback(error.buildLog)) {
        const filters = normalizePostharvestProductivityFilters(parsedBody.filters ?? {});
        const data = await getPostharvestProductivityDashboardData(filters);
        const pdf = await generatePostharvestProductivityFallbackPdf(data);
        const filename = `reporte_productividad_postcosecha_${new Date().toISOString().slice(0, 10)}.pdf`;
        return pdfBufferToResponse(pdf, filename);
      }
      return Response.json(
        { message: "Error al compilar el PDF de productividad de postcosecha." },
        { status: 500 },
      );
    }

    logEvent("error", "pdf.postharvest_productivity.unexpected_error", {
      requestId,
      message: error instanceof Error ? error.message : String(error),
    });
    return handleApiError(error, "No se pudo generar el PDF de productividad de postcosecha.");
  }
}
