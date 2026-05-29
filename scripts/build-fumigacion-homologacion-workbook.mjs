import fs from "node:fs/promises";
import path from "node:path";

import { Workbook, SpreadsheetFile } from "@oai/artifact-tool";

const rootDir = "C:/Users/paul.loja/AppData/Local/Temp/CoreX_bodega_validate";
const outputDir = path.join(rootDir, "outputs", "fumigacion_homologacion_20260525");
const dataPath = path.join(outputDir, "fumigacion_homologacion_data.json");
const workbookPath = path.join(outputDir, "fumigacion_homologacion_bodega_actividad.xlsx");

const CATEGORY_OPTIONS = [
  "CREAR_EN_BODEGA",
  "ASIGNAR_ACTIVIDAD_FUMIGACION",
  "YA_CUBIERTO",
  "REVISAR_MANUAL",
];

const ACTIVITY_OPTIONS = [
  "LANZA_NORMAL",
  "LANZAS_EFICIENTES",
  "DRON",
  "LANZA_NORMAL + DRON",
  "LANZA_NORMAL + LANZAS_EFICIENTES + DRON",
  "REVISAR",
];

function asTextList(value) {
  if (Array.isArray(value)) {
    return value.join(", ");
  }
  if (value === null || value === undefined) return "";
  return String(value);
}

function toRows(records) {
  return records.map((record) => [
    record.fuente_tipo,
    record.categoria_revision,
    record.tipo_programa,
    record.programa_header,
    record.programa_subheader,
    record.producto_excel,
    record.semana_iso_ejemplo,
    record.cantidad_ejemplo,
    record.existe_nombre_exacto_bodega,
    record.tiene_actividad_fumigacion,
    asTextList(record.codigos_bodega_exactos),
    asTextList(record.actividades_actuales_bodega),
    asTextList(record.sugerencias_nombre_bodega),
    record.familia_objetivo_sugerida,
    asTextList(record.actividades_objetivo_requeridas),
    asTextList(record.actividades_faltantes_bodega),
    record.actividad_confirmada,
    record.categoria_bodega_propuesta,
    record.crear_producto_nuevo,
    record.requiere_asignacion_actividad,
    record.decision_usuario,
    record.observaciones,
  ]);
}

function toConsolidatedRows(records) {
  return records.map((record) => [
    record.categoria_revision,
    record.producto_excel,
    asTextList(record.fuentes_presentes),
    asTextList(record.hojas_fuente),
    asTextList(record.tipos_programa),
    asTextList(record.programas_detectados),
    asTextList(record.subprogramas_detectados),
    asTextList(record.semanas_iso_ejemplo),
    asTextList(record.cantidades_ejemplo),
    record.existe_nombre_exacto_bodega,
    record.tiene_actividad_fumigacion,
    asTextList(record.codigos_bodega_exactos),
    asTextList(record.actividades_actuales_bodega),
    asTextList(record.sugerencias_nombre_bodega),
    asTextList(record.familias_objetivo_requeridas),
    asTextList(record.actividades_objetivo_requeridas),
    asTextList(record.actividades_faltantes_bodega),
    record.actividad_confirmada,
    record.categoria_bodega_propuesta,
    record.crear_producto_nuevo,
    record.requiere_asignacion_actividad,
    record.decision_usuario,
    record.observaciones,
  ]);
}

