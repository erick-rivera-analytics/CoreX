import fs from "node:fs/promises";
import path from "node:path";

import { Workbook, SpreadsheetFile } from "@oai/artifact-tool";

const rootDir = "C:/Users/paul.loja/AppData/Local/Temp/CoreX_bodega_validate";
const outputDir = path.join(rootDir, "outputs", "fumigacion_homologacion_20260527");
const dataPath = path.join(outputDir, "fumigacion_codigos_validacion_data.json");
const workbookPath = path.join(outputDir, "fumigacion_codigos_validacion.xlsx");

function text(value) {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value);
}

function rowsToMatrix(rows) {
  return rows.map((row) => [
    text(row.producto_programacion),
    text(row.nombres_semilla),
    text(row.estado),
    text(row.codigo_usado),
    text(row.nombre_bodega_usado),
    text(row.unidad_codigo),
    text(row.unidad_nombre),
    text(row.categoria_bodega),
    text(row.decision_usuario),
    text(row.codigo_bodega_vincular_raw),
    text(row.codigos_considerados),
    text(row.codigos_no_usados),
    text(row.sugerencia_1_bodega),
    text(row.sugerencia_2_bodega),
    text(row.familias_requeridas),
    text(row.actividades_requeridas),
    text(row.programas_detectados),
    text(row.semanas_iso_ejemplo),
    text(row.cantidades_ejemplo),
    text(row.observaciones),
    Number(row.apariciones_semilla ?? 0),
  ]);
}

function similarRowsToMatrix(rows) {
  return rows.map((row) => [
    text(row.producto_programacion),
    text(row.nombres_semilla),
    text(row.codigo_usado),
    text(row.nombre_bodega_usado),
    text(row.codigos_considerados),
    text(row.codigos_no_usados),
    text(row.similar_bodega_candidates_text),
    text(row.decision_usuario),
    text(row.observaciones),
    Number(row.apariciones_semilla ?? 0),
  ]);
}

function explicitMultiCodeRowsToMatrix(rows) {
  return rows.map((row) => [
    text(row.producto_excel),
    text(row.decision_usuario),
    text(row.codigo_bodega_vincular_raw),
    text(row.codigo_seleccionado),
    text(row.nombre_bodega_seleccionado),
    text(row.codigos_no_usados),
    text(row.sugerencia_1_bodega),
    text(row.sugerencia_2_bodega),
    text(row.familias_requeridas),
    text(row.actividades_requeridas),
    text(row.programas_detectados),
    text(row.semanas_iso_ejemplo),
    text(row.cantidades_ejemplo),
    text(row.observaciones),
  ]);
}

function writeCommonHeader(sheet, endColumn, title, subtitle) {
  sheet.getRange(`A1:${endColumn}1`).values = [[title]];
  sheet.getRange(`A2:${endColumn}2`).values = [[subtitle]];
  sheet.getRange(`A1:${endColumn}1`).format = {
    fill: "accent1",
    font: { color: "lt1", bold: true, size: 16 },
  };
  sheet.getRange(`A2:${endColumn}2`).format = {
    fill: "lt2",
    font: { color: "tx1", italic: true, size: 10 },
  };
}

function writeDataSheet(workbook, name, title, subtitle, rows) {
  const sheet = workbook.worksheets.add(name);
  const headers = [
    "Producto en programación",
    "Nombres detectados en semilla",
    "Estado",
    "Código usado",
    "Nombre Bodega usado",
    "Unidad código",
    "Unidad nombre",
    "Categoría Bodega",
    "Decisión usuario",
    "Código vincular raw",
    "Códigos considerados",
    "Códigos no usados",
    "Sugerencia 1 Bodega",
    "Sugerencia 2 Bodega",
    "Familias requeridas",
    "Actividades requeridas",
    "Programas detectados",
    "Semanas ISO ejemplo",
    "Cantidades ejemplo",
    "Observaciones",
    "Apariciones semilla",
  ];
  const body = rowsToMatrix(rows);
  const lastRow = body.length + 3;
  const endColumn = "U";

  writeCommonHeader(sheet, endColumn, title, subtitle);
  sheet.getRange(`A3:${endColumn}3`).values = [headers];
  if (body.length) {
    sheet.getRange(`A4:${endColumn}${lastRow}`).values = body;
  }

  sheet.getRange(`A3:${endColumn}3`).format = {
    fill: { type: "solid", color: { type: "theme", value: "accent1", transform: { darken: 12 } } },
    font: { color: "lt1", bold: true, size: 10 },
    borders: { preset: "outside", style: "thin", color: "#CBD5E1" },
    wrapText: true,
    horizontalAlignment: "center",
    verticalAlignment: "center",
  };

  if (body.length) {
    sheet.getRange(`A4:${endColumn}${lastRow}`).format = {
      borders: { preset: "outside", style: "thin", color: "#E2E8F0" },
      wrapText: true,
      verticalAlignment: "center",
      font: { size: 10, color: "tx1" },
    };

    sheet.getRange(`C4:C${lastRow}`).conditionalFormats.add("containsText", {
      text: "PENDIENTE",
      format: { fill: "#FEE2E2", font: { color: "#B91C1C", bold: true } },
    });
    sheet.getRange(`C4:C${lastRow}`).conditionalFormats.add("containsText", {
      text: "RESUELTO",
      format: { fill: "#DCFCE7", font: { color: "#166534", bold: true } },
    });
    sheet.getRange(`K4:L${lastRow}`).format = {
      font: { size: 10, color: "#7C2D12" },
      wrapText: true,
    };
  }

  sheet.freezePanes.freezeRows(3);
  sheet.freezePanes.freezeColumns(3);
  sheet.getRange(`A:${endColumn}`).format.autofitColumns();
  sheet.getRange(`1:${Math.max(lastRow, 4)}`).format.autofitRows();
  return sheet;
}

