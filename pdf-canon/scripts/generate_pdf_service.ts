/**
 * generate_pdf_service.ts
 *
 * Servicio de generación PDF canónico para uso desde la API de Next.js.
 * Ejecuta pdflatex en un directorio temporal aislado y retorna el buffer del PDF.
 *
 * Uso desde una API route:
 *   import { generateCanonicalPdf, pdfBufferToResponse } from "@/pdf-canon/scripts/generate_pdf_service";
 */

import { exec } from "node:child_process";
import { mkdtemp, writeFile, readFile, rm, mkdir, copyFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";

const execAsync = promisify(exec);

// ── Constantes ──────────────────────────────────────────────────────────────

const PDF_CANON_ROOT = resolve(process.cwd(), "pdf-canon");
const COMPILE_TIMEOUT_MS = 120_000;

// ── Tipos ────────────────────────────────────────────────────────────────────

export type CanonTemplateKey =
  | "informe_ejecutivo"
  | "informe_estadistico"
  | "reporte_tecnico"
  | "plan_trabajo"
  | "plan_tecnico"
  | "solicitud_formal"
  | "memorando"
  | "acta_minuta"
  | "ficha_resumen"
  | "anexo_tecnico"
  | "orden_trabajo_clasificacion"
  | "tthh_agenda_seguimientos";

export type GeneratePdfPayload = {
  /**
   * Nombre del template en pdf-canon/templates/ (sin extensión).
   */
  templateName: CanonTemplateKey;
  /**
   * Contenido LaTeX completo del archivo _data.tex.
   * Debe definir \SetDocTitle, \SetDocCode, \SetDocArea, \SetDocAuthor, \SetDocDate
   * y cualquier macro específica del documento.
   *
   * Ejemplo mínimo:
   *   \SetDocTitle{Mi Informe}
   *   \SetDocCode{INF-OPS-001}
   *   \SetDocArea{Operaciones}
   *   \SetDocAuthor{Juan Pérez}
   *   \SetDocDate{2026-04-22}
   */
  dataTexContent: string;
  /**
   * Identificador único del job. Recomendado: crypto.randomUUID().
   */
  jobId: string;
  /**
   * Número de pasadas de pdflatex.
   * @default 2 — necesario para referencias cruzadas y longtable
   */
  passes?: 1 | 2;
};

export type GeneratePdfResult = {
  pdf: Buffer;
  sizeBytes: number;
  durationMs: number;
  buildLog: string;
};

// ── Errores tipados ──────────────────────────────────────────────────────────

export class PdfCompileError extends Error {
  constructor(
    message: string,
    public readonly buildLog: string,
    public readonly jobId: string,
  ) {
    super(message);
    this.name = "PdfCompileError";
  }
}

export class PdfTemplateNotFoundError extends Error {
  constructor(templateName: string) {
    super(`Template not found: ${templateName}`);
    this.name = "PdfTemplateNotFoundError";
  }
}

// ── Función principal ────────────────────────────────────────────────────────

/**
 * Genera un PDF canónico a partir de un template y datos LaTeX.
 *
 * Flujo:
 * 1. Crea directorio temporal aislado en /tmp/canon_<jobId>/
 * 2. Copia el template y el canon.cls al directorio temporal
 * 3. Escribe _data.tex con dataTexContent
 * 4. Ejecuta pdflatex (2 pasadas por defecto)
 * 5. Lee el PDF y lo retorna como Buffer
 * 6. Limpia el directorio temporal (siempre, incluso en error)
 */
export async function generateCanonicalPdf(
  payload: GeneratePdfPayload,
): Promise<GeneratePdfResult> {
  const { templateName, dataTexContent, jobId, passes = 2 } = payload;

  const templatePath = resolve(PDF_CANON_ROOT, "templates", `${templateName}.tex`);

  try {
    await readFile(templatePath);
  } catch {
    throw new PdfTemplateNotFoundError(templateName);
  }

  const workDir = await mkdtemp(join(tmpdir(), `canon_${jobId}_`));

  try {
    const startMs = Date.now();

    // Crear estructura base en el directorio de trabajo
    await mkdir(join(workDir, "base"), { recursive: true });
    await mkdir(join(workDir, "assets"), { recursive: true });

    // Copiar canon.cls y canon_variables.tex
    await copyFile(
      resolve(PDF_CANON_ROOT, "base", "canon.cls"),
      join(workDir, "base", "canon.cls"),
    );
    await copyFile(
      resolve(PDF_CANON_ROOT, "base", "canon_variables.tex"),
      join(workDir, "base", "canon_variables.tex"),
    );

    // Copiar logo si existe
    await copyFile(
      resolve(PDF_CANON_ROOT, "assets", "logo.pdf"),
      join(workDir, "assets", "logo.pdf"),
    ).catch(() => {/* logo ausente es aceptable */});

    // Escribir _data.tex
    await writeFile(join(workDir, "_data.tex"), dataTexContent, "utf-8");

    // Copiar template y ajustar rutas relativas
    const templateContent = await readFile(templatePath, "utf-8");
    const adjustedTemplate = templateContent
      .replace(/\{\.\.\/base\/canon\}/g, "{./base/canon}")
      .replace(/\{\.\.\/base\/canon_variables\}/g, "{./base/canon_variables}")
      .replace(/\\input\{_data\}/g, "\\input{_data}");

    await writeFile(join(workDir, "main.tex"), adjustedTemplate, "utf-8");

    // Compilar
    let buildLog = "";
    for (let pass = 1; pass <= passes; pass++) {
      const result = await runPdfLatex(workDir, pass, jobId);
      buildLog = result.log;
    }

    // Leer PDF resultante
    const pdfPath = join(workDir, "main.pdf");
    let pdfBuffer: Buffer;
    try {
      pdfBuffer = await readFile(pdfPath);
    } catch {
      throw new PdfCompileError(
        `pdflatex did not produce a PDF (job: ${jobId})`,
        buildLog,
        jobId,
      );
    }

    return {
      pdf: pdfBuffer,
      sizeBytes: pdfBuffer.length,
      durationMs: Date.now() - startMs,
      buildLog,
    };
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

// ── Helpers internos ─────────────────────────────────────────────────────────

async function runPdfLatex(
  workDir: string,
  pass: number,
  jobId: string,
): Promise<{ log: string }> {
  const pdflatexBin = process.env["PDFLATEX_BIN"] ?? "pdflatex";

  const cmd = [
    pdflatexBin,
    "-interaction=nonstopmode",
    "-halt-on-error",
    `-output-directory="${workDir}"`,
    `"${join(workDir, "main.tex")}"`,
  ].join(" ");

  try {
    const { stdout, stderr } = await execAsync(cmd, {
      cwd: workDir,
      timeout: COMPILE_TIMEOUT_MS,
    });
    return { log: stdout + stderr };
  } catch (error: unknown) {
    const execError = error as { stdout?: string; stderr?: string; message?: string };
    const log = [execError.stdout ?? "", execError.stderr ?? ""].join("\n");

    // Segunda pasada puede retornar exit code != 0 pero haber generado el PDF
    if (pass === 2) {
      return { log };
    }

    throw new PdfCompileError(
      `pdflatex failed on pass ${pass} (job: ${jobId}): ${execError.message ?? "unknown"}`,
      log,
      jobId,
    );
  }
}

// ── Helper para Next.js App Router ───────────────────────────────────────────

/**
 * Convierte un Buffer de PDF en una Response para retornar desde una API route.
 *
 * Ejemplo en src/app/api/reportes/pdf/route.ts:
 *
 *   const { pdf } = await generateCanonicalPdf({ templateName, dataTexContent, jobId });
 *   return pdfBufferToResponse(pdf, "reporte-semana-17.pdf");
 */
export function pdfBufferToResponse(
  pdf: Buffer,
  filename = "documento.pdf",
): Response {
  return new Response(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(pdf.length),
      "Cache-Control": "no-store",
    },
  });
}