function writeSheet(workbook, sheetName, subtitle, records) {
  const sheet = workbook.worksheets.add(sheetName);
  const headers = [
    "Fuente tipo",
    "Categoria revision",
    "Tipo programa",
    "Programa header",
    "Programa subheader",
    "Producto Excel",
    "Semana ISO ejemplo",
    "Cantidad ejemplo",
    "Existe nombre exacto Bodega",
    "Tiene actividad fumigacion",
    "Codigos Bodega exactos",
    "Actividades actuales Bodega",
    "Sugerencias nombre Bodega",
    "Familia objetivo sugerida",
    "Actividades objetivo requeridas",
    "Actividades faltantes Bodega",
    "Actividad confirmada",
    "Categoria Bodega propuesta",
    "Crear producto nuevo",
    "Requiere asignacion actividad",
    "Decision usuario",
    "Observaciones",
  ];
  const rows = toRows(records);
  const lastRow = rows.length + 3;
  const headerRange = `A3:V3`;
  const titleRange = `A1:V1`;
  const subtitleRange = `A2:V2`;
  const bodyRange = rows.length ? `A4:V${lastRow}` : "A4:V4";

  sheet.getRange("A1").values = [[`Homologacion Fumigacion - ${sheetName}`]];
  sheet.getRange("A2").values = [[subtitle]];
  sheet.getRange("A3:V3").values = [headers];
  if (rows.length) {
    sheet.getRange(bodyRange).values = rows;
  }

  sheet.getRange(titleRange).format = {
    fill: "accent1",
    font: { color: "lt1", bold: true, size: 16 },
    verticalAlignment: "center",
  };
  sheet.getRange(subtitleRange).format = {
    fill: "lt2",
    font: { color: "tx1", italic: true, size: 10 },
  };
  sheet.getRange(headerRange).format = {
    fill: { type: "solid", color: { type: "theme", value: "accent1", transform: { darken: 10 } } },
    font: { color: "lt1", bold: true, size: 10 },
    borders: { preset: "outside", style: "thin", color: "#CBD5E1" },
    horizontalAlignment: "center",
    verticalAlignment: "center",
    wrapText: true,
  };

  if (rows.length) {
    sheet.getRange(bodyRange).format = {
      borders: { preset: "outside", style: "thin", color: "#E2E8F0" },
      verticalAlignment: "center",
      wrapText: true,
      font: { size: 10, color: "tx1" },
    };

    sheet.getRange(`F4:F${lastRow}`).format.numberFormat = "0";
    sheet.getRange(`G4:G${lastRow}`).format.numberFormat = "0.00";

    sheet.getRange(`A4:A${lastRow}`).conditionalFormats.add("containsText", {
      text: "CREAR_EN_BODEGA",
      format: { fill: "#FDE68A", font: { color: "#92400E", bold: true } },
    });
    sheet.getRange(`A4:A${lastRow}`).conditionalFormats.add("containsText", {
      text: "ASIGNAR_ACTIVIDAD_FUMIGACION",
      format: { fill: "#DBEAFE", font: { color: "#1D4ED8", bold: true } },
    });

    sheet.getRange(`Q4:Q${lastRow}`).dataValidation = {
      allowBlank: true,
      list: { inCellDropDown: true, source: ACTIVITY_OPTIONS },
    };
    sheet.getRange(`R4:R${lastRow}`).dataValidation = {
      allowBlank: true,
      list: { inCellDropDown: true, source: CATEGORY_OPTIONS },
    };
  }

  sheet.freezePanes.freezeRows(3);
  sheet.freezePanes.freezeColumns(5);
  sheet.getRange("A:V").format.autofitColumns();
  sheet.getRange(`1:${Math.max(lastRow, 4)}`).format.autofitRows();
  return sheet;
}