function writeSimilarSheet(workbook, name, title, subtitle, rows) {
  const sheet = workbook.worksheets.add(name);
  const headers = [
    "Producto en programación",
    "Nombres detectados en semilla",
    "Código usado",
    "Nombre Bodega usado",
    "Códigos considerados",
    "Códigos no usados",
    "Candidatos similares en Bodega",
    "Decisión usuario",
    "Observaciones",
    "Apariciones semilla",
  ];
  const body = similarRowsToMatrix(rows);
  const lastRow = body.length + 3;
  const endColumn = "J";

  writeCommonHeader(sheet, endColumn, title, subtitle);
  sheet.getRange(`A3:${endColumn}3`).values = [headers];
  if (body.length) {
    sheet.getRange(`A4:${endColumn}${lastRow}`).values = body;
  }

  sheet.getRange(`A3:${endColumn}3`).format = {
    fill: { type: "solid", color: { type: "theme", value: "accent1", transform: { darken: 12 } } },
    font: { color: "lt1", bold: true, size: 10 },
    borders: { preset: "outside", style: "thin", color: "#CBD5E1" },
    wrapText: true,
    horizontalAlignment: "center",
    verticalAlignment: "center",
  };

  if (body.length) {
    sheet.getRange(`A4:${endColumn}${lastRow}`).format = {
      borders: { preset: "outside", style: "thin", color: "#E2E8F0" },
      wrapText: true,
      verticalAlignment: "center",
      font: { size: 10, color: "tx1" },
    };
    sheet.getRange(`G4:G${lastRow}`).format = {
      font: { size: 10, color: "#7C2D12" },
      wrapText: true,
    };
  }

  sheet.freezePanes.freezeRows(3);
  sheet.freezePanes.freezeColumns(2);
  sheet.getRange(`A:${endColumn}`).format.autofitColumns();
  sheet.getRange(`1:${Math.max(lastRow, 4)}`).format.autofitRows();
  return sheet;
}

function writeExplicitMultiCodeSheet(workbook, name, title, subtitle, rows) {
  const sheet = workbook.worksheets.add(name);
  const headers = [
    "Producto Excel",
    "Decisión usuario",
    "Código raw ajustado",
    "Código seleccionado",
    "Nombre Bodega seleccionado",
    "Códigos no usados",
    "Sugerencia 1 Bodega",
    "Sugerencia 2 Bodega",
    "Familias requeridas",
    "Actividades requeridas",
    "Programas detectados",
    "Semanas ISO ejemplo",
    "Cantidades ejemplo",
    "Observaciones",
  ];
  const body = explicitMultiCodeRowsToMatrix(rows);
  const lastRow = body.length + 3;
  const endColumn = "N";

  writeCommonHeader(sheet, endColumn, title, subtitle);
  sheet.getRange(`A3:${endColumn}3`).values = [headers];
  if (body.length) {
    sheet.getRange(`A4:${endColumn}${lastRow}`).values = body;
  }

  sheet.getRange(`A3:${endColumn}3`).format = {
    fill: { type: "solid", color: { type: "theme", value: "accent1", transform: { darken: 12 } } },
    font: { color: "lt1", bold: true, size: 10 },
    borders: { preset: "outside", style: "thin", color: "#CBD5E1" },
    wrapText: true,
    horizontalAlignment: "center",
    verticalAlignment: "center",
  };

  if (body.length) {
    sheet.getRange(`A4:${endColumn}${lastRow}`).format = {
      borders: { preset: "outside", style: "thin", color: "#E2E8F0" },
      wrapText: true,
      verticalAlignment: "center",
      font: { size: 10, color: "tx1" },
    };
    sheet.getRange(`D4:F${lastRow}`).format = {
      font: { size: 10, color: "#7C2D12" },
      wrapText: true,
    };
  }

  sheet.freezePanes.freezeRows(3);
  sheet.freezePanes.freezeColumns(2);
  sheet.getRange(`A:${endColumn}`).format.autofitColumns();
  sheet.getRange(`1:${Math.max(lastRow, 4)}`).format.autofitRows();
  return sheet;
}

