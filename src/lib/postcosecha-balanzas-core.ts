import type { QueryResultRow } from "pg";

import { query } from "@/lib/db";
import { decodeMultiSelectValue, encodeMultiSelectValue, hasMultiSelectValue } from "@/lib/multi-select";
import { cachedAsync } from "@/lib/server-cache";
import { formatFlexibleNumber, formatPercent as formatPercentShared } from "@/shared/lib/format";

export type BalanzasMetric = "peso" | "tallos";
export type BalanzasWeekMode = "none" | "pre" | "iso";
export type BalanzasNodeKey = "apertura_pelado_patas" | "b2" | "b2a";
export type BalanzasViewStatus = "ready" | "unavailable";

export type BalanzasFilters = {
  metric: BalanzasMetric;
  year: string;
  month: string;
  dayName: string;
  destination: string;
  weekMode: BalanzasWeekMode;
  weekValue: string;
  dateFrom: string;
  dateTo: string;
};

export type BalanzasFilterOptions = {
  years: string[];
  months: string[];
  preWeeks: string[];
  isoWeeks: string[];
  dayNames: string[];
  destinations: string[];
};

export type BalanzasLocalFilterOptions = {
  destinations: string[];
  grades: string[];
  lots: string[];
  hydrationDays: string[];
  preWeeks: string[];
  isoWeeks: string[];
  dayNames: string[];
  months: string[];
  dates: string[];
};

export type BalanzasTableColumnKind = "text" | "number" | "date" | "ratio";

export type BalanzasTableColumn = {
  key: string;
  label: string;
  kind: BalanzasTableColumnKind;
};

export type BalanzasTableRow = {
  id: string;
  values: Record<string, string | number | null>;
  ratioPct: number | null;
  gapValue: number | null;
};

export type BalanzasProcessBinding = {
  taskName: string;
  elementId?: string;
  destination?: string;
  pathLabel?: string;
  minY?: number;
  maxY?: number;
};

export type BalanzasDestinationBreakdown = {
  destination: string;
  pathLabel: string;
  rowCount: number;
  sourceTotal: number;
  sourceTotalDisplay: string;
  targetTotal: number;
  targetTotalDisplay: string;
  ratioPct: number | null;
  ratioDisplay: string;
};

export type BalanzasNodeData = {
  key: BalanzasNodeKey;
  metric: BalanzasMetric;
  label: string;
  shortLabel: string;
  compareLabel: string;
  sourceStage: string;
  targetStage: string;
  branchLabel: string;
  description: string;
  bpmnBranch: string;
  sourceView: string | null;
  status: BalanzasViewStatus;
  statusMessage: string | null;
  rowCount: number;
  sourceTotal: number;
  sourceTotalDisplay: string;
  targetTotal: number;
  targetTotalDisplay: string;
  gapTotal: number;
  gapTotalDisplay: string;
  ratioPct: number | null;
  ratioDisplay: string;
  latestDate: string | null;
  processBindings: BalanzasProcessBinding[];
  destinationBreakdown: BalanzasDestinationBreakdown[];
  columnMap: {
    year: string | null;
    month: string | null;
    preWeek: string | null;
    isoWeek: string | null;
    dayName: string | null;
    date: string | null;
    destination: string | null;
    lot: string | null;
    grade: string | null;
    hydrationDays: string | null;
    source: string | null;
    target: string | null;
    ratio: string;
    gap: string;
  };
  localOptions: BalanzasLocalFilterOptions;
  groupDefaults: string[];
  tableColumns: BalanzasTableColumn[];
  rows: BalanzasTableRow[];
};

export type BalanzasDashboardData = {
  generatedAt: string;
  processAssetPath: string;
  metric: BalanzasMetric;
  metricLabel: string;
  filters: BalanzasFilters;
  options: BalanzasFilterOptions;
  summary: {
    totalNodes: number;
    readyNodes: number;
    totalRows: number;
    latestDate: string | null;
    periodLabel: string;
    destinationLabel: string;
    scopeLabel: string;
    scopeNote: string;
    statusMessage: string | null;
  };
  nodes: BalanzasNodeData[];
};

type GenericQueryRow = QueryResultRow & Record<string, unknown>;

type BalanzasProcessNodeDefinition = {
  key: BalanzasNodeKey;
  label: string;
  shortLabel: string;
  compareLabel: string;
  sourceStage: string;
  targetStage: string;
  branchLabel: string;
  description: string;
  bpmnBranch: string;
  views: Partial<Record<BalanzasMetric, string>>;
  processBindings: BalanzasProcessBinding[];
};

type BalanzasViewSchema = {
  viewName: string;
  columns: Array<{
    name: string;
    dataType: string;
    canonicalName: string;
  }>;
  aliases: {
    year: string | null;
    month: string | null;
    preWeek: string | null;
    isoWeek: string | null;
    dayName: string | null;
    date: string | null;
    destination: string | null;
    lot: string | null;
    hydrationDays: string | null;
    grade: string | null;
    ratio: string | null;
    target: string | null;
    source: string | null;
    targetValue: string | null;
  };
  numericColumns: string[];
};

const BALANZAS_PROCESS_ASSET = "/processes/postcosecha-es.bpmn";
const BALANZAS_SCHEMA_TTL_MS = 5 * 60 * 1000;
const BALANZAS_OPTIONS_TTL_MS = 5 * 60 * 1000;
const BALANZAS_DASHBOARD_TTL_MS = 60 * 1000;
const BALANZAS_MAX_NODE_ROWS = 800;
const BALANZAS_SCOPE_LABEL = "Rama activa: Apertura -> Apertura pelado patas -> BAL2 -> BAL2A";
const BALANZAS_SCOPE_NOTE = "En esta version solo se instrumenta la rama baja del BPMN y el tramo BAL2 -> BAL2A se divide en Arcoiris, Tinturado y Blanco.";
const BALANZAS_DESTINATION_LABEL = "Destino interno B2 -> B2A";

