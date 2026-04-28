import { formatDecimal, formatInteger, formatPercent } from "@/shared/lib/format";
import type { PoscosechaClasificacionModeResult } from "@/lib/postcosecha-clasificacion-en-blanco-types";

// Backslash must be escaped first — escaping it last would double-escape the sequences added below.
function toLatexSafe(value: unknown): string {
  return String(value ?? "")
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/\{/g, "\\{")
    .replace(/\}/g, "\\}")
    .replace(/#/g, "\\#")
    .replace(/\$/g, "\\$")
    .replace(/%/g, "\\%")
    .replace(/&/g, "\\&")
    .replace(/_/g, "\\_")
    .replace(/\^/g, "\\textasciicircum{}")
    .replace(/~/g, "\\textasciitilde{}");
}

function int(value: number | null | undefined): string {
  return value == null ? "{---}" : toLatexSafe(formatInteger(value));
}

function dec(value: number | null | undefined): string {
  return value == null ? "{---}" : toLatexSafe(formatDecimal(value));
}

function pct(value: number | null | undefined, input: "ratio" | "percent" = "ratio"): string {
  return value == null ? "{---}" : toLatexSafe(formatPercent(value, { input }));
}

function buildRunSection(run: PoscosechaClasificacionModeResult): string {
  const lines: string[] = [
    `\\section*{Origen: ${toLatexSafe(run.label)}}`,
    `{\\small\\color{CanonMuted}${toLatexSafe(run.originScope)}}`,
    "",
    `\\smallskip`,
    `\\NoteInline{Prevalidación:} ${toLatexSafe(run.precheck.message)}\\\\`,
    `\\NoteInline{Holgura:} ${int(run.precheck.diferencia)}\\quad`,
    `\\NoteInline{Pedidos:} ${int(run.precheck.tallosPedidos)}\\quad`,
    `\\NoteInline{Disponibles:} ${int(run.precheck.tallosDisponibles)}`,
  ];

  if (!run.result) {
    lines.push(
      "",
      "\\begin{ObservationBox}[Sin resultado]",
      "No se resolvió ninguna corrida para este origen.",
      "\\end{ObservationBox}",
    );
    return lines.join("\n");
  }

  const { stage1Summary, stage2Summary, solverMeta, priorityRows, orderRows } = run.result;

  lines.push(
    "",
    "\\medskip",
    "{\\small",
    "\\begin{tabular}{@{}l r@{}}",
    "\\toprule",
    "\\textbf{Indicador} & \\textbf{Valor} \\\\",
    "\\midrule",
    `Bunches pedidos & ${int(stage1Summary.pedido_bunches_total)} \\\\`,
    `Bunches resueltos & ${int(stage1Summary.pedido_bunches_resuelto)} \\\\`,
    `No realizados & ${int(stage1Summary.ajuste_bunches_total)} \\\\`,
    `Peso real total (kg) & ${dec(stage2Summary.peso_real_total)} \\\\`,
    `Sobrepeso macro & ${pct(stage2Summary.sobrepeso_pct_macro, "ratio")} \\\\`,
    `Status solver & ${toLatexSafe(String(solverMeta.status ?? "n/a"))} \\\\`,
    "\\bottomrule",
    "\\end{tabular}",
    "}",
  );

  lines.push(
    "",
    "\\subsection*{Prioridad de cumplimiento}",
    "{\\footnotesize",
    "\\begin{longtable}{c l r r r r}",
    "\\toprule",
    "\\textbf{Prior.} & \\textbf{Fecha} & \\textbf{Pedido} & \\textbf{Resuelto} & \\textbf{No realizado} & \\textbf{Cumplimiento} \\\\",
    "\\midrule",
    "\\endhead",
  );
  for (const row of priorityRows) {
    lines.push(
      `${int(row.prioridad)} & ${toLatexSafe(row.fecha)} & ${int(row.pedido)} & ${int(row.resuelto)} & ${int(row.noRealizado)} & ${pct(row.cumplimiento, "ratio")} \\\\`,
    );
  }
  lines.push("\\bottomrule", "\\end{longtable}", "}");

  lines.push(
    "",
    "\\subsection*{Orden de trabajo por SKU}",
    "{\\footnotesize",
    "\\begin{longtable}{p{2.8cm} p{3.2cm} r r r r r}",
    "\\toprule",
    "\\textbf{SKU} & \\textbf{Estado} & \\textbf{Pedido} & \\textbf{Resuelto} & \\textbf{Cumpl.} & \\textbf{Peso bunch} & \\textbf{Sobrepeso} \\\\",
    "\\midrule",
    "\\endhead",
  );
  for (const row of orderRows) {
    lines.push(
      `${toLatexSafe(row.sku)} & ${toLatexSafe(row.estadoPeso)} & ${int(row.pedidoTotal)} & ${int(row.pedidoResuelto)} & ${pct(row.cumplimientoBunches, "ratio")} & ${dec(row.pesoRealBunch)} & ${pct(row.sobrepesoPct, "ratio")} \\\\`,
    );
  }
  lines.push("\\bottomrule", "\\end{longtable}", "}");

  return lines.join("\n");
}

export function buildOrdenTrabajoDataTex(
  runs: PoscosechaClasificacionModeResult[],
  exportDate: Date,
): string {
  const dateStr = exportDate.toLocaleDateString("es-EC", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const codeDate = [
    exportDate.getFullYear(),
    String(exportDate.getMonth() + 1).padStart(2, "0"),
    String(exportDate.getDate()).padStart(2, "0"),
  ].join("");

  const runCount = runs.length;
  const runSections = runs.map(buildRunSection).join("\n\n\\sectionrule\n\n");

  return [
    `\\SetDocCode{OT-CLAS-${codeDate}}`,
    `\\SetDocDate{${dateStr}}`,
    "",
    // LaTeX2e: \newcommand ya es \long por default; agregar \long\newcommand
    // dispara "You can't use \long ... with \let". No usar el prefijo \long aqui.
    "\\newcommand{\\OrdenBody}{%",
    `{\\small\\color{CanonMuted}Incluye ${runCount}~corrida${runCount !== 1 ? "s" : ""} del solver por origen.}`,
    "",
    runSections,
    "",
    "}",
    "",
  ].join("\n");
}