function writeConsolidatedSheet(workbook, sheetName, subtitle, records) {
  const sheet = workbook.worksheets.add(sheetName);
  const headers = [
    "Categoria revision",
    "Producto Excel",
    "Fuentes presentes",
    "Hojas fuente",
    "Tipos programa",
    "Programas detectados",
    "Subprogramas detectados",
    "Semanas ISO ejemplo",
    "Cantidades ejemplo",
    "Existe nombre exacto Bodega",
    "Tiene actividad fumigacion",
    "Codigos Bodega exactos",
    "Actividades actuales Bodega",
    "Sugerencias nombre Bodega",
    "Familias objetivo requeridas",
    "Actividades objetivo requeridas",
    "Actividades faltantes Bodega",
    "Actividad confirmada",
    "Categoria Bodega propuesta",
    "Crear producto nuevo",
    "Requiere asignacion actividad",
    "Decision usuario",
    "Observaciones",
  ];
  const rows = toConsolidatedRows(records);
  const lastRow = rows.length + 3;
  const headerRange = "A3:W3";
  const titleRange = "A1:W1";
  const subtitleRange = "A2:W2";
  const bodyRange = rows.length ? `A4:W${lastRow}` : "A4:W4";

  sheet.getRange("A1").values = [[`Homologacion Fumigacion - ${sheetName}`]];
  sheet.getRange("A2").values = [[subtitle]];
  sheet.getRange(headerRange).values = [headers];
  if (rows.length) {
    sheet.getRange(bodyRange).values = rows;
  }

  sheet.getRange(titleRange).format = {
    fill: "accent1",
    font: { color: "lt1", bold: true, size: 16 },
    verticalAlignment: "center",
  };
  sheet.getRange(subtitleRange).format = {
    fill: "lt2",
    font: { color: "tx1", italic: true, size: 10 },
  };
  sheet.getRange(headerRange).format = {
    fill: { type: "solid", color: { type: "theme", value: "accent1", transform: { darken: 10 } } },
    font: { color: "lt1", bold: true, size: 10 },
    borders: { preset: "outside", style: "thin", color: "#CBD5E1" },
    horizontalAlignment: "center",
    verticalAlignment: "center",
    wrapText: true,
  };

  if (rows.length) {
    sheet.getRange(bodyRange).format = {
      borders: { preset: "outside", style: "thin", color: "#E2E8F0" },
      verticalAlignment: "center",
      wrapText: true,
      font: { size: 10, color: "tx1" },
    };

    sheet.getRange(`A4:A${lastRow}`).conditionalFormats.add("containsText", {
      text: "CREAR_EN_BODEGA",
      format: { fill: "#FDE68A", font: { color: "#92400E", bold: true } },
    });
    sheet.getRange(`A4:A${lastRow}`).conditionalFormats.add("containsText", {
      text: "ASIGNAR_ACTIVIDAD_FUMIGACION",
      format: { fill: "#DBEAFE", font: { color: "#1D4ED8", bold: true } },
    });

    sheet.getRange(`R4:R${lastRow}`).dataValidation = {
      allowBlank: true,
      list: { inCellDropDown: true, source: ACTIVITY_OPTIONS },
    };
    sheet.getRange(`S4:S${lastRow}`).dataValidation = {
      allowBlank: true,
      list: { inCellDropDown: true, source: CATEGORY_OPTIONS },
    };
  }

  sheet.freezePanes.freezeRows(3);
  sheet.freezePanes.freezeColumns(4);
  sheet.getRange("A:W").format.autofitColumns();
  sheet.getRange(`1:${Math.max(lastRow, 4)}`).format.autofitRows();
  return sheet;
}