export async function buildWorkbook(customWorkbookPath = workbookPath) {
  const payload = JSON.parse(await fs.readFile(dataPath, "utf8"));
  const workbook = Workbook.create();

  workbook.setColorScheme({
    name: "FumigacionCodigos",
    themeColors: {
      accent1: "#0F4C81",
      accent2: "#0F766E",
      accent3: "#F97316",
      accent4: "#7C3AED",
      accent5: "#B45309",
      accent6: "#DC2626",
      dk1: "#0F172A",
      lt1: "#FFFFFF",
      lt2: "#E2E8F0",
      hlink: "#2563EB",
      folHlink: "#7C3AED",
    },
  });

  const summary = workbook.worksheets.add("Resumen");
  summary.getRange("A1:F13").values = [
    ["Validación de códigos usados en Programación Fumigación", null, null, null, null, null],
    ["Base", `${payload.generated_from_seed} + ${payload.generated_from_review_workbook} + Bodega actual`, null, null, null, null],
    ["Generado", new Date().toISOString(), null, null, null, null],
    [null, null, null, null, null, null],
    ["Indicador", "Valor", "Detalle", null, null, null],
    ["Productos únicos en semilla", Number(payload.total_productos_programacion ?? 0), "Catálogo usado actualmente en la programación", null, null, null],
    ["Productos resueltos", Number(payload.total_resueltos ?? 0), "Ya tienen código vigente usable en Bodega/Fumigación", null, null, null],
    ["Pendientes reales", Number(payload.total_pendientes ?? 0), "A la fecha deberían quedar solo C BN y RIDOMIL GOLD", null, null, null],
    ["Casos multi-código", Number(payload.total_multicodigo ?? 0), "Productos donde ya había más de una opción explícita", null, null, null],
    ["Similares en Bodega", Number(payload.total_similares_bodega ?? 0), "Productos con dos o más nombres/códigos muy parecidos detectados en Bodega", null, null, null],
    ["Hoja principal", "Codigos usados", "Usar esta hoja como base de revisión funcional", null, null, null],
    ["Hoja pendientes", "Pendientes", "Solo productos sin resolver definitivamente", null, null, null],
    ["Hoja similares", "Similares Bodega", "Detecta candidatos por similitud de nombre", null, null, null],
  ];
  summary.getRange("A1:F1").format = {
    fill: "accent1",
    font: { color: "lt1", bold: true, size: 18 },
  };
  summary.getRange("A2:F3").format = {
    fill: "lt2",
    font: { color: "tx1", size: 10 },
  };
  summary.getRange("A5:C13").format = {
    borders: { preset: "outside", style: "thin", color: "#CBD5E1" },
    wrapText: true,
    verticalAlignment: "center",
  };
  summary.getRange("A5:C5").format = {
    fill: { type: "solid", color: { type: "theme", value: "accent1", transform: { darken: 10 } } },
    font: { color: "lt1", bold: true },
  };
  summary.getRange("B6:B13").format.numberFormat = "0";
  summary.getRange("A:F").format.autofitColumns();

  writeDataSheet(
    workbook,
    "Codigos usados",
    "Catálogo usado en Programación Fumigación",
    "Listado consolidado de todos los productos que hoy aparecen en la semilla actual, con el código aplicado en Bodega y trazabilidad de revisión.",
    payload.rows ?? [],
  );
  writeDataSheet(
    workbook,
    "Pendientes",
    "Pendientes reales de Programación Fumigación",
    "Solo productos que siguen sin resolución definitiva de código aplicable en Bodega.",
    payload.pending_rows ?? [],
  );
  writeExplicitMultiCodeSheet(
    workbook,
    "Multi-codigo",
    "Casos con múltiples códigos definidos manualmente",
    "Toma exactamente los casos del Excel ajustado donde se definió usar el primero, segundo o tercer código, mostrando el elegido y los no usados.",
    payload.multi_code_rows ?? [],
  );
  writeSimilarSheet(
    workbook,
    "Similares Bodega",
    "Candidatos por nombre muy similar en Bodega",
    "Ayuda a detectar productos con más de un nombre/código muy parecido en Bodega para validar cuál se usa realmente en Programación Fumigación.",
    payload.similar_name_rows ?? [],
  );

  await fs.mkdir(outputDir, { recursive: true });
  const exported = await SpreadsheetFile.exportXlsx(workbook);
  await exported.save(customWorkbookPath);
  return { workbookPath: customWorkbookPath };
}

if (typeof process !== "undefined" && import.meta.url === `file://${process.argv[1]}`) {
  const result = await buildWorkbook();
  console.log(result.workbookPath);
}
