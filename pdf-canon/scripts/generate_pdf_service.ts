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
import { mkdtemp, writeFile, readFile, rm, mkdir, copyFile, access } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { homedir, tmpdir } from "node:os";
import { promisify } from "node:util";

const execAsync = promisify(exec);

// ── Constantes ──────────────────────────────────────────────────────────────

const PDF_CANON_ROOT = resolve(process.cwd(), "pdf-canon");
const COMPILE_TIMEOUT_MS = 120_000;
const BUNDLED_TECTONIC_BIN = resolve(
  homedir(),
  ".codex",
  ".tmp",
  "bundled-marketplaces",
  "openai-bundled",
  "plugins",
  "latex-tectonic",
  "bin",
  "tectonic.exe",
);

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
  | "tthh_agenda_seguimientos"
  | "bodega_programacion_drench"
  | "calidad_punto_apertura"
  | "postcosecha_productividad";

export type GeneratePdfAsset = {
  /**
   * Nombre de archivo que quedara disponible dentro de ./assets en el job latex.
   */
  fileName: string;
  /**
   * Contenido binario del asset.
   */
  content: Buffer;
};

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
  /**
   * Assets dinamicos del job. Se escriben en ./assets dentro del directorio temporal
   * para poder ser usados con \\includegraphics.
   */
  assets?: GeneratePdfAsset[];
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
  const assets = payload.assets ?? [];

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

    // Copiar canon.cls
    await copyFile(
      resolve(PDF_CANON_ROOT, "base", "canon.cls"),
      join(workDir, "base", "canon.cls"),
    );

    // Copiar canon_variables.tex ajustando la ruta del logo al workDir
    const canonVarsContent = await readFile(
      resolve(PDF_CANON_ROOT, "base", "canon_variables.tex"),
      "utf-8",
    );
    const adjustedCanonVars = canonVarsContent
      .replace(/\{\.\.\/assets\/logo\.pdf\}/g, "{./assets/logo.pdf}");
    await writeFile(
      join(workDir, "base", "canon_variables.tex"),
      adjustedCanonVars,
      "utf-8",
    );

    // Copiar logo si existe
    await copyFile(
      resolve(PDF_CANON_ROOT, "assets", "logo.pdf"),
      join(workDir, "assets", "logo.pdf"),
    ).catch(() => {/* logo ausente es aceptable */});

    for (const asset of assets) {
      const fileName = basename(asset.fileName);
      await writeFile(join(workDir, "assets", fileName), asset.content);
    }

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
  const { bin, engine } = await resolveLatexEngine();
  const cmd =
    engine === "tectonic"
      ? [
          `"${bin}"`,
          "--keep-logs",
          "--keep-intermediates",
          "-r 0",
          `-o "${workDir}"`,
          `"${join(workDir, "main.tex")}"`,
        ].join(" ")
      : [
          `"${bin}"`,
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

async function resolveLatexEngine(): Promise<{
  bin: string;
  engine: "pdflatex" | "tectonic";
}> {
  const configured = process.env["PDFLATEX_BIN"]?.trim();
  if (configured) {
    return {
      bin: configured,
      engine: basename(configured).toLowerCase().includes("tectonic")
        ? "tectonic"
        : "pdflatex",
    };
  }

  try {
    await access(BUNDLED_TECTONIC_BIN);
    return { bin: BUNDLED_TECTONIC_BIN, engine: "tectonic" };
  } catch {
    return { bin: "pdflatex", engine: "pdflatex" };
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
