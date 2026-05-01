import { existsSync } from "node:fs";
import { promises as fs } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";

import { type NextRequest } from "next/server";

import { requireAuth } from "@/lib/api-auth";
import { handleApiError } from "@/lib/api-error";
import {
  buildDrenchProductBlockRows,
  listDrenchWeekCalendar,
  listDrenchWeekCalendarOptions,
  type DrenchWeekCalendarFilters,
} from "@/lib/drench-week-calendar";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PdfViewMode = "by-block" | "by-product-block";

type PdfRequestBody = {
  filters?: Partial<DrenchWeekCalendarFilters>;
  selectedGroupKey?: string;
  viewMode?: PdfViewMode;
};

const PDF_SCRIPT_PATH = resolve(process.cwd(), "scripts", "generate_drench_program_pdf.py");
const BUNDLED_PYTHON = "C:\\Users\\paul.loja\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\python\\python.exe";

function resolvePythonExecutable() {
  const candidates = [
    process.env.REPORTS_PYTHON?.trim() ?? "",
    BUNDLED_PYTHON,
    process.env.MEDICAL_PYTHON?.trim() ?? "",
    "python",
    "python3",
  ].filter(Boolean);

  for (const candidate of candidates) {
    const looksLikePath = candidate.includes("\\") || candidate.includes("/");
    if (!looksLikePath || existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error("No se encontro un interprete Python para exportar el PDF de drench.");
}

function normalizeFilters(filters: Partial<DrenchWeekCalendarFilters> | undefined, defaultIsoWeekId: string): DrenchWeekCalendarFilters {
  return {
    isoWeekId: String(filters?.isoWeekId ?? defaultIsoWeekId).trim(),
    cycleType: String(filters?.cycleType ?? "").trim().toUpperCase(),
    variety: String(filters?.variety ?? "").trim().toUpperCase(),
    areaId: String(filters?.areaId ?? "").trim().toUpperCase(),
  };
}

function buildBlockRowsPayload(rows: Awaited<ReturnType<typeof listDrenchWeekCalendar>>) {
  return rows.map((row) => ({
    cycleKey: row.cycleKey,
    blockId: row.blockId,
    isoWeekId: row.isoWeekId,
    phenologicalWeek: `${row.phenologicalWeek} · ${row.recipeRuleCode}`,
    bedCount: row.bedCount === null ? "-" : row.bedCount.toFixed(2),
    recipe: row.recipeLines.length
      ? row.recipeLines
        .map((line) => {
          const qty = line.productQuantityTotal === null ? "-" : line.productQuantityTotal.toFixed(2);
          const unit = line.unitCode ?? "";
          return `${line.productCode ?? "-"} ${line.productName ?? "Sin producto"} · ${qty} ${unit}`.trim();
        })
        .join(" | ")
      : "Sin receta homologada",
  }));
}

async function generatePdfBuffer(payload: Record<string, unknown>) {
  const python = resolvePythonExecutable();
  const tempDir = await fs.mkdtemp(join(tmpdir(), "corex-drench-pdf-"));
  const inputPath = join(tempDir, "payload.json");
  const outputPath = join(tempDir, "output.pdf");
  await fs.writeFile(inputPath, JSON.stringify(payload), "utf8");

  const buffer = await new Promise<Buffer>((resolvePromise, rejectPromise) => {
    const child = spawn(python, [PDF_SCRIPT_PATH, inputPath, outputPath], {
      cwd: process.cwd(),
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", rejectPromise);
    child.on("close", async (code) => {
      if (code !== 0) {
        rejectPromise(new Error(stderr.trim() || "No se pudo generar el PDF de drench."));
        return;
      }

      try {
        const pdf = await fs.readFile(outputPath);
        resolvePromise(pdf);
      } catch (error) {
        rejectPromise(error);
      }
    });
  });

  await fs.rm(tempDir, { recursive: true, force: true });
  return buffer;
}

export async function POST(request: NextRequest) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  try {
    const body = (await request.json()) as PdfRequestBody;
    const options = await listDrenchWeekCalendarOptions();
    const filters = normalizeFilters(body.filters, options.defaultIsoWeekId);
    const allRows = await listDrenchWeekCalendar(filters);
    const rows = body.selectedGroupKey
      ? allRows.filter((row) => row.drenchGroupKey === body.selectedGroupKey)
      : allRows;
    const viewMode: PdfViewMode = body.viewMode === "by-product-block" ? "by-product-block" : "by-block";

    const title = viewMode === "by-product-block"
      ? `Resumen drench bodega · Semana ${filters.isoWeekId}`
      : `Programacion semanal por bloque · Semana ${filters.isoWeekId}`;

    const pdfPayload = viewMode === "by-product-block"
      ? {
        title,
        subtitle: body.selectedGroupKey
          ? `Vista filtrada por ${rows[0]?.drenchGroupLabel ?? body.selectedGroupKey}`
          : "Agrupado por producto y bloque.",
        sections: [
          {
            title: "Resumen general por producto",
            columns: [
              { key: "productCode", label: "CODIGO", width: 30 },
              { key: "productName", label: "PRODUCTO", width: 75 },
              { key: "blocks", label: "BLOQUES", width: 25 },
              { key: "quantity", label: "CANTIDAD", width: 35 },
            ],
            rows: Object.values(
              buildDrenchProductBlockRows(rows).reduce<Record<string, {
                productCode: string;
                productName: string;
                blocks: number;
                quantity: number;
                unitCode: string | null;
              }>>((acc, row) => {
                const key = `${row.productCode}|${row.unitCode ?? ""}`;
                const current = acc[key] ?? {
                  productCode: row.productCode,
                  productName: row.productName,
                  blocks: 0,
                  quantity: 0,
                  unitCode: row.unitCode ?? null,
                };
                current.blocks += 1;
                current.quantity += row.quantityTotal;
                acc[key] = current;
                return acc;
              }, {}),
            ).map((row) => ({
              productCode: row.productCode,
              productName: row.productName,
              blocks: String(row.blocks),
              quantity: `${row.quantity.toFixed(2)} ${row.unitCode ?? ""}`.trim(),
            })),
          },
          {
            title: "Detalle por producto y bloque",
            columns: [
              { key: "productCode", label: "CODIGO", width: 30 },
              { key: "productName", label: "PRODUCTO", width: 75 },
              { key: "blockId", label: "BLOQUE", width: 25 },
              { key: "quantity", label: "CANTIDAD", width: 35 },
            ],
            rows: buildDrenchProductBlockRows(rows).map((row) => ({
              productCode: row.productCode,
              productName: row.productName,
              blockId: row.blockId,
              quantity: `${row.quantityTotal.toFixed(2)} ${row.unitCode ?? ""}`.trim(),
            })),
          },
        ],
      }
      : {
        title,
        subtitle: body.selectedGroupKey
          ? `Vista filtrada por ${rows[0]?.drenchGroupLabel ?? body.selectedGroupKey}`
          : "Programacion semanal por bloque.",
        columns: [
          { key: "cycleKey", label: "CYCLE ID", width: 50 },
          { key: "blockId", label: "BLOQUE", width: 20 },
          { key: "isoWeekId", label: "SEMANA ISO", width: 22 },
          { key: "phenologicalWeek", label: "CATEGORIA FENOLOGICA", width: 35 },
          { key: "bedCount", label: "# CAMAS 30M2", width: 25 },
          { key: "recipe", label: "RECETA POR BLOQUE", width: 120 },
        ],
        rows: buildBlockRowsPayload(rows),
      };

    const pdf = await generatePdfBuffer(pdfPayload);
    const filename = `${viewMode === "by-product-block" ? "resumen_drench_bodega" : "programacion_drench_bloque"}_${filters.isoWeekId}.pdf`;
    return new Response(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return handleApiError(error, "No se pudo generar el PDF de programacion semanal de drench.");
  }
}