export async function buildWorkbook(customWorkbookPath = workbookPath) {
  const payload = JSON.parse(await fs.readFile(dataPath, "utf8"));
  const workbook = Workbook.create();
  workbook.setColorScheme({
    name: "Fumigacion",
    themeColors: {
      accent1: "#1D4ED8",
      accent2: "#F97316",
      accent3: "#16A34A",
      accent4: "#7C3AED",
      accent5: "#0F766E",
      accent6: "#DC2626",
      dk1: "#0F172A",
      lt1: "#FFFFFF",
      lt2: "#E2E8F0",
      hlink: "#2563EB",
      folHlink: "#7C3AED",
    },
  });

  const summary = workbook.worksheets.add("Resumen");
  const faltantes = payload.faltantes_bodega ?? [];
  const sinActividad = payload.sin_actividad_fumigacion ?? [];
  const consolidado = payload.records_consolidated ?? [];
  const total = payload.records?.length ?? 0;
  const normal = payload.by_source?.NORMAL ?? [];
  const dron = payload.by_source?.DRON ?? [];
  const lanzas = payload.by_source?.LANZAS ?? [];
  const cubiertos = consolidado.length - faltantes.length - sinActividad.length;

  summary.getRange("A1:F14").values = [
    ["Homologacion Fumigacion vs Bodega", null, null, null, null, null],
    ["Base analizada", "3 hojas: Normal, Dron y Lanzas supereficientes con consolidado unico por producto", null, null, null, null],
    ["Generado", payload.generated_at ?? "", null, null, null, null],
    [null, null, null, null, null, null],
    ["Indicador", "Valor", "Accion sugerida", null, null, null],
    ["Registros producto/programa revisados", total, "Universo detallado de las 3 hojas", null, null, null],
    ["Productos unicos consolidados", consolidado.length, "Lista unica para homologacion sin duplicar ventanas", null, null, null],
    ["Pendientes crear en Bodega", faltantes.length, "Crear u homologar nombre maestro", null, null, null],
    ["Pendientes asignar actividad", sinActividad.length, "Asignar familias y codigos faltantes segun cruce consolidado", null, null, null],
    ["Ya cubiertos", cubiertos, "Sin accion inmediata", null, null, null],
    ["Ventana Normal", normal.length, "Familia objetivo LANZA_NORMAL", null, null, null],
    ["Ventana Dron", dron.length, "Familia objetivo DRON", null, null, null],
    ["Ventana Lanzas", lanzas.length, "Familia objetivo LANZAS_EFICIENTES", null, null, null],
    ["Familias objetivo", "LANZA_NORMAL / LANZAS_EFICIENTES / DRON", "Confirmar por producto consolidado", null, null, null],
  ];

  summary.getRange("A1:F1").format = {
    fill: "accent1",
    font: { color: "lt1", bold: true, size: 18 },
  };
  summary.getRange("A2:F3").format = {
    fill: "lt2",
    font: { size: 10, color: "tx1" },
  };
  summary.getRange("A5:C14").format = {
    borders: { preset: "outside", style: "thin", color: "#CBD5E1" },
    wrapText: true,
    verticalAlignment: "center",
  };
  summary.getRange("A5:C5").format = {
    fill: { type: "solid", color: { type: "theme", value: "accent1", transform: { darken: 10 } } },
    font: { color: "lt1", bold: true },
  };
  summary.getRange("B6:B14").format.numberFormat = "0";
  summary.getRange("A:F").format.autofitColumns();

  summary.charts.add("bar", {
    title: "Pendientes de homologacion",
    categories: ["Crear en Bodega", "Asignar actividad", "Ya cubiertos"],
    series: [
      {
        name: "Conteo",
        values: [faltantes.length, sinActividad.length, cubiertos],
      },
    ],
    hasLegend: false,
    barOptions: { direction: "bar", grouping: "clustered", gapWidth: 80 },
    from: { row: 11, col: 0 },
    extent: { widthPx: 620, heightPx: 280 },
  });

  summary.charts.add("bar", {
    title: "Carga por ventana",
    categories: ["Normal", "Dron", "Lanzas"],
    series: [
      {
        name: "Registros",
        values: [normal.length, dron.length, lanzas.length],
      },
    ],
    hasLegend: false,
    barOptions: { direction: "column", grouping: "clustered", gapWidth: 80 },
    from: { row: 11, col: 7 },
    extent: { widthPx: 520, heightPx: 280 },
  });

  writeConsolidatedSheet(
    workbook,
    "Faltantes Bodega",
    "Lista unica de productos faltantes en Bodega consolidada desde Normal, Dron y Lanzas. Si un producto se repite en varias ventanas, aparece una sola vez.",
    faltantes,
  );
  writeConsolidatedSheet(
    workbook,
    "Sin actividad",
    "Lista unica de productos que existen en Bodega pero aun no cubren todas las actividades de fumigacion requeridas por su cruce entre ventanas.",
    sinActividad,
  );
  writeSheet(
    workbook,
    "Universo completo",
    "Consolidado completo por producto y programa de las 3 hojas. Sirve para auditoria y trazabilidad.",
    payload.records ?? [],
  );
  writeSheet(
    workbook,
    "Normal trabajo",
    "Ventana de homologacion para la fumigacion normal tomada de la hoja Fumigacion revisado 2339 rev 46.",
    normal,
  );
  writeSheet(
    workbook,
    "Dron trabajo",
    "Ventana de homologacion para la fumigacion por dron tomada de la hoja Fumigacion revisado 2339 Dron.",
    dron,
  );
  writeSheet(
    workbook,
    "Lanzas trabajo",
    "Ventana de homologacion para la fumigacion por lanzas supereficientes tomada de la hoja Fumigacion2508-Lanzasupereficie.",
    lanzas,
  );

  await fs.mkdir(outputDir, { recursive: true });
  const exported = await SpreadsheetFile.exportXlsx(workbook);
  await exported.save(customWorkbookPath);
  return { workbook, workbookPath: customWorkbookPath };
}

if (typeof process !== "undefined" && import.meta.url === `file://${process.argv[1]}`) {
  const result = await buildWorkbook();
  console.log(result.workbookPath);
}