const BALANZAS_PROCESS_NODES: BalanzasProcessNodeDefinition[] = [
  {
    key: "apertura_pelado_patas",
    label: "BAL1 / BAL1C",
    shortLabel: "BAL1 / BAL1C",
    compareLabel: "BAL 1 vs BAL 1C",
    sourceStage: "BAL1",
    targetStage: "BAL1C",
    branchLabel: "Paso 1 de 3 | Apertura",
    bpmnBranch: "Apertura -> Apertura pelado patas",
    description:
      "Cruce BAL1 vs BAL1C que corresponde unicamente al tramo Apertura -> Apertura pelado patas dentro de la rama instrumentada.",
    views: {
      peso: "gld.mv_camp_ind_bal_apertura_b1_vs_b1c_peso_xl_np_cur",
      tallos: "gld.mv_camp_ind_bal_apertura_b1_vs_b1c_tallos_xl_np_cur",
    },
    processBindings: [{ taskName: "B1C", elementId: "_453c546c-f64a-496f-9a76-d96c539feea3" }],
  },
  {
    key: "b2",
    label: "BAL1C / BAL2",
    shortLabel: "BAL1C / BAL2",
    compareLabel: "BAL 1C vs BAL 2",
    sourceStage: "BAL1C",
    targetStage: "BAL2",
    branchLabel: "Paso 2 de 3 | Hidratacion",
    bpmnBranch: "Apertura pelado patas -> BAL2",
    description:
      "Cruce BAL1C vs BAL2 que sigue la rama de Apertura pelado patas, pasando por Hidratacion y sin mezclar la ruta MAX 10 dias.",
    views: {
      peso: "gld.mv_camp_ind_bal_apertura_b1c_vs_b2_peso_xl_np_cur",
      tallos: "gld.mv_camp_ind_bal_apertura_b1c_vs_b2_tallos_xl_np_cur",
    },
    processBindings: [{ taskName: "B2", elementId: "_eab2bad3-db33-4271-91ab-e351349fb27c" }],
  },
  {
    key: "b2a",
    label: "BAL2 / BAL2A",
    shortLabel: "BAL2 / BAL2A",
    compareLabel: "BAL 2 vs BAL 2A",
    sourceStage: "BAL2",
    targetStage: "BAL2A",
    branchLabel: "Paso 3 de 3 | Pelado y clasificado",
    bpmnBranch: "BAL2 -> BAL2A",
    description:
      "Cruce BAL2 vs BAL2A dentro de la misma rama, despues del pelado y clasificado de tallos.",
    views: {
      peso: "gld.mv_camp_ind_bal_apertura_b2_vs_b2a_peso_xl_np_cur",
    },
    processBindings: [
      {
        taskName: "B2A",
        elementId: "_9d2e729a-2dfe-460c-b4b6-b8d10f353771",
        destination: "ARCOIRIS",
        pathLabel: "Arcoiris",
      },
      {
        taskName: "B2A",
        elementId: "_f9cd2924-9185-4209-9668-27d2616c3e3f",
        destination: "TINTURADO",
        pathLabel: "Tinturado",
      },
      {
        taskName: "B2A",
        elementId: "_437d1e41-c7f0-49a0-a213-9742dac5ec3e",
        destination: "BLANCO",
        pathLabel: "Blanco",
      },
    ],
  },
];

export const defaultBalanzasFilters: BalanzasFilters = {
  metric: "peso",
  year: "all",
  month: "all",
  dayName: "all",
  destination: "all",
  weekMode: "iso",
  weekValue: "all",
  dateFrom: "",
  dateTo: "",
};

function normalizeMetric(value: string | undefined): BalanzasMetric {
  return value === "tallos" ? "tallos" : "peso";
}

function normalizeSelectValue(value: string | undefined) {
  return encodeMultiSelectValue(decodeMultiSelectValue(value));
}

function normalizeDateValue(value: string | undefined) {
  if (!value) {
    return "";
  }

  const normalizedValue = value.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(normalizedValue) ? normalizedValue : "";
}

function canonicalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function quoteIdentifier(identifier: string) {
  return `"${identifier.replace(/"/g, "\"\"")}"`;
}

function roundValue(value: number) {
  return Number(value.toFixed(2));
}

function toNumber(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "bigint") {
    return Number(value);
  }

  const normalizedValue = String(value).replace(/,/g, "").trim();

  if (!normalizedValue) {
    return null;
  }

  const numericValue = Number(normalizedValue);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function normalizePercentValue(value: number | null) {
  if (value === null) {
    return null;
  }

  return Math.abs(value) <= 1 ? roundValue(value * 100) : roundValue(value);
}

function formatNumber(value: number | null) {
  return formatFlexibleNumber(value, { empty: "-" });
}

