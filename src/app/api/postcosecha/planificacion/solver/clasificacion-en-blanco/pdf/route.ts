import { type NextRequest } from "next/server";

import { requireAuth } from "@/lib/api-auth";
import { handleApiError } from "@/lib/api-error";
import { logEvent } from "@/lib/logger";
import { getRequestId } from "@/lib/request-id";
import { buildOrdenTrabajoDataTex } from "@/lib/postcosecha-clasificacion-pdf-builder";
import type { PoscosechaClasificacionModeResult } from "@/lib/postcosecha-clasificacion-en-blanco-types";
import {
  generateCanonicalPdf,
  pdfBufferToResponse,
  PdfCompileError,
  PdfTemplateNotFoundError,
} from "@pdf-canon/scripts/generate_pdf_service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PdfRequestBody = {
  runs: PoscosechaClasificacionModeResult[];
};

export async function POST(request: NextRequest) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  try {
    const body = (await request.json()) as PdfRequestBody;

    if (!Array.isArray(body.runs) || body.runs.length === 0) {
      return Response.json({ message: "Se requiere al menos una corrida para exportar." }, { status: 400 });
    }

    const exportDate = new Date();
    const dataTexContent = buildOrdenTrabajoDataTex(body.runs, exportDate);

    const { pdf } = await generateCanonicalPdf({
      templateName: "orden_trabajo_clasificacion",
      dataTexContent,
      jobId: crypto.randomUUID(),
    });

    const pad = (n: number) => String(n).padStart(2, "0");
    const datestamp = [
      exportDate.getFullYear(),
      pad(exportDate.getMonth() + 1),
      pad(exportDate.getDate()),
      "_",
      pad(exportDate.getHours()),
      pad(exportDate.getMinutes()),
      pad(exportDate.getSeconds()),
    ].join("");

    return pdfBufferToResponse(pdf, `orden_trabajo_clasificacion_en_blanco_${datestamp}.pdf`);
  } catch (error) {
    if (error instanceof PdfCompileError) {
      logEvent("error", "pdf.clasificacion.latex_compile_error", {
        requestId: getRequestId(request),
        buildLogTail: error.buildLog.slice(-1000),
        jobId: error.jobId,
      });
      return Response.json({ message: "Error al compilar el PDF. Contacte al administrador." }, { status: 500 });
    }
    if (error instanceof PdfTemplateNotFoundError) {
      return Response.json({ message: error.message }, { status: 500 });
    }
    return handleApiError(error, "No se pudo generar el PDF de Clasificacion en blanco.");
  }
}