function formatPercent(value: number | null) {
  return formatPercentShared(value, { empty: "-", minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function toComparableText(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  const text = String(value).trim();
  return text || null;
}

function serializeCellValue(value: unknown): string | number | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "number") {
    return roundValue(value);
  }

  if (typeof value === "bigint") {
    return Number(value);
  }

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  const numericValue = toNumber(value);

  if (numericValue !== null && /^[+-]?\d+([.,]\d+)?$/.test(String(value).trim())) {
    return roundValue(numericValue);
  }

  return String(value).trim() || null;
}

function buildMetricLabel(metric: BalanzasMetric) {
  return metric === "peso" ? "Peso XL NP" : "Tallos XL NP";
}

function buildStageMetricLabel(metric: BalanzasMetric, stage: string) {
  return `${metric === "peso" ? "Peso" : "Tallos"} ${stage}`;
}

function toColumnLabel(columnName: string) {
  const canonicalName = canonicalize(columnName);

  if (canonicalName === "destination" || canonicalName === "destino") {
    return BALANZAS_DESTINATION_LABEL;
  }

  if (canonicalName === "work_date" || canonicalName === "date") {
    return "Fecha";
  }

  if (canonicalName === "iso_week_id" || canonicalName === "iso_week") {
    return "Semana";
  }

  if (canonicalName === "day_name_es" || canonicalName === "day_name") {
    return "Dia";
  }

  if (canonicalName === "month_name" || canonicalName === "month") {
    return "Mes";
  }

  if (canonicalName === "lot_date" || canonicalName === "origin_date" || canonicalName === "lot") {
    return "Lote";
  }

  if (canonicalName === "grade" || canonicalName === "grado") {
    return "Grado";
  }

  if (canonicalName === "hydration_days" || canonicalName === "dias_hidratacion") {
    return "Dias de hidratacion";
  }

  if (canonicalName === "weight_per_stem") {
    return "Peso por tallo";
  }

  if (canonicalName === "stems_count") {
    return "Tallos";
  }

  const parts = canonicalName.split("_").filter(Boolean);

  if (!parts.length) {
    return columnName;
  }

  return parts
    .map((part) => (part.length <= 3 ? part.toUpperCase() : `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`))
    .join(" ");
}

function serializeFilters(filters: BalanzasFilters) {
  return [
    filters.metric,
    filters.year,
    filters.month,
    filters.dayName,
    filters.destination,
    filters.weekMode,
    filters.weekValue,
    filters.dateFrom,
    filters.dateTo,
  ].join("|");
}

function uniqueSorted(values: Array<string | null | undefined>, descending = false) {
  return Array.from(new Set(values.map((value) => value?.trim() ?? "").filter(Boolean))).sort((left, right) => {
    if (descending) {
      return right.localeCompare(left, "en-US", { numeric: true });
    }

    return left.localeCompare(right, "en-US", { numeric: true });
  });
}

function findMatchingColumn(
  columns: BalanzasViewSchema["columns"],
  candidates: string[] = [],
  contains: string[] = [],
  excludes: string[] = [],
) {
  const exactMatch = columns.find((column) => candidates.includes(column.canonicalName));

  if (exactMatch) {
    return exactMatch.name;
  }

  const containsMatch = columns.find((column) => (
    contains.every((token) => column.canonicalName.includes(token))
    && excludes.every((token) => !column.canonicalName.includes(token))
  ));

  return containsMatch?.name ?? null;
}

function getSourceStageTokens(stage: string) {
  switch (stage) {
    case "B1":
    case "BAL1":
      return { contains: ["balanza", "1"], excludes: ["1c", "2", "2a"] };
    case "B1C":
    case "BAL1C":
      return { contains: ["balanza", "1c"], excludes: [] };
    case "B2":
    case "BAL2":
      return { contains: ["balanza", "2"], excludes: ["2a"] };
    case "B2A":
    case "BAL2A":
      return { contains: ["balanza", "2a"], excludes: [] };
    default:
      return { contains: [canonicalize(stage)], excludes: [] as string[] };
  }
}

async function loadViewColumns(viewName: string) {
  const [schemaName, relationName] = viewName.split(".");
  const result = await query<{ column_name: string; data_type: string }>(
    `
      select
        a.attname as column_name,
        format_type(a.atttypid, a.atttypmod) as data_type
      from pg_attribute a
      join pg_class c
        on c.oid = a.attrelid
      join pg_namespace n
        on n.oid = c.relnamespace
      where n.nspname = $1
        and c.relname = $2
        and a.attnum > 0
        and not a.attisdropped
      order by a.attnum
    `,
    [schemaName, relationName],
  );

  if (!result.rows.length) {
    throw new Error(`No se encontro la vista ${viewName} en la base configurada.`);
  }

  return result.rows.map((row) => ({
    name: row.column_name,
    dataType: row.data_type,
    canonicalName: canonicalize(row.column_name),
  }));
}

async function loadBalanzasViewSchema(
  node: BalanzasProcessNodeDefinition,
  metric: BalanzasMetric,
): Promise<BalanzasViewSchema | null> {
  const viewName = node.views[metric] ?? null;

  if (!viewName) {
    return null;
  }

  const columns = await loadViewColumns(viewName);
  const numericColumns = columns
    .filter((column) => (
      column.dataType.includes("numeric")
      || column.dataType.includes("integer")
      || column.dataType.includes("double")
      || column.dataType.includes("real")
      || column.dataType.includes("decimal")
      || column.dataType.includes("bigint")
      || column.dataType.includes("smallint")
    ))
    .map((column) => column.name);
  const sourceTokens = getSourceStageTokens(node.sourceStage);
  const targetTokens = getSourceStageTokens(node.targetStage);

  return {
    viewName,
    columns,
    numericColumns,
    aliases: {
      year: findMatchingColumn(columns, ["calendar_year", "iso_year", "year", "ano", "anio"]),
      month: findMatchingColumn(columns, ["month_name", "month", "mes", "calendar_month"]),
      preWeek: findMatchingColumn(columns, ["pre_week_id", "pre_week"], ["pre", "week"]),
      isoWeek: findMatchingColumn(columns, ["iso_week_id", "iso_week"], ["iso", "week"]),
      dayName: findMatchingColumn(columns, ["day_name_es", "day_name"], ["day", "name"]),
      date: findMatchingColumn(columns, ["work_date", "date", "event_date", "fecha"], ["date"]),
      destination: findMatchingColumn(columns, ["destination", "destino"], ["destination"]),
      lot: findMatchingColumn(columns, ["lot_date", "lot", "lote", "origin_date"], ["lot"]),
      hydrationDays: findMatchingColumn(columns, ["hydration_days", "dias_hidratacion"], ["hydrat"]),
      grade: findMatchingColumn(columns, ["grade", "grado"], ["grade"]),
      ratio: findMatchingColumn(
        columns,
        [
          "diff_weight",
          "diff_stems",
          "hidr_pct",
          "desp_pct_peso",
          "desp_pct_stems",
          "diff_pct_stems",
          "ratio_pct",
          "apertura_pct",
        ],
        ["pct"],
      ),
      target: findMatchingColumn(columns, ["target", "objetivo", "meta"], ["target"]),
      source: findMatchingColumn(columns, [], sourceTokens.contains, sourceTokens.excludes),
      targetValue: findMatchingColumn(columns, [], targetTokens.contains, targetTokens.excludes),
    },
  };
}

async function getBalanzasViewSchema(
  node: BalanzasProcessNodeDefinition,
  metric: BalanzasMetric,
) {
  return cachedAsync(
    `postcosecha:balanzas:schema:${node.key}:${metric}`,
    BALANZAS_SCHEMA_TTL_MS,
    () => loadBalanzasViewSchema(node, metric),
  );
}

function buildTextFieldExpression(
  schema: BalanzasViewSchema,
  key: "year" | "month" | "preWeek" | "isoWeek" | "dayName" | "destination",
) {
  const aliases = schema.aliases;

  if (key === "year") {
    if (aliases.date) {
      return `to_char(${quoteIdentifier(aliases.date)}::date, 'YYYY')`;
    }

    if (aliases.year) {
      return `nullif(trim(cast(${quoteIdentifier(aliases.year)} as text)), '')`;
    }

    return null;
  }

  if (key === "month") {
    if (aliases.month) {
      return `nullif(trim(cast(${quoteIdentifier(aliases.month)} as text)), '')`;
    }

    if (aliases.date) {
      return `to_char(${quoteIdentifier(aliases.date)}::date, 'YYYY-MM')`;
    }

    return null;
  }

  const columnName = aliases[key];
  return columnName ? `nullif(trim(cast(${quoteIdentifier(columnName)} as text)), '')` : null;
}

function buildDateFieldExpression(schema: BalanzasViewSchema) {
  return schema.aliases.date ? `${quoteIdentifier(schema.aliases.date)}::date` : null;
}

function buildRatioSql(schema: BalanzasViewSchema) {
  if (schema.aliases.ratio) {
    const ratioColumn = `${quoteIdentifier(schema.aliases.ratio)}::numeric`;
    return `case when ${ratioColumn} is null then null when abs(${ratioColumn}) <= 1 then ${ratioColumn} * 100 else ${ratioColumn} end`;
  }

  if (!schema.aliases.source || !schema.aliases.targetValue) {
    return "null::numeric";
  }

  const sourceColumn = `${quoteIdentifier(schema.aliases.source)}::numeric`;
  const targetColumn = `${quoteIdentifier(schema.aliases.targetValue)}::numeric`;
  return `case when ${sourceColumn} is null or ${sourceColumn} = 0 or ${targetColumn} is null then null else ((${targetColumn} / nullif(${sourceColumn}, 0)) - 1) * 100 end`;
}

function buildGapValue(row: GenericQueryRow, schema: BalanzasViewSchema) {
  const sourceValue = schema.aliases.source ? toNumber(row[schema.aliases.source]) : null;
  const targetValue = schema.aliases.targetValue ? toNumber(row[schema.aliases.targetValue]) : null;

  if (sourceValue === null || targetValue === null) {
    return null;
  }

  return roundValue(sourceValue - targetValue);
}

function buildRowRatio(row: GenericQueryRow, schema: BalanzasViewSchema) {
  if (schema.aliases.ratio) {
    return normalizePercentValue(toNumber(row[schema.aliases.ratio]));
  }

  if (!schema.aliases.source || !schema.aliases.targetValue) {
    return null;
  }

  const sourceValue = toNumber(row[schema.aliases.source]);
  const targetValue = toNumber(row[schema.aliases.targetValue]);

  if (sourceValue === null || targetValue === null || sourceValue === 0) {
    return null;
  }

  return roundValue(((targetValue / sourceValue) - 1) * 100);
}

async function loadDistinctValues(viewName: string, expression: string | null, descending = false) {
  if (!expression) {
    return [] as string[];
  }

  const result = await query<{ value: string | null }>(
    `
      select distinct ${expression} as value
      from ${viewName}
      where ${expression} is not null
      order by 1 ${descending ? "desc" : "asc"}
      limit 250
    `,
  );

  return uniqueSorted(result.rows.map((row) => row.value), descending);
}

async function loadBalanzasFilterOptions(metric: BalanzasMetric): Promise<BalanzasFilterOptions> {
  const schemas = await Promise.all(
    BALANZAS_PROCESS_NODES.map((node) => getBalanzasViewSchema(node, metric)),
  );
  const activeSchemas = schemas.filter((schema): schema is BalanzasViewSchema => Boolean(schema));
  const valueSets = await Promise.all(
    activeSchemas.map(async (schema) => ({
      years: await loadDistinctValues(schema.viewName, buildTextFieldExpression(schema, "year"), true),
      months: await loadDistinctValues(schema.viewName, buildTextFieldExpression(schema, "month"), true),
      preWeeks: await loadDistinctValues(schema.viewName, buildTextFieldExpression(schema, "preWeek"), true),
      isoWeeks: await loadDistinctValues(schema.viewName, buildTextFieldExpression(schema, "isoWeek"), true),
      dayNames: await loadDistinctValues(schema.viewName, buildTextFieldExpression(schema, "dayName")),
      destinations: await loadDistinctValues(schema.viewName, buildTextFieldExpression(schema, "destination")),
    })),
  );

  return {
    years: uniqueSorted(valueSets.flatMap((entry) => entry.years), true),
    months: uniqueSorted(valueSets.flatMap((entry) => entry.months), true),
    preWeeks: uniqueSorted(valueSets.flatMap((entry) => entry.preWeeks), true),
    isoWeeks: uniqueSorted(valueSets.flatMap((entry) => entry.isoWeeks), true),
    dayNames: uniqueSorted(valueSets.flatMap((entry) => entry.dayNames)),
    destinations: uniqueSorted(valueSets.flatMap((entry) => entry.destinations)),
  };
}

async function getBalanzasFilterOptions(metric: BalanzasMetric) {
  return cachedAsync(
    `postcosecha:balanzas:options:${metric}`,
    BALANZAS_OPTIONS_TTL_MS,
    () => loadBalanzasFilterOptions(metric),
  );
}

function buildFilterSupportIssues(schema: BalanzasViewSchema, filters: BalanzasFilters) {
  const issues: string[] = [];

  if (hasMultiSelectValue(filters.year) && !buildTextFieldExpression(schema, "year")) {
    issues.push("A\u00f1o");
  }

  if (hasMultiSelectValue(filters.month) && !buildTextFieldExpression(schema, "month")) {
    issues.push("Mes");
  }

  if (hasMultiSelectValue(filters.dayName) && !buildTextFieldExpression(schema, "dayName")) {
    issues.push("Dia");
  }

  if (hasMultiSelectValue(filters.destination) && !buildTextFieldExpression(schema, "destination")) {
    issues.push(BALANZAS_DESTINATION_LABEL);
  }

  if (filters.weekMode === "iso" && hasMultiSelectValue(filters.weekValue) && !buildTextFieldExpression(schema, "isoWeek")) {
    issues.push("Semana");
  }

  if ((filters.dateFrom || filters.dateTo) && !buildDateFieldExpression(schema)) {
    issues.push("A\u00f1o");
  }

  return issues;
}

function buildWhereClause(schema: BalanzasViewSchema, filters: BalanzasFilters) {
  const conditions: string[] = [];
  const values: unknown[] = [];

  const yearExpression = buildTextFieldExpression(schema, "year");
  const monthExpression = buildTextFieldExpression(schema, "month");
  const dayNameExpression = buildTextFieldExpression(schema, "dayName");
  const destinationExpression = buildTextFieldExpression(schema, "destination");
  const preWeekExpression = buildTextFieldExpression(schema, "preWeek");
  const isoWeekExpression = buildTextFieldExpression(schema, "isoWeek");
  const dateExpression = buildDateFieldExpression(schema);
  const selectedYears = decodeMultiSelectValue(filters.year);
  const selectedMonths = decodeMultiSelectValue(filters.month);
  const selectedDayNames = decodeMultiSelectValue(filters.dayName);
  const selectedDestinations = decodeMultiSelectValue(filters.destination);
  const selectedWeeks = decodeMultiSelectValue(filters.weekValue);

  if (selectedYears.length && yearExpression) {
    values.push(selectedYears);
    conditions.push(`${yearExpression} = any($${values.length}::text[])`);
  }

  if (selectedMonths.length && monthExpression) {
    values.push(selectedMonths);
    conditions.push(`${monthExpression} = any($${values.length}::text[])`);
  }

  if (selectedDayNames.length && dayNameExpression) {
    values.push(selectedDayNames);
    conditions.push(`${dayNameExpression} = any($${values.length}::text[])`);
  }

  if (selectedDestinations.length && destinationExpression) {
    values.push(selectedDestinations);
    conditions.push(`${destinationExpression} = any($${values.length}::text[])`);
  }

  if (filters.weekMode === "pre" && selectedWeeks.length && preWeekExpression) {
    values.push(selectedWeeks);
    conditions.push(`${preWeekExpression} = any($${values.length}::text[])`);
  }

  if (filters.weekMode === "iso" && selectedWeeks.length && isoWeekExpression) {
    values.push(selectedWeeks);
    conditions.push(`${isoWeekExpression} = any($${values.length}::text[])`);
  }

  if (filters.dateFrom && dateExpression) {
    values.push(filters.dateFrom);
    conditions.push(`${dateExpression} >= $${values.length}::date`);
  }

  if (filters.dateTo && dateExpression) {
    values.push(filters.dateTo);
    conditions.push(`${dateExpression} <= $${values.length}::date`);
  }

  return {
    whereClause: conditions.length ? `where ${conditions.join(" and ")}` : "",
    values,
  };
}

function inferColumnKind(
  columnName: string,
  schema: BalanzasViewSchema,
) {
  if (columnName === "__ratio_pct") {
    return "ratio" as const;
  }

  if (columnName === "__gap_value") {
    return "number" as const;
  }

  if (columnName === schema.aliases.date) {
    return "date" as const;
  }

  if (schema.numericColumns.includes(columnName)) {
    return "number" as const;
  }

  return "text" as const;
}

function buildTableColumns(
  node: BalanzasProcessNodeDefinition,
  schema: BalanzasViewSchema,
  metric: BalanzasMetric,
) {
  const desiredColumns = [
    schema.aliases.date,
    schema.aliases.month,
    schema.aliases.isoWeek,
    schema.aliases.dayName,
    schema.aliases.lot,
    schema.aliases.grade,
    schema.aliases.hydrationDays,
    schema.aliases.destination,
    schema.aliases.source,
    schema.aliases.targetValue,
    "__gap_value",
    "__ratio_pct",
  ].filter((value, index, array): value is string => Boolean(value) && array.indexOf(value) === index);
  const remainingColumns = schema.columns
    .map((column) => column.name)
    .filter((columnName) => columnName !== schema.aliases.ratio)
    .filter((columnName) => !desiredColumns.includes(columnName))
    .slice(0, 4);

  return [...desiredColumns, ...remainingColumns].map((columnName) => {
    if (columnName === schema.aliases.source) {
      return {
        key: columnName,
        label: buildStageMetricLabel(metric, node.sourceStage),
        kind: inferColumnKind(columnName, schema),
      } satisfies BalanzasTableColumn;
    }

    if (columnName === schema.aliases.targetValue) {
      return {
        key: columnName,
        label: buildStageMetricLabel(metric, node.targetStage),
        kind: inferColumnKind(columnName, schema),
      } satisfies BalanzasTableColumn;
    }

    if (columnName === schema.aliases.destination) {
      return {
        key: columnName,
        label: BALANZAS_DESTINATION_LABEL,
        kind: inferColumnKind(columnName, schema),
      } satisfies BalanzasTableColumn;
    }

    if (columnName === "__gap_value") {
      return { key: columnName, label: "Brecha", kind: "number" } satisfies BalanzasTableColumn;
    }

    if (columnName === "__ratio_pct") {
      return { key: columnName, label: "Macro indicador", kind: "ratio" } satisfies BalanzasTableColumn;
    }

    return {
      key: columnName,
      label: toColumnLabel(columnName),
      kind: inferColumnKind(columnName, schema),
    } satisfies BalanzasTableColumn;
  });
}

function trimTableColumns(
  columns: BalanzasTableColumn[],
  schema: BalanzasViewSchema,
  localOptions: BalanzasLocalFilterOptions,
) {
  return columns.filter((column) => {
    if (column.key === schema.aliases.preWeek) {
      return false;
    }

    if (column.key === schema.aliases.destination && localOptions.destinations.length <= 1) {
      return false;
    }

    return true;
  });
}

function buildTableRows(rows: GenericQueryRow[], schema: BalanzasViewSchema) {
  return rows.map((row, index) => {
    const ratioPct = buildRowRatio(row, schema);
    const gapValue = buildGapValue(row, schema);
    const values = Object.fromEntries(
      Object.entries(row).map(([key, value]) => [key, serializeCellValue(value)]),
    ) as Record<string, string | number | null>;

    values.__ratio_pct = ratioPct;
    values.__gap_value = gapValue;

    return {
      id: [
        toComparableText(schema.aliases.date ? row[schema.aliases.date] : null) ?? `row-${index + 1}`,
        toComparableText(schema.aliases.destination ? row[schema.aliases.destination] : null) ?? index + 1,
        `${index + 1}`,
      ].join("|"),
      values,
      ratioPct,
      gapValue,
    } satisfies BalanzasTableRow;
  });
}

function collectDistinctFromRows(rows: GenericQueryRow[], columnName: string | null, descending = false) {
  return uniqueSorted(
    rows.map((row) => (columnName ? toComparableText(row[columnName]) : null)),
    descending,
  );
}

function buildLocalFilterOptions(rows: GenericQueryRow[], schema: BalanzasViewSchema): BalanzasLocalFilterOptions {
  return {
    destinations: collectDistinctFromRows(rows, schema.aliases.destination),
    grades: collectDistinctFromRows(rows, schema.aliases.grade),
    lots: collectDistinctFromRows(rows, schema.aliases.lot, true),
    hydrationDays: collectDistinctFromRows(rows, schema.aliases.hydrationDays, true),
    preWeeks: collectDistinctFromRows(rows, schema.aliases.preWeek, true),
    isoWeeks: collectDistinctFromRows(rows, schema.aliases.isoWeek, true),
    dayNames: collectDistinctFromRows(rows, schema.aliases.dayName),
    months: collectDistinctFromRows(rows, schema.aliases.month, true),
    dates: collectDistinctFromRows(rows, schema.aliases.date, true),
  };
}

function buildGroupDefaults(schema: BalanzasViewSchema) {
  const preferredWeekColumn = schema.aliases.isoWeek;
  const defaults = [
    preferredWeekColumn,
    schema.aliases.dayName,
    schema.aliases.destination ?? schema.aliases.grade ?? schema.aliases.month,
    schema.aliases.date,
  ].filter((value, index, array): value is string => Boolean(value) && array.indexOf(value) === index);

  return defaults.slice(0, 3);
}

function buildNodePeriodLabel(filters: BalanzasFilters) {
  const selectedYears = decodeMultiSelectValue(filters.year);
  const selectedMonths = decodeMultiSelectValue(filters.month);
  const selectedDays = decodeMultiSelectValue(filters.dayName);
  const selectedWeeks = decodeMultiSelectValue(filters.weekValue);
  const calendarTokens = [
    selectedYears.length ? `A\u00f1os ${selectedYears.join(", ")}` : null,
    selectedMonths.length ? `Meses ${selectedMonths.join(", ")}` : null,
    selectedDays.length ? `Dias ${selectedDays.join(", ")}` : null,
  ].filter((value): value is string => Boolean(value));
  const weekLabel = !selectedWeeks.length
    ? "Ultima semana ISO disponible"
    : `Semanas ${selectedWeeks.join(", ")}`;
  const dateRangeLabel = filters.dateFrom || filters.dateTo
    ? `${filters.dateFrom || "..."} a ${filters.dateTo || "..."}`.replace("... a ...", "Sin rango libre")
    : "Sin rango libre";

  return [...calendarTokens, weekLabel, dateRangeLabel].join(" / ");
}

function createUnavailableNodeData(
  node: BalanzasProcessNodeDefinition,
  filters: BalanzasFilters,
  message: string,
): BalanzasNodeData {
  return {
    key: node.key,
    metric: filters.metric,
    label: node.label,
    shortLabel: node.shortLabel,
    compareLabel: node.compareLabel,
    sourceStage: node.sourceStage,
    targetStage: node.targetStage,
    branchLabel: node.branchLabel,
    description: node.description,
    bpmnBranch: node.bpmnBranch,
    sourceView: node.views[filters.metric] ?? null,
    status: "unavailable",
    statusMessage: message,
    rowCount: 0,
    sourceTotal: 0,
    sourceTotalDisplay: "0",
    targetTotal: 0,
    targetTotalDisplay: "0",
    gapTotal: 0,
    gapTotalDisplay: "0",
    ratioPct: null,
    ratioDisplay: "-",
    latestDate: null,
    processBindings: node.processBindings,
    destinationBreakdown: [],
    columnMap: {
      year: null,
      month: null,
      preWeek: null,
      isoWeek: null,
      dayName: null,
      date: null,
      destination: null,
      lot: null,
      grade: null,
      hydrationDays: null,
      source: null,
      target: null,
      ratio: "__ratio_pct",
      gap: "__gap_value",
    },
    localOptions: {
      destinations: [],
      grades: [],
      lots: [],
      hydrationDays: [],
      preWeeks: [],
      isoWeeks: [],
      dayNames: [],
      months: [],
      dates: [],
    },
    groupDefaults: [],
    tableColumns: [
      { key: "__ratio_pct", label: "Macro indicador", kind: "ratio" },
    ],
    rows: [],
  };
}

function buildDestinationBreakdown(
  rows: GenericQueryRow[],
  schema: BalanzasViewSchema,
  node: BalanzasProcessNodeDefinition,
) {
  if (!schema.aliases.destination || !schema.aliases.source || !schema.aliases.targetValue) {
    return [] as BalanzasDestinationBreakdown[];
  }

  const groups = new Map<string, BalanzasDestinationBreakdown>();

  for (const row of rows) {
    const destination = toComparableText(row[schema.aliases.destination])?.toUpperCase() ?? null;

    if (!destination) {
      continue;
    }

    const current = groups.get(destination) ?? {
      destination,
      pathLabel: destination[0] + destination.slice(1).toLowerCase(),
      rowCount: 0,
      sourceTotal: 0,
      sourceTotalDisplay: "0",
      targetTotal: 0,
      targetTotalDisplay: "0",
      ratioPct: null,
      ratioDisplay: "-",
    };

    current.rowCount += 1;
    current.sourceTotal += toNumber(row[schema.aliases.source]) ?? 0;
    current.targetTotal += toNumber(row[schema.aliases.targetValue]) ?? 0;
    groups.set(destination, current);
  }

  const pathLabels = new Map(
    node.processBindings
      .filter((binding) => binding.destination && binding.pathLabel)
      .map((binding) => [binding.destination ?? "", binding.pathLabel ?? ""]),
  );

  return Array.from(groups.values())
    .map((entry) => {
      const ratioPct = entry.sourceTotal > 0
        ? roundValue(((entry.targetTotal / entry.sourceTotal) - 1) * 100)
        : null;

      return {
        ...entry,
        pathLabel: pathLabels.get(entry.destination) ?? entry.pathLabel,
        sourceTotal: roundValue(entry.sourceTotal),
        sourceTotalDisplay: formatNumber(roundValue(entry.sourceTotal)),
        targetTotal: roundValue(entry.targetTotal),
        targetTotalDisplay: formatNumber(roundValue(entry.targetTotal)),
        ratioPct,
        ratioDisplay: formatPercent(ratioPct),
      } satisfies BalanzasDestinationBreakdown;
    })
    .sort((left, right) => left.pathLabel.localeCompare(right.pathLabel, "en-US"));
}

async function buildNodeData(
  node: BalanzasProcessNodeDefinition,
  filters: BalanzasFilters,
): Promise<BalanzasNodeData> {
  const schema = await getBalanzasViewSchema(node, filters.metric);

  if (!schema) {
    return createUnavailableNodeData(
      node,
      filters,
      `No existe vista ${filters.metric} para este nodo del proceso.`,
    );
  }

  const missingColumns = buildFilterSupportIssues(schema, filters);

  if (missingColumns.length) {
    return createUnavailableNodeData(
      node,
      filters,
      `La vista no expone columnas para filtrar por: ${missingColumns.join(", ")}.`,
    );
  }

  const { whereClause, values } = buildWhereClause(schema, filters);
  const ratioSql = buildRatioSql(schema);
  const dateSql = buildDateFieldExpression(schema);
  const sourceSql = schema.aliases.source ? `${quoteIdentifier(schema.aliases.source)}::numeric` : "null::numeric";
  const targetSql = schema.aliases.targetValue ? `${quoteIdentifier(schema.aliases.targetValue)}::numeric` : "null::numeric";
  const orderByColumn = schema.aliases.date ?? schema.aliases.preWeek ?? schema.aliases.isoWeek ?? schema.aliases.month;
  const summaryResult = await query<{
    row_count: string | number | null;
    source_total: string | number | null;
    target_total: string | number | null;
    avg_ratio_pct: string | number | null;
    latest_date: string | null;
  }>(
    `
      select
        count(*) as row_count,
        sum(coalesce(${sourceSql}, 0)) as source_total,
        sum(coalesce(${targetSql}, 0)) as target_total,
        avg(${ratioSql}) as avg_ratio_pct,
        ${dateSql ? `to_char(max(${dateSql}), 'YYYY-MM-DD')` : "null"} as latest_date
      from ${schema.viewName}
      ${whereClause}
    `,
    values,
  );
  const detailValues = [...values, BALANZAS_MAX_NODE_ROWS];
  const detailResult = await query<GenericQueryRow>(
    `
      select *
      from ${schema.viewName}
      ${whereClause}
      ${orderByColumn ? `order by ${quoteIdentifier(orderByColumn)} desc nulls last` : ""}
      limit $${detailValues.length}
    `,
    detailValues,
  );

  const summaryRow = summaryResult.rows[0];
  const rowCount = Math.trunc(toNumber(summaryRow?.row_count) ?? 0);
  const sourceTotal = roundValue(toNumber(summaryRow?.source_total) ?? 0);
  const targetTotal = roundValue(toNumber(summaryRow?.target_total) ?? 0);
  const avgRatioPct = normalizePercentValue(toNumber(summaryRow?.avg_ratio_pct));
  const derivedRatioPct = sourceTotal > 0 ? roundValue(((targetTotal / sourceTotal) - 1) * 100) : null;
  const ratioPct = derivedRatioPct ?? avgRatioPct;
  const rows = detailResult.rows;
  const tableRows = buildTableRows(rows, schema);
  const localOptions = buildLocalFilterOptions(rows, schema);
  const tableColumns = trimTableColumns(buildTableColumns(node, schema, filters.metric), schema, localOptions);

  return {
    key: node.key,
    metric: filters.metric,
    label: node.label,
    shortLabel: node.shortLabel,
    compareLabel: node.compareLabel,
    sourceStage: node.sourceStage,
    targetStage: node.targetStage,
    branchLabel: node.branchLabel,
    description: node.description,
    bpmnBranch: node.bpmnBranch,
    sourceView: schema.viewName,
    status: "ready",
    statusMessage: null,
    rowCount,
    sourceTotal,
    sourceTotalDisplay: formatNumber(sourceTotal),
    targetTotal,
    targetTotalDisplay: formatNumber(targetTotal),
    gapTotal: roundValue(sourceTotal - targetTotal),
    gapTotalDisplay: formatNumber(roundValue(sourceTotal - targetTotal)),
    ratioPct,
    ratioDisplay: formatPercent(ratioPct),
    latestDate: summaryRow?.latest_date ?? null,
    processBindings: node.processBindings,
    destinationBreakdown: buildDestinationBreakdown(rows, schema, node),
    columnMap: {
      year: schema.aliases.year,
      month: schema.aliases.month,
      preWeek: schema.aliases.preWeek,
      isoWeek: schema.aliases.isoWeek,
      dayName: schema.aliases.dayName,
      date: schema.aliases.date,
      destination: schema.aliases.destination,
      lot: schema.aliases.lot,
      grade: schema.aliases.grade,
      hydrationDays: schema.aliases.hydrationDays,
      source: schema.aliases.source,
      target: schema.aliases.targetValue,
      ratio: "__ratio_pct",
      gap: "__gap_value",
    },
    localOptions,
    groupDefaults: buildGroupDefaults(schema),
    tableColumns,
    rows: tableRows,
  };
}

function isUnavailableSchemaError(error: unknown) {
  return error instanceof Error
    && (
      error.message.includes("No se encontro la vista")
      || ((error as Error & { code?: string }).code === "42P01")
    );
}

export function normalizeBalanzasFilters(
  rawFilters: Partial<Record<keyof BalanzasFilters, string | undefined>> = {},
): BalanzasFilters {
  return {
    metric: normalizeMetric(rawFilters.metric),
    year: normalizeSelectValue(rawFilters.year),
    month: normalizeSelectValue(rawFilters.month),
    dayName: normalizeSelectValue(rawFilters.dayName),
    destination: normalizeSelectValue(rawFilters.destination),
    weekMode: "iso",
    weekValue: normalizeSelectValue(rawFilters.weekValue),
    dateFrom: normalizeDateValue(rawFilters.dateFrom),
    dateTo: normalizeDateValue(rawFilters.dateTo),
  };
}

function applyLatestIsoWeek(filters: BalanzasFilters, options: BalanzasFilterOptions) {
  if (filters.weekMode !== "iso") {
    return filters;
  }

  const availableIsoWeeks = options.isoWeeks;
  const selectedWeeks = decodeMultiSelectValue(filters.weekValue)
    .filter((week) => availableIsoWeeks.includes(week));
  const fallbackWeek = availableIsoWeeks[0] ? [availableIsoWeeks[0]] : [];

  return {
    ...filters,
    weekValue: encodeMultiSelectValue(selectedWeeks.length ? selectedWeeks : fallbackWeek),
  } satisfies BalanzasFilters;
}

export function createEmptyBalanzasDashboardData(
  filters: BalanzasFilters,
  statusMessage: string | null = null,
): BalanzasDashboardData {
  return {
    generatedAt: new Date().toISOString(),
    processAssetPath: BALANZAS_PROCESS_ASSET,
    metric: filters.metric,
    metricLabel: buildMetricLabel(filters.metric),
    filters,
    options: {
      years: [],
      months: [],
      preWeeks: [],
      isoWeeks: [],
      dayNames: [],
      destinations: [],
    },
    summary: {
      totalNodes: BALANZAS_PROCESS_NODES.length,
      readyNodes: 0,
      totalRows: 0,
      latestDate: null,
      periodLabel: buildNodePeriodLabel(filters),
      destinationLabel: filters.destination === "all" ? `Todos | ${BALANZAS_DESTINATION_LABEL}` : filters.destination,
      scopeLabel: BALANZAS_SCOPE_LABEL,
      scopeNote: BALANZAS_SCOPE_NOTE,
      statusMessage,
    },
    nodes: BALANZAS_PROCESS_NODES.map((node) =>
      createUnavailableNodeData(node, filters, statusMessage ?? "Indicador no disponible."),
    ),
  };
}

export async function getBalanzasDashboardData(
  rawFilters: Partial<Record<keyof BalanzasFilters, string | undefined>> = {},
): Promise<BalanzasDashboardData> {
  const filters = normalizeBalanzasFilters(rawFilters);

  try {
    return await cachedAsync(
      `postcosecha:balanzas:${serializeFilters(filters)}`,
      BALANZAS_DASHBOARD_TTL_MS,
      async () => {
        const options = await getBalanzasFilterOptions(filters.metric);
        const effectiveFilters = applyLatestIsoWeek(filters, options);
        const nodes = await Promise.all(BALANZAS_PROCESS_NODES.map((node) => buildNodeData(node, effectiveFilters)));
        const readyNodes = nodes.filter((node) => node.status === "ready");
        const latestDates = readyNodes
          .map((node) => node.latestDate)
          .filter((value): value is string => Boolean(value))
          .sort();

        return {
          generatedAt: new Date().toISOString(),
          processAssetPath: BALANZAS_PROCESS_ASSET,
          metric: effectiveFilters.metric,
          metricLabel: buildMetricLabel(effectiveFilters.metric),
          filters: effectiveFilters,
          options,
          summary: {
            totalNodes: nodes.length,
            readyNodes: readyNodes.length,
            totalRows: readyNodes.reduce((sum, node) => sum + node.rowCount, 0),
            latestDate: latestDates.length ? latestDates[latestDates.length - 1] ?? null : null,
            periodLabel: buildNodePeriodLabel(effectiveFilters),
            destinationLabel: effectiveFilters.destination === "all" ? `Todos | ${BALANZAS_DESTINATION_LABEL}` : effectiveFilters.destination,
            scopeLabel: BALANZAS_SCOPE_LABEL,
            scopeNote: BALANZAS_SCOPE_NOTE,
            statusMessage: readyNodes.length
              ? null
              : "Ningun nodo tiene una vista disponible para la combinacion actual de filtros.",
          },
          nodes,
        } satisfies BalanzasDashboardData;
      },
    );
  } catch (error) {
    if (isUnavailableSchemaError(error)) {
      return createEmptyBalanzasDashboardData(
        filters,
        error instanceof Error ? error.message : "No se pudo consultar las vistas de Balanzas.",
      );
    }

    throw error;
  }
}
