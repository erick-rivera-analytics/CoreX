import "server-only";

import { query } from "@/lib/db";
import { cachedAsync } from "@/lib/server-cache";
import { decodeMultiSelectValue, encodeMultiSelectValue } from "@/lib/multi-select";
import { formatFlexibleNumber, formatPercent as formatPercentShared } from "@/shared/lib/format";
import { toNumber } from "@/shared/lib/number-utils";

// ─── Public types ─────────────────────────────────────────────────────────────

export type BalanzasFilters = {
  weekValue: string;  // comma-sep YYWW e.g. "2617,2616"; "all" = sin filtro
  month: string;      // comma-sep mes numérico "4,8"; "all" = sin filtro
  year: string;       // comma-sep año "2025,2026"; "all" = sin filtro
  dateFrom: string;   // "YYYY-MM-DD" o ""
  dateTo: string;     // "YYYY-MM-DD" o ""
  farm: string;       // "xl" | "cl" | "zn"
};

export type SelectOption = { value: string; label: string };

export type BalanzasFilterOptions = {
  weeks: SelectOption[];
  months: SelectOption[];
  years: SelectOption[];
};

export type BalanzasSummaryMetric = {
  col: string;
  label: string;
  value: number | null;
  formatted: string;
};

export type BalanzasDetailColumnFormat = "kg" | "g" | "pct" | "count" | "ratio";
export type BalanzasDetailAggregateMode = "sum" | "derived-ratio" | "derived-quotient";

export type BalanzasDetailAggregateSources = {
  numeratorKey: string;
  denominatorKey: string;
};

export type BalanzasDetailColumn = {
  key: string;
  label: string;
  numeric: boolean;
  format: BalanzasDetailColumnFormat | null;
  aggregateMode: BalanzasDetailAggregateMode | null;
  aggregateSources?: BalanzasDetailAggregateSources;
};

export type BalanzasDetailTableMode = "tree" | "flat";

export type BalanzasDetailDateFilterKey = "work_date" | "lot_date";

/**
 * Categoría de destino canónica (Arcoíris / Blanco / Tinturado).
 * Usada para el split visual en BPMN de los nodos terminales B2A/B3.
 */
export type BalanzasDestinationKey = "arcoiris" | "blanco" | "tinturado";

/**
 * Mapeo opcional de un nodo de datos a 3 BPMN tasks (uno por destino).
 *
 * Cuando está presente, el explorer genera 3 overlays virtuales clickeables
 * en lugar de 1, cada uno pre-aplicando el filtro `destination` correspondiente
 * en el modal de detalle. Solo aplica a nodos terminales (B2A/B3) según el
 * BPMN canónico de balanzas.
 */
export type BalanzasBpmnByDestination = Record<BalanzasDestinationKey, string>;

export type BalanzasNodeSummary = {
  key: string;
  label: string;
  shortLabel: string;
  /**
   * Título canónico que se usa en el header del modal de detalle.
   * Formato: `<Rama> - <Comparación> - <Métrica>`.
   * Ejemplos: `Apertura - B1 vs B1C - Peso`, `Preclasificación - B2 vs B3 - Peso`.
   */
  dialogTitle: string;
  branch: "preclasif" | "gv" | "apertura";
  active: boolean;
  detailTableMode: BalanzasDetailTableMode;
  rowCount: number;
  dateMin: string | null;
  dateMax: string | null;
  metrics: BalanzasSummaryMetric[];
  bpmnElementId: string | null;
  overlayOffsetLeft: number;
  /**
   * Cuando está definido, el explorer genera 3 overlays virtuales (uno por
   * destino: Arcoíris / Blanco / Tinturado) en lugar de 1 sobre el
   * `bpmnElementId` principal. Cada overlay abre el modal con el filtro
   * `destination` pre-aplicado.
   */
  bpmnByDestination?: BalanzasBpmnByDestination;
};

export type BalanzasDashboardData = {
  filters: BalanzasFilters;
  options: BalanzasFilterOptions;
  nodes: BalanzasNodeSummary[];
};

export type BalanzasDetailRow = Record<string, unknown>;

export type BalanzasNodeDetail = {
  nodeKey: string;
  nodeLabel: string;
  branch: string;
  active: boolean;
  tableMode: BalanzasDetailTableMode;
  dateFilterKeys: BalanzasDetailDateFilterKey[];
  rows: BalanzasDetailRow[];
  columns: BalanzasDetailColumn[];
  destinations: string[];
  grades: string[];
  gradeGroups: string[];
  rowCount: number;
  metrics: BalanzasSummaryMetric[];
};

// ─── Internal types ───────────────────────────────────────────────────────────

type AggType = "sum" | "avg";

type BalanzasBpmnBinding = {
  elementId: string;
  overlayOffsetLeft: number;
};

type SummaryMetricDef = {
  col: string;
  label: string;
  format: BalanzasDetailColumnFormat;
  agg?: AggType;
  aggregateMode?: BalanzasDetailAggregateMode;
  aggregateSources?: BalanzasDetailAggregateSources;
};

type BalanzasDetailColumnConfig = {
  format: BalanzasDetailColumnFormat;
  aggregateMode: BalanzasDetailAggregateMode;
  aggregateSources?: BalanzasDetailAggregateSources;
};

type BalanzasNodeDef = {
  key: string;
  label: string;
  shortLabel: string;
  dialogTitle: string;
  branch: "preclasif" | "gv" | "apertura";
  active: boolean;
  viewName: string;
  dateCol: "work_date" | "lot_date";
  summaryMetrics: SummaryMetricDef[];
  detailColumnConfig?: Record<string, BalanzasDetailColumnConfig>;
  detailTableMode?: BalanzasDetailTableMode;
  detailVisibleColumns?: string[];
  detailColumnLabels?: Record<string, string>;
  detailDateFilterKeys?: BalanzasDetailDateFilterKey[];
  hasDestination: boolean;
  hasGrade: boolean;
  hasGradeGroup: boolean;
  bpmnBinding: BalanzasBpmnBinding | null;
  /**
   * Mapeo opcional a 3 BPMN tasks por destino (Arcoíris / Blanco / Tinturado).
   * Cuando está presente, el cliente genera 3 overlays virtuales en lugar de 1.
   */
  bpmnByDestination?: BalanzasBpmnByDestination;
};

const B2_B2A_WEIGHT_SUMMARY_METRICS: SummaryMetricDef[] = [
  { col: "weight_b2_kg", label: "B2 kg", agg: "sum", format: "kg" },
  { col: "weight_b2a_kg", label: "B2A kg", agg: "sum", format: "kg" },
  {
    col: "dispatch_pct",
    label: "Desperdicio %",
    format: "pct",
    aggregateMode: "derived-ratio",
    aggregateSources: {
      numeratorKey: "weight_b2a_kg",
      denominatorKey: "weight_b2_kg",
    },
  },
];

const B2_B2A_WEIGHT_DETAIL_COLUMN_CONFIG: Record<string, BalanzasDetailColumnConfig> = {
  weight_b2_kg: {
    format: "kg",
    aggregateMode: "sum",
  },
  weight_b2a_kg: {
    format: "kg",
    aggregateMode: "sum",
  },
  dispatch_pct: {
    format: "pct",
    aggregateMode: "derived-ratio",
    aggregateSources: {
      numeratorKey: "weight_b2a_kg",
      denominatorKey: "weight_b2_kg",
    },
  },
};

const B2_B2A_WEIGHT_DETAIL_VISIBLE_COLUMNS = [
  "work_date",
  "lot_date",
  "destination",
  "weight_b2_kg",
  "weight_b2a_kg",
  "dispatch_pct",
];

const B2_B2A_WEIGHT_DETAIL_COLUMN_LABELS: Record<string, string> = {
  work_date: "Fecha_entrega",
  lot_date: "Lote",
  destination: "Destino",
  weight_b2_kg: "Peso_B2",
  weight_b2a_kg: "Peso_B2A",
  dispatch_pct: "%Desp_Peso",
};

const B2_B2A_WEIGHT_DETAIL_DATE_FILTER_KEYS: BalanzasDetailDateFilterKey[] = ["work_date", "lot_date"];

const B1C_B2A_IDEAL_SUMMARY_METRICS: SummaryMetricDef[] = [
  { col: "weight_b1c_kg", label: "Peso_B1C", agg: "sum", format: "kg" },
  { col: "weight_b2_kg", label: "Peso_B2", agg: "sum", format: "kg" },
  {
    col: "hydration_pct",
    label: "HIDR%",
    format: "pct",
    aggregateMode: "derived-ratio",
    aggregateSources: {
      numeratorKey: "weight_b2_kg",
      denominatorKey: "weight_b1c_kg",
    },
  },
  { col: "weight_b2a_kg", label: "Peso_B2A", agg: "sum", format: "kg" },
  {
    col: "dispatch_pct",
    label: "Desp%",
    format: "pct",
    aggregateMode: "derived-ratio",
    aggregateSources: {
      numeratorKey: "weight_b2a_kg",
      denominatorKey: "weight_b2_kg",
    },
  },
  { col: "ideal_weight_kg", label: "Peso_Ideal", agg: "sum", format: "kg" },
  {
    col: "b2a_to_ideal_ratio",
    label: "Dif_Peso%",
    format: "pct",
    aggregateMode: "derived-quotient",
    aggregateSources: {
      numeratorKey: "weight_b2a_kg",
      denominatorKey: "ideal_weight_kg",
    },
  },
  {
    col: "b2a_to_b1c_ratio",
    label: "Aprovechamiento %_1cvs2A",
    format: "pct",
    aggregateMode: "derived-quotient",
    aggregateSources: {
      numeratorKey: "weight_b2a_kg",
      denominatorKey: "weight_b1c_kg",
    },
  },
  {
    col: "ideal_to_b1c_ratio",
    label: "Aprovechamiento %_1cvsPesoIdeal",
    format: "pct",
    aggregateMode: "derived-quotient",
    aggregateSources: {
      numeratorKey: "ideal_weight_kg",
      denominatorKey: "weight_b1c_kg",
    },
  },
];

const B1C_B2A_IDEAL_DETAIL_COLUMN_CONFIG: Record<string, BalanzasDetailColumnConfig> = {
  weight_b1c_kg: {
    format: "kg",
    aggregateMode: "sum",
  },
  weight_b2_kg: {
    format: "kg",
    aggregateMode: "sum",
  },
  hydration_pct: {
    format: "pct",
    aggregateMode: "derived-ratio",
    aggregateSources: {
      numeratorKey: "weight_b2_kg",
      denominatorKey: "weight_b1c_kg",
    },
  },
  weight_b2a_kg: {
    format: "kg",
    aggregateMode: "sum",
  },
  dispatch_pct: {
    format: "pct",
    aggregateMode: "derived-ratio",
    aggregateSources: {
      numeratorKey: "weight_b2a_kg",
      denominatorKey: "weight_b2_kg",
    },
  },
  ideal_weight_kg: {
    format: "kg",
    aggregateMode: "sum",
  },
  b2a_to_ideal_ratio: {
    format: "pct",
    aggregateMode: "derived-quotient",
    aggregateSources: {
      numeratorKey: "weight_b2a_kg",
      denominatorKey: "ideal_weight_kg",
    },
  },
  b2a_to_b1c_ratio: {
    format: "pct",
    aggregateMode: "derived-quotient",
    aggregateSources: {
      numeratorKey: "weight_b2a_kg",
      denominatorKey: "weight_b1c_kg",
    },
  },
  ideal_to_b1c_ratio: {
    format: "pct",
    aggregateMode: "derived-quotient",
    aggregateSources: {
      numeratorKey: "ideal_weight_kg",
      denominatorKey: "weight_b1c_kg",
    },
  },
};

const B1C_B2A_IDEAL_DETAIL_VISIBLE_COLUMNS = [
  "work_date",
  "destination",
  "weight_b1c_kg",
  "weight_b2_kg",
  "hydration_pct",
  "weight_b2a_kg",
  "dispatch_pct",
  "ideal_weight_kg",
  "b2a_to_ideal_ratio",
  "b2a_to_b1c_ratio",
  "ideal_to_b1c_ratio",
];

const B1C_B2A_IDEAL_DETAIL_COLUMN_LABELS: Record<string, string> = {
  work_date: "Fecha",
  destination: "Tipo",
  weight_b1c_kg: "Peso_B1C",
  weight_b2_kg: "Peso_B2",
  hydration_pct: "HIDR%",
  weight_b2a_kg: "Peso_B2A",
  dispatch_pct: "Desp%",
  ideal_weight_kg: "Peso_Ideal",
  b2a_to_ideal_ratio: "Dif_Peso%",
  b2a_to_b1c_ratio: "Aprovechamiento %_1cvs2A",
  ideal_to_b1c_ratio: "Aprovechamiento %_1cvsPesoIdeal",
};

const B1C_B2A_IDEAL_DETAIL_DATE_FILTER_KEYS: BalanzasDetailDateFilterKey[] = ["work_date"];

const PRECLASIF_B1_B1A_WEIGHT_SUMMARY_METRICS: SummaryMetricDef[] = [
  { col: "weight_b1_kg", label: "Peso_B1", agg: "sum", format: "kg" },
  { col: "weight_b1ab_kg", label: "Peso_B1A", agg: "sum", format: "kg" },
  {
    col: "dispatch_pct_weight",
    label: "Desp%",
    format: "pct",
    aggregateMode: "derived-ratio",
    aggregateSources: {
      numeratorKey: "weight_b1ab_kg",
      denominatorKey: "weight_b1_kg",
    },
  },
];

const PRECLASIF_B1_B1A_WEIGHT_DETAIL_COLUMN_CONFIG: Record<string, BalanzasDetailColumnConfig> = {
  weight_b1_kg: {
    format: "kg",
    aggregateMode: "sum",
  },
  weight_b1ab_kg: {
    format: "kg",
    aggregateMode: "sum",
  },
  dispatch_pct_weight: {
    format: "pct",
    aggregateMode: "derived-ratio",
    aggregateSources: {
      numeratorKey: "weight_b1ab_kg",
      denominatorKey: "weight_b1_kg",
    },
  },
};

const PRECLASIF_B1_B1A_WEIGHT_DETAIL_VISIBLE_COLUMNS = [
  "work_date",
  "destination",
  "weight_b1_kg",
  "weight_b1ab_kg",
  "dispatch_pct_weight",
];

const PRECLASIF_B1_B1A_WEIGHT_DETAIL_COLUMN_LABELS: Record<string, string> = {
  work_date: "Fecha",
  destination: "Destino",
  weight_b1_kg: "Peso_B1",
  weight_b1ab_kg: "Peso_B1A",
  dispatch_pct_weight: "Desp%",
};

const PRECLASIF_B1_B1A_WEIGHT_DETAIL_DATE_FILTER_KEYS: BalanzasDetailDateFilterKey[] = ["work_date"];

const PRECLASIF_B1A_B2_WEIGHT_SUMMARY_METRICS: SummaryMetricDef[] = [
  { col: "weight_b1ab_est", label: "Peso_B1A", agg: "sum", format: "kg" },
  { col: "weight_b2", label: "Peso_B2", agg: "sum", format: "kg" },
  {
    col: "hydration_pct",
    label: "HIDR%",
    format: "pct",
    aggregateMode: "derived-ratio",
    aggregateSources: {
      numeratorKey: "weight_b2",
      denominatorKey: "weight_b1ab_est",
    },
  },
];

const PRECLASIF_B1A_B2_WEIGHT_DETAIL_COLUMN_CONFIG: Record<string, BalanzasDetailColumnConfig> = {
  weight_per_stem_b1ab: {
    format: "g",
    aggregateMode: "sum",
  },
  weight_b1ab_est: {
    format: "kg",
    aggregateMode: "sum",
  },
  weight_b2: {
    format: "kg",
    aggregateMode: "sum",
  },
  hydration_pct: {
    format: "pct",
    aggregateMode: "derived-ratio",
    aggregateSources: {
      numeratorKey: "weight_b2",
      denominatorKey: "weight_b1ab_est",
    },
  },
};

const PRECLASIF_B1A_B2_WEIGHT_DETAIL_VISIBLE_COLUMNS = [
  "work_date",
  "lot_date",
  "destination",
  "weight_per_stem_b1ab",
  "weight_b1ab_est",
  "weight_b2",
  "hydration_pct",
];

const PRECLASIF_B1A_B2_WEIGHT_DETAIL_COLUMN_LABELS: Record<string, string> = {
  work_date: "Fecha",
  lot_date: "Lote",
  destination: "Destino",
  weight_per_stem_b1ab: "Peso / Tallo",
  weight_b1ab_est: "Peso_B1A",
  weight_b2: "Peso_B2",
  hydration_pct: "HIDR%",
};

const PRECLASIF_B1A_B2_WEIGHT_DETAIL_DATE_FILTER_KEYS: BalanzasDetailDateFilterKey[] = ["work_date", "lot_date"];

const PRECLASIF_B2_B3_WEIGHT_SUMMARY_METRICS: SummaryMetricDef[] = [
  { col: "weight_b2_kg", label: "Peso_B2", agg: "sum", format: "kg" },
  { col: "weight_b3_kg", label: "Peso_B3", agg: "sum", format: "kg" },
  {
    col: "diff_pct_weight",
    label: "%Dif_Peso",
    format: "pct",
    aggregateMode: "derived-ratio",
    aggregateSources: {
      numeratorKey: "weight_b3_kg",
      denominatorKey: "weight_b2_kg",
    },
  },
  { col: "weight_ideal_kg", label: "Peso_Ideal", agg: "sum", format: "kg" },
];

const PRECLASIF_B2_B3_WEIGHT_DETAIL_COLUMN_CONFIG: Record<string, BalanzasDetailColumnConfig> = {
  weight_b2_kg: {
    format: "kg",
    aggregateMode: "sum",
  },
  weight_b3_kg: {
    format: "kg",
    aggregateMode: "sum",
  },
  diff_pct_weight: {
    format: "pct",
    aggregateMode: "derived-ratio",
    aggregateSources: {
      numeratorKey: "weight_b3_kg",
      denominatorKey: "weight_b2_kg",
    },
  },
  weight_ideal_kg: {
    format: "kg",
    aggregateMode: "sum",
  },
};

const PRECLASIF_B2_B3_WEIGHT_DETAIL_VISIBLE_COLUMNS = [
  "lot_date",
  "destination",
  "weight_b2_kg",
  "weight_b3_kg",
  "diff_pct_weight",
  "weight_ideal_kg",
];

const PRECLASIF_B2_B3_WEIGHT_DETAIL_COLUMN_LABELS: Record<string, string> = {
  lot_date: "Lote",
  destination: "Destino",
  weight_b2_kg: "Peso_B2",
  weight_b3_kg: "Peso_B3",
  diff_pct_weight: "%Dif_Peso",
  weight_ideal_kg: "Peso_Ideal",
};

const PRECLASIF_B2_B3_WEIGHT_DETAIL_DATE_FILTER_KEYS: BalanzasDetailDateFilterKey[] = ["lot_date"];

const PRECLASIF_B1_B3_IDEAL_SUMMARY_METRICS: SummaryMetricDef[] = [
  { col: "weight_b1_kg", label: "Peso_B1", agg: "sum", format: "kg" },
  { col: "weight_b1ab_kg", label: "Peso_B1A", agg: "sum", format: "kg" },
  {
    col: "dispatch_1_pct",
    label: "Desp%",
    format: "pct",
    aggregateMode: "derived-ratio",
    aggregateSources: {
      numeratorKey: "weight_b1ab_kg",
      denominatorKey: "weight_b1_kg",
    },
  },
  { col: "weight_b2_kg", label: "Peso_B2", agg: "sum", format: "kg" },
  {
    col: "hydration_pct",
    label: "HIDR%",
    format: "pct",
    aggregateMode: "derived-ratio",
    aggregateSources: {
      numeratorKey: "weight_b2_kg",
      denominatorKey: "weight_b1ab_kg",
    },
  },
  { col: "weight_b3_kg", label: "Peso_B3", agg: "sum", format: "kg" },
  {
    col: "dispatch_2_pct",
    label: "Desp2%",
    format: "pct",
    aggregateMode: "derived-ratio",
    aggregateSources: {
      numeratorKey: "weight_b3_kg",
      denominatorKey: "weight_b2_kg",
    },
  },
  { col: "weight_ideal_kg", label: "Peso_Ideal", agg: "sum", format: "kg" },
  {
    col: "yield_b1_vs_b3",
    label: "Aprovechamiento_B1VSB3",
    format: "pct",
    aggregateMode: "derived-quotient",
    aggregateSources: {
      numeratorKey: "weight_b3_kg",
      denominatorKey: "weight_b1_kg",
    },
  },
  {
    col: "yield_b1_vs_ideal",
    label: "Aprovechamiento_B1 VS PESO",
    format: "pct",
    aggregateMode: "derived-quotient",
    aggregateSources: {
      numeratorKey: "weight_ideal_kg",
      denominatorKey: "weight_b1_kg",
    },
  },
];

const PRECLASIF_B1_B3_IDEAL_DETAIL_COLUMN_CONFIG: Record<string, BalanzasDetailColumnConfig> = {
  weight_b1_kg: {
    format: "kg",
    aggregateMode: "sum",
  },
  weight_b1ab_kg: {
    format: "kg",
    aggregateMode: "sum",
  },
  dispatch_1_pct: {
    format: "pct",
    aggregateMode: "derived-ratio",
    aggregateSources: {
      numeratorKey: "weight_b1ab_kg",
      denominatorKey: "weight_b1_kg",
    },
  },
  weight_b2_kg: {
    format: "kg",
    aggregateMode: "sum",
  },
  hydration_pct: {
    format: "pct",
    aggregateMode: "derived-ratio",
    aggregateSources: {
      numeratorKey: "weight_b2_kg",
      denominatorKey: "weight_b1ab_kg",
    },
  },
  weight_b3_kg: {
    format: "kg",
    aggregateMode: "sum",
  },
  dispatch_2_pct: {
    format: "pct",
    aggregateMode: "derived-ratio",
    aggregateSources: {
      numeratorKey: "weight_b3_kg",
      denominatorKey: "weight_b2_kg",
    },
  },
  weight_ideal_kg: {
    format: "kg",
    aggregateMode: "sum",
  },
  yield_b1_vs_b3: {
    format: "pct",
    aggregateMode: "derived-quotient",
    aggregateSources: {
      numeratorKey: "weight_b3_kg",
      denominatorKey: "weight_b1_kg",
    },
  },
  yield_b1_vs_ideal: {
    format: "pct",
    aggregateMode: "derived-quotient",
    aggregateSources: {
      numeratorKey: "weight_ideal_kg",
      denominatorKey: "weight_b1_kg",
    },
  },
};

const PRECLASIF_B1_B3_IDEAL_DETAIL_VISIBLE_COLUMNS = [
  "work_date",
  "destination",
  "weight_b1_kg",
  "weight_b1ab_kg",
  "dispatch_1_pct",
  "weight_b2_kg",
  "hydration_pct",
  "weight_b3_kg",
  "dispatch_2_pct",
  "weight_ideal_kg",
  "yield_b1_vs_b3",
  "yield_b1_vs_ideal",
];

const PRECLASIF_B1_B3_IDEAL_DETAIL_COLUMN_LABELS: Record<string, string> = {
  work_date: "Fecha",
  destination: "Destino",
  weight_b1_kg: "Peso_B1",
  weight_b1ab_kg: "Peso_B1A",
  dispatch_1_pct: "Desp%",
  weight_b2_kg: "Peso_B2",
  hydration_pct: "HIDR%",
  weight_b3_kg: "Peso_B3",
  dispatch_2_pct: "Desp2%",
  weight_ideal_kg: "Peso_Ideal",
  yield_b1_vs_b3: "Aprovechamiento_B1VSB3",
  yield_b1_vs_ideal: "Aprovechamiento_B1 VS PESO",
};

const PRECLASIF_B1_B3_IDEAL_DETAIL_DATE_FILTER_KEYS: BalanzasDetailDateFilterKey[] = ["work_date"];

// ─── ISO week helpers ─────────────────────────────────────────────────────────

function isoWeekYear(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dow = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dow);
  return d.getUTCFullYear();
}

function isoWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dow = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dow);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function toYYWW(date: Date): string {
  const yy = isoWeekYear(date) % 100;
  const ww = isoWeekNumber(date);
  return String(yy).padStart(2, "0") + String(ww).padStart(2, "0");
}

export function formatWeekLabel(yyww: string): string {
  // Formato canónico de semana en CoreX: `YYWW` (4 dígitos: 2 año + 2 semana).
  // Devolvemos el valor crudo para que el usuario lo vea como `2614`, `2613`, etc.
  return yyww;
}

// ─── Month helpers ────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export function formatMonthName(monthNum: string): string {
  const n = parseInt(monthNum, 10);
  if (Number.isFinite(n) && n >= 1 && n <= 12) return MONTH_NAMES[n - 1] ?? monthNum;
  return monthNum;
}

// ─── Metric formatting ────────────────────────────────────────────────────────

function formatMetricValue(value: number | null, format: BalanzasDetailColumnFormat): string {
  if (value === null) return "—";
  switch (format) {
    case "kg": return formatFlexibleNumber(value) + " kg";
    case "g": return formatFlexibleNumber(value * 1000) + " g";
    case "pct": return formatPercentShared(value, { input: "ratio" });
    case "count": return formatFlexibleNumber(value);
    case "ratio": return formatPercentShared(value, { input: "ratio" });
  }
}

function buildSummaryMetricSelects(summaryMetrics: SummaryMetricDef[]) {
  const selectMap = new Map<string, string>();

  for (const metric of summaryMetrics) {
    if (
      (metric.aggregateMode === "derived-ratio" || metric.aggregateMode === "derived-quotient")
      && metric.aggregateSources
    ) {
      const numeratorAlias = `__sum_${metric.aggregateSources.numeratorKey}`;
      const denominatorAlias = `__sum_${metric.aggregateSources.denominatorKey}`;

      if (!selectMap.has(numeratorAlias)) {
        selectMap.set(
          numeratorAlias,
          `SUM(${metric.aggregateSources.numeratorKey}::numeric) AS ${numeratorAlias}`,
        );
      }
      if (!selectMap.has(denominatorAlias)) {
        selectMap.set(
          denominatorAlias,
          `SUM(${metric.aggregateSources.denominatorKey}::numeric) AS ${denominatorAlias}`,
        );
      }
      continue;
    }

    const aggregate = metric.agg === "avg" ? "AVG" : "SUM";
    selectMap.set(metric.col, `${aggregate}(${metric.col}::numeric) AS ${metric.col}`);
  }

  return Array.from(selectMap.values()).join(", ");
}

function resolveSummaryMetricValue(row: Record<string, unknown>, metric: SummaryMetricDef) {
  if (
    (metric.aggregateMode === "derived-ratio" || metric.aggregateMode === "derived-quotient")
    && metric.aggregateSources
  ) {
    const numerator = toNumber(row[`__sum_${metric.aggregateSources.numeratorKey}`]);
    const denominator = toNumber(row[`__sum_${metric.aggregateSources.denominatorKey}`]);

    if (numerator === null || denominator === null || denominator === 0) {
      return null;
    }

    return metric.aggregateMode === "derived-ratio"
      ? (numerator / denominator) - 1
      : numerator / denominator;
  }

  return toNumber(row[metric.col]);
}

function columnLabelForNode(nodeDef: BalanzasNodeDef, key: string) {
  return nodeDef.detailColumnLabels?.[key] ?? columnLabel(key);
}

type BalanzasDetailLocalFilters = {
  destinations: string[];
  grades: string[];
  gradeGroups: string[];
  workDateFrom?: string;
  workDateTo?: string;
  lotDateFrom?: string;
  lotDateTo?: string;
};

function applyLocalDetailFilters(
  nodeDef: BalanzasNodeDef,
  localFilters: BalanzasDetailLocalFilters,
  conditions: string[],
  values: unknown[],
) {
  if (localFilters.destinations.length > 0 && nodeDef.hasDestination) {
    values.push(localFilters.destinations);
    conditions.push(`destination = any($${values.length}::text[])`);
  }
  if (localFilters.grades.length > 0 && nodeDef.hasGrade) {
    values.push(localFilters.grades);
    conditions.push(`grade = any($${values.length}::text[])`);
  }
  if (localFilters.gradeGroups.length > 0 && nodeDef.hasGradeGroup) {
    values.push(localFilters.gradeGroups);
    conditions.push(`grade_group = any($${values.length}::text[])`);
  }

  if (localFilters.workDateFrom) {
    values.push(localFilters.workDateFrom);
    conditions.push(`work_date >= $${values.length}::date`);
  }
  if (localFilters.workDateTo) {
    values.push(localFilters.workDateTo);
    conditions.push(`work_date <= $${values.length}::date`);
  }
  if (localFilters.lotDateFrom) {
    values.push(localFilters.lotDateFrom);
    conditions.push(`lot_date >= $${values.length}::date`);
  }
  if (localFilters.lotDateTo) {
    values.push(localFilters.lotDateTo);
    conditions.push(`lot_date <= $${values.length}::date`);
  }
}

// ─── Node definitions (19 nodos, prefijo mv_ confirmado en DB) ───────────────

const VIEW_PREFIX = "gld.mv_camp_ind_bal_";

const BALANZAS_NODES: BalanzasNodeDef[] = [
  // ── PRECLASIFICACIÓN ──────────────────────────────────────────────────────
  {
    key: "preclasif-b1-b1a-stems",
    label: "B1 → B1AB (Tallos)",
    shortLabel: "Tallos",
    dialogTitle: "Preclasificación - B1 vs B1AB - Tallos",
    branch: "preclasif",
    active: true,
    viewName: `${VIEW_PREFIX}preclasif_b1_vs_b1a_xl_np_stems_cur`,
    dateCol: "work_date",
    summaryMetrics: [
      { col: "stems_b1",           label: "Tallos B1",   agg: "sum", format: "count" },
      { col: "stems_b1ab",         label: "Tallos B1AB",  agg: "sum", format: "count" },
      { col: "dispatch_pct_stems", label: "Despacho %",  agg: "avg", format: "pct" },
    ],
    hasDestination: true,
    hasGrade: false,
    hasGradeGroup: true,
    bpmnBinding: { elementId: "Task_B1AB_Pre_Directo", overlayOffsetLeft: 0 },
  },
  {
    key: "preclasif-b1-b1a-weight",
    label: "B1 → B1AB (Peso)",
    shortLabel: "Peso",
    dialogTitle: "Preclasificación - B1 vs B1AB - Peso",
    branch: "preclasif",
    active: true,
    viewName: `${VIEW_PREFIX}preclasif_b1_vs_b1a_xl_np_weight_cur`,
    dateCol: "work_date",
    summaryMetrics: PRECLASIF_B1_B1A_WEIGHT_SUMMARY_METRICS,
    detailColumnConfig: PRECLASIF_B1_B1A_WEIGHT_DETAIL_COLUMN_CONFIG,
    detailTableMode: "flat",
    detailVisibleColumns: PRECLASIF_B1_B1A_WEIGHT_DETAIL_VISIBLE_COLUMNS,
    detailColumnLabels: PRECLASIF_B1_B1A_WEIGHT_DETAIL_COLUMN_LABELS,
    detailDateFilterKeys: PRECLASIF_B1_B1A_WEIGHT_DETAIL_DATE_FILTER_KEYS,
    hasDestination: true,
    hasGrade: false,
    hasGradeGroup: true,
    bpmnBinding: { elementId: "Task_B1AB_Pre_Directo", overlayOffsetLeft: 172 },
  },
  {
    key: "preclasif-b1a-b2-stems",
    label: "B1AB → B2 (Tallos)",
    shortLabel: "Tallos",
    dialogTitle: "Preclasificación - B1AB vs B2 - Tallos",
    branch: "preclasif",
    active: true,
    viewName: `${VIEW_PREFIX}preclasif_b1a_vs_b2_xl_np_stems_cur`,
    dateCol: "lot_date",
    summaryMetrics: [
      { col: "stems_b1ab",      label: "Tallos B1AB",    agg: "sum", format: "count" },
      { col: "stems_b2",        label: "Tallos B2",     agg: "sum", format: "count" },
      { col: "diff_pct_stems",  label: "Diferencia %",  agg: "avg", format: "pct" },
    ],
    hasDestination: true,
    hasGrade: false,
    hasGradeGroup: true,
    bpmnBinding: { elementId: "Task_B2_Pre_Directo", overlayOffsetLeft: 0 },
  },
  {
    key: "preclasif-b1a-b2-weight",
    label: "B1AB → B2 (Peso)",
    shortLabel: "Peso",
    dialogTitle: "Preclasificación - B1AB vs B2 - Peso",
    branch: "preclasif",
    active: true,
    viewName: `${VIEW_PREFIX}preclasif_b1a_vs_b2_xl_np_weight_cur`,
    dateCol: "work_date",
    summaryMetrics: PRECLASIF_B1A_B2_WEIGHT_SUMMARY_METRICS,
    detailColumnConfig: PRECLASIF_B1A_B2_WEIGHT_DETAIL_COLUMN_CONFIG,
    detailTableMode: "flat",
    detailVisibleColumns: PRECLASIF_B1A_B2_WEIGHT_DETAIL_VISIBLE_COLUMNS,
    detailColumnLabels: PRECLASIF_B1A_B2_WEIGHT_DETAIL_COLUMN_LABELS,
    detailDateFilterKeys: PRECLASIF_B1A_B2_WEIGHT_DETAIL_DATE_FILTER_KEYS,
    hasDestination: true,
    hasGrade: false,
    hasGradeGroup: true,
    bpmnBinding: { elementId: "Task_B2_Pre_Directo", overlayOffsetLeft: 172 },
  },
  {
    key: "preclasif-b2-b3-weight",
    label: "B2 → B3 (Peso)",
    shortLabel: "B2 → B3",
    dialogTitle: "Preclasificación - B2 vs B3 - Peso",
    branch: "preclasif",
    active: true,
    viewName: `${VIEW_PREFIX}preclasif_b2_vs_b3_xl_np_weight_cur`,
    dateCol: "work_date",
    summaryMetrics: PRECLASIF_B2_B3_WEIGHT_SUMMARY_METRICS,
    detailColumnConfig: PRECLASIF_B2_B3_WEIGHT_DETAIL_COLUMN_CONFIG,
    detailTableMode: "flat",
    detailVisibleColumns: PRECLASIF_B2_B3_WEIGHT_DETAIL_VISIBLE_COLUMNS,
    detailColumnLabels: PRECLASIF_B2_B3_WEIGHT_DETAIL_COLUMN_LABELS,
    detailDateFilterKeys: PRECLASIF_B2_B3_WEIGHT_DETAIL_DATE_FILTER_KEYS,
    hasDestination: true,
    hasGrade: false,
    hasGradeGroup: false,
    bpmnBinding: { elementId: "Task_General_Pre_Directo", overlayOffsetLeft: 0 },
    bpmnByDestination: {
      arcoiris: "Task_B3_Pre_Directo_Arcoiris",
      blanco: "Task_B3_Pre_Directo_Blanco",
      tinturado: "Task_B3_Pre_Directo_Tinturado",
    },
  },
  {
    key: "preclasif-b1-b3-ideal",
    label: "B1 → B3 Ideal",
    shortLabel: "→ Ideal",
    dialogTitle: "Preclasificación - B1 vs B3 vs Peso ideal",
    branch: "preclasif",
    active: true,
    viewName: `${VIEW_PREFIX}preclasif_b1_vs_b3_ideal_weight_xl_np_cur`,
    dateCol: "work_date",
    summaryMetrics: PRECLASIF_B1_B3_IDEAL_SUMMARY_METRICS,
    detailColumnConfig: PRECLASIF_B1_B3_IDEAL_DETAIL_COLUMN_CONFIG,
    detailTableMode: "flat",
    detailVisibleColumns: PRECLASIF_B1_B3_IDEAL_DETAIL_VISIBLE_COLUMNS,
    detailColumnLabels: PRECLASIF_B1_B3_IDEAL_DETAIL_COLUMN_LABELS,
    detailDateFilterKeys: PRECLASIF_B1_B3_IDEAL_DETAIL_DATE_FILTER_KEYS,
    hasDestination: true,
    hasGrade: false,
    hasGradeGroup: false,
    bpmnBinding: { elementId: "Task_General_Pre_Directo", overlayOffsetLeft: 172 },
  },
  // ── COSECHA GV ────────────────────────────────────────────────────────────
  {
    key: "gv-b1-b1c-stems",
    label: "B1 → B1C (Tallos)",
    shortLabel: "Tallos",
    dialogTitle: "GV - B1 vs B1C - Tallos",
    branch: "gv",
    active: true,
    viewName: `${VIEW_PREFIX}gv_b1_vs_b1c_stems_xl_np_cur`,
    dateCol: "work_date",
    summaryMetrics: [
      { col: "stems_b1_count",  label: "Tallos B1",    agg: "sum", format: "count" },
      { col: "stems_b1c_count", label: "Tallos B1C",   agg: "sum", format: "count" },
      { col: "stems_diff_pct",  label: "Diferencia %", agg: "avg", format: "pct" },
    ],
    hasDestination: false,
    hasGrade: false,
    hasGradeGroup: false,
    bpmnBinding: { elementId: "Task_B1C_Apertura_GV", overlayOffsetLeft: 0 },
  },
  {
    key: "gv-b1-b1c-weight",
    label: "B1 → B1C (Peso)",
    shortLabel: "Peso",
    dialogTitle: "GV - B1 vs B1C - Peso",
    branch: "gv",
    active: true,
    viewName: `${VIEW_PREFIX}gv_b1_vs_b1c_weight_xl_np_cur`,
    dateCol: "work_date",
    summaryMetrics: [
      { col: "weight_b1_kg",    label: "B1 kg",        agg: "sum", format: "kg" },
      { col: "weight_b1c_kg",   label: "B1C kg",       agg: "sum", format: "kg" },
      { col: "weight_diff_pct", label: "Diferencia %", agg: "avg", format: "pct" },
    ],
    detailColumnConfig: {
      weight_b1_kg: {
        format: "kg",
        aggregateMode: "sum",
      },
      weight_b1c_kg: {
        format: "kg",
        aggregateMode: "sum",
      },
      weight_diff_pct: {
        format: "pct",
        aggregateMode: "derived-ratio",
        aggregateSources: {
          numeratorKey: "weight_b1c_kg",
          denominatorKey: "weight_b1_kg",
        },
      },
    },
    hasDestination: false,
    hasGrade: false,
    hasGradeGroup: false,
    bpmnBinding: { elementId: "Task_B1C_Apertura_GV", overlayOffsetLeft: 172 },
  },
  {
    key: "gv-b1c-b2-stems",
    label: "B1C → B2 (Tallos)",
    shortLabel: "Tallos",
    dialogTitle: "GV - B1C vs B2 - Tallos",
    branch: "gv",
    active: true,
    viewName: `${VIEW_PREFIX}gv_b1c_vs_b2_stems_xl_np_cur`,
    dateCol: "lot_date",
    summaryMetrics: [
      { col: "stems_b1c_count", label: "Tallos B1C",   agg: "sum", format: "count" },
      { col: "stems_b2_count",  label: "Tallos B2",    agg: "sum", format: "count" },
      { col: "stems_diff_pct",  label: "Diferencia %", agg: "avg", format: "pct" },
    ],
    hasDestination: false,
    hasGrade: true,
    hasGradeGroup: false,
    bpmnBinding: { elementId: "Task_B2_Apertura_Max10", overlayOffsetLeft: 0 },
  },
  {
    key: "gv-b1c-b2-weight",
    label: "B1C → B2 (Peso)",
    shortLabel: "Peso",
    dialogTitle: "GV - B1C vs B2 - Peso",
    branch: "gv",
    active: true,
    viewName: `${VIEW_PREFIX}gv_b1c_vs_b2_weight_xl_np_cur`,
    dateCol: "work_date",
    summaryMetrics: [
      { col: "weight_b2_kg",            label: "B2 kg",         agg: "sum", format: "kg" },
      { col: "weight_b1c_estimated_kg", label: "B1C est. kg",   agg: "sum", format: "kg" },
      {
        col: "hydration_pct",
        label: "Hidratación %",
        format: "pct",
        aggregateMode: "derived-ratio",
        aggregateSources: {
          numeratorKey: "weight_b2_kg",
          denominatorKey: "weight_b1c_estimated_kg",
        },
      },
    ],
      detailColumnConfig: {
        weight_per_stem_kg: {
          format: "g",
          aggregateMode: "sum",
        },
      weight_b2_kg: {
        format: "kg",
        aggregateMode: "sum",
      },
      weight_b1c_estimated_kg: {
        format: "kg",
        aggregateMode: "sum",
      },
      hydration_pct: {
        format: "pct",
        aggregateMode: "derived-ratio",
        aggregateSources: {
          numeratorKey: "weight_b2_kg",
          denominatorKey: "weight_b1c_estimated_kg",
        },
      },
    },
    detailTableMode: "flat",
    detailVisibleColumns: [
      "work_date",
      "lot_date",
      "grade",
      "destination",
      "weight_per_stem_kg",
      "weight_b2_kg",
      "weight_b1c_estimated_kg",
      "hydration_pct",
    ],
    detailColumnLabels: {
      work_date: "Fecha",
      lot_date: "Lote",
      grade: "Grado",
      destination: "Destino",
      weight_per_stem_kg: "Peso / Tallo",
      weight_b2_kg: "Peso_B2",
      weight_b1c_estimated_kg: "Peso_B1c",
      hydration_pct: "%HIDR",
    },
    detailDateFilterKeys: ["work_date", "lot_date"],
    hasDestination: true,
    hasGrade: true,
    hasGradeGroup: false,
    bpmnBinding: { elementId: "Task_B2_Apertura_Max10", overlayOffsetLeft: 172 },
  },
  {
    key: "gv-b2-b2a-weight",
    label: "B2 → B2A (Peso)",
    shortLabel: "B2 → B2A",
    dialogTitle: "GV - B2 vs B2A - Peso",
    branch: "gv",
    active: true,
    viewName: `${VIEW_PREFIX}gv_b2_vs_b2a_weight_xl_np_cur`,
    dateCol: "work_date",
    summaryMetrics: B2_B2A_WEIGHT_SUMMARY_METRICS,
    detailColumnConfig: B2_B2A_WEIGHT_DETAIL_COLUMN_CONFIG,
    detailTableMode: "flat",
    detailVisibleColumns: B2_B2A_WEIGHT_DETAIL_VISIBLE_COLUMNS,
    detailColumnLabels: B2_B2A_WEIGHT_DETAIL_COLUMN_LABELS,
    detailDateFilterKeys: B2_B2A_WEIGHT_DETAIL_DATE_FILTER_KEYS,
    hasDestination: true,
    hasGrade: false,
    hasGradeGroup: false,
    bpmnBinding: { elementId: "Task_General_Apertura_Max10", overlayOffsetLeft: 0 },
    bpmnByDestination: {
      arcoiris: "Task_B2A_Apertura_Max10_Arcoiris",
      blanco: "Task_B2A_Apertura_Max10_Blanco",
      tinturado: "Task_B2A_Apertura_Max10_Tinturado",
    },
  },
  {
    key: "gv-b1c-b2a-ideal",
    label: "B1C → B2A → Ideal",
    shortLabel: "→ Ideal",
    dialogTitle: "GV - B1 vs B2A vs Peso ideal - XLENCE",
    branch: "gv",
    active: true,
    viewName: `${VIEW_PREFIX}gv_b1c_vs_b2a_vs_ideal_weight_xl_np_cur`,
    dateCol: "work_date",
    summaryMetrics: B1C_B2A_IDEAL_SUMMARY_METRICS,
    detailColumnConfig: B1C_B2A_IDEAL_DETAIL_COLUMN_CONFIG,
    detailTableMode: "flat",
    detailVisibleColumns: B1C_B2A_IDEAL_DETAIL_VISIBLE_COLUMNS,
    detailColumnLabels: B1C_B2A_IDEAL_DETAIL_COLUMN_LABELS,
    detailDateFilterKeys: B1C_B2A_IDEAL_DETAIL_DATE_FILTER_KEYS,
    hasDestination: true,
    hasGrade: false,
    hasGradeGroup: false,
    bpmnBinding: { elementId: "Task_General_Apertura_Max10", overlayOffsetLeft: 172 },
  },
  // ── APERTURA (inactive — rama legacy) ────────────────────────────────────
  {
    key: "apertura-b1-b1c-stems",
    label: "B1 → B1C (Tallos)",
    shortLabel: "Tallos",
    dialogTitle: "Apertura - B1 vs B1C - Tallos",
    branch: "apertura",
    active: true,
    viewName: `${VIEW_PREFIX}apertura_b1_vs_b1c_stems_xl_np_cur`,
    dateCol: "work_date",
    summaryMetrics: [
      { col: "stems_b1_count",  label: "Tallos B1",    agg: "sum", format: "count" },
      { col: "stems_b1c_count", label: "Tallos B1C",   agg: "sum", format: "count" },
      { col: "stems_diff_pct",  label: "Diferencia %", agg: "avg", format: "pct" },
    ],
    hasDestination: false,
    hasGrade: false,
    hasGradeGroup: false,
    bpmnBinding: { elementId: "Task_B1C_Apertura_Directo", overlayOffsetLeft: 0 },
  },
  {
    key: "apertura-b1-b1c-weight",
    label: "B1 → B1C (Peso)",
    shortLabel: "Peso",
    dialogTitle: "Apertura - B1 vs B1C - Peso",
    branch: "apertura",
    active: true,
    viewName: `${VIEW_PREFIX}apertura_b1_vs_b1c_weight_xl_np_cur`,
    dateCol: "work_date",
    summaryMetrics: [
      { col: "weight_b1_kg",    label: "B1 kg",        agg: "sum", format: "kg" },
      { col: "weight_b1c_kg",   label: "B1C kg",       agg: "sum", format: "kg" },
      { col: "weight_diff_pct", label: "Diferencia %", agg: "avg", format: "pct" },
    ],
    detailColumnConfig: {
      weight_b1_kg: {
        format: "kg",
        aggregateMode: "sum",
      },
      weight_b1c_kg: {
        format: "kg",
        aggregateMode: "sum",
      },
      weight_diff_pct: {
        format: "pct",
        aggregateMode: "derived-ratio",
        aggregateSources: {
          numeratorKey: "weight_b1c_kg",
          denominatorKey: "weight_b1_kg",
        },
      },
    },
    hasDestination: false,
    hasGrade: false,
    hasGradeGroup: false,
    bpmnBinding: { elementId: "Task_B1C_Apertura_Directo", overlayOffsetLeft: 172 },
  },
  {
    key: "apertura-b1c-b2-stems",
    label: "B1C → B2 (Tallos)",
    shortLabel: "Tallos",
    dialogTitle: "Apertura - B1C vs B2 - Tallos",
    branch: "apertura",
    active: true,
    viewName: `${VIEW_PREFIX}apertura_b1c_vs_b2_stems_xl_np_cur`,
    dateCol: "lot_date",
    summaryMetrics: [
      { col: "stems_b1c_count", label: "Tallos B1C",   agg: "sum", format: "count" },
      { col: "stems_b2_count",  label: "Tallos B2",    agg: "sum", format: "count" },
      { col: "stems_diff_pct",  label: "Diferencia %", agg: "avg", format: "pct" },
    ],
    hasDestination: false,
    hasGrade: true,
    hasGradeGroup: false,
    bpmnBinding: { elementId: "Task_B2_Apertura_Directo", overlayOffsetLeft: 0 },
  },
  {
    key: "apertura-b1c-b2-weight",
    label: "B1C → B2 (Peso)",
    shortLabel: "Peso",
    dialogTitle: "Apertura - B1C vs B2 - Peso",
    branch: "apertura",
    active: true,
    viewName: `${VIEW_PREFIX}apertura_b1c_vs_b2_weight_xl_np_cur`,
    dateCol: "work_date",
    summaryMetrics: [
      { col: "weight_b2_kg",            label: "B2 kg",         agg: "sum", format: "kg" },
      { col: "weight_b1c_estimated_kg", label: "B1C est. kg",   agg: "sum", format: "kg" },
      {
        col: "hydration_pct",
        label: "Hidratación %",
        format: "pct",
        aggregateMode: "derived-ratio",
        aggregateSources: {
          numeratorKey: "weight_b2_kg",
          denominatorKey: "weight_b1c_estimated_kg",
        },
      },
    ],
      detailColumnConfig: {
        weight_per_stem_kg: {
          format: "g",
          aggregateMode: "sum",
        },
      weight_b2_kg: {
        format: "kg",
        aggregateMode: "sum",
      },
      weight_b1c_estimated_kg: {
        format: "kg",
        aggregateMode: "sum",
      },
      hydration_pct: {
        format: "pct",
        aggregateMode: "derived-ratio",
        aggregateSources: {
          numeratorKey: "weight_b2_kg",
          denominatorKey: "weight_b1c_estimated_kg",
        },
      },
    },
    detailTableMode: "flat",
    detailVisibleColumns: [
      "work_date",
      "lot_date",
      "grade",
      "destination",
      "weight_per_stem_kg",
      "weight_b2_kg",
      "weight_b1c_estimated_kg",
      "hydration_pct",
    ],
    detailColumnLabels: {
      work_date: "Fecha",
      lot_date: "Lote",
      grade: "Grado",
      destination: "Destino",
      weight_per_stem_kg: "Peso / Tallo",
      weight_b2_kg: "Peso_B2",
      weight_b1c_estimated_kg: "Peso_B1c",
      hydration_pct: "%HIDR",
    },
    detailDateFilterKeys: ["work_date", "lot_date"],
    hasDestination: true,
    hasGrade: true,
    hasGradeGroup: false,
    bpmnBinding: { elementId: "Task_B2_Apertura_Directo", overlayOffsetLeft: 172 },
  },
  {
    key: "apertura-b2-b2a-weight",
    label: "B2 → B2A (Peso)",
    shortLabel: "B2 → B2A",
    dialogTitle: "Apertura - B2 vs B2A - Peso",
    branch: "apertura",
    active: true,
    viewName: `${VIEW_PREFIX}apertura_b2_vs_b2a_weight_xl_np_cur`,
    dateCol: "work_date",
    summaryMetrics: B2_B2A_WEIGHT_SUMMARY_METRICS,
    detailColumnConfig: B2_B2A_WEIGHT_DETAIL_COLUMN_CONFIG,
    detailTableMode: "flat",
    detailVisibleColumns: B2_B2A_WEIGHT_DETAIL_VISIBLE_COLUMNS,
    detailColumnLabels: B2_B2A_WEIGHT_DETAIL_COLUMN_LABELS,
    detailDateFilterKeys: B2_B2A_WEIGHT_DETAIL_DATE_FILTER_KEYS,
    hasDestination: true,
    hasGrade: false,
    hasGradeGroup: false,
    bpmnBinding: { elementId: "Task_General_Apertura_Directo", overlayOffsetLeft: 0 },
    bpmnByDestination: {
      arcoiris: "Task_B2A_Apertura_Directo_Arcoiris",
      blanco: "Task_B2A_Apertura_Directo_Blanco",
      tinturado: "Task_B2A_Apertura_Directo_Tinturado",
    },
  },
  {
    key: "apertura-b1c-b2a-ideal",
    label: "B1C → B2A → Ideal",
    shortLabel: "→ Ideal",
    dialogTitle: "Apertura - B1 vs B2A vs Peso ideal - XLENCE",
    branch: "apertura",
    active: true,
    viewName: `${VIEW_PREFIX}apertura_b1c_vs_b2a_vs_ideal_weight_xl_np_cur`,
    dateCol: "work_date",
    summaryMetrics: B1C_B2A_IDEAL_SUMMARY_METRICS,
    detailColumnConfig: B1C_B2A_IDEAL_DETAIL_COLUMN_CONFIG,
    detailTableMode: "flat",
    detailVisibleColumns: B1C_B2A_IDEAL_DETAIL_VISIBLE_COLUMNS,
    detailColumnLabels: B1C_B2A_IDEAL_DETAIL_COLUMN_LABELS,
    detailDateFilterKeys: B1C_B2A_IDEAL_DETAIL_DATE_FILTER_KEYS,
    hasDestination: true,
    hasGrade: false,
    hasGradeGroup: false,
    bpmnBinding: { elementId: "Task_General_Apertura_Directo", overlayOffsetLeft: 0 },
  },
  {
    key: "apertura-b2a-ideal-grade",
    label: "B2A → Ideal × Grado",
    shortLabel: "B2A × Grado",
    dialogTitle: "Apertura - B2A vs Peso ideal por grado",
    branch: "apertura",
    active: true,
    viewName: `${VIEW_PREFIX}apertura_b2a_vs_ideal_weight_x_grade_xl_np_cur`,
    dateCol: "work_date",
    summaryMetrics: [
      { col: "weight_b2a_kg",      label: "B2A kg",    agg: "sum", format: "kg" },
      { col: "ideal_weight_kg",    label: "Ideal kg",  agg: "sum", format: "kg" },
      { col: "b2a_to_ideal_ratio", label: "B2A/Ideal", agg: "avg", format: "ratio" },
    ],
    hasDestination: true,
    hasGrade: true,
    hasGradeGroup: false,
    bpmnBinding: { elementId: "Task_General_Apertura_Directo", overlayOffsetLeft: 344 },
  },
];

// ─── Farm-aware node selection ───────────────────────────────────────────────

const FARM_NAMES: Record<string, string> = { xl: "XLENCE", cl: "CLOUD", zn: "ZINZI" };

function getNodesForFarm(farm: string): BalanzasNodeDef[] {
  if (farm === "cl" || farm === "zn") {
    const farmName = FARM_NAMES[farm] ?? farm.toUpperCase();
    return BALANZAS_NODES
      .filter((n) => n.branch === "apertura")
      .map((n) => ({
        ...n,
        viewName: n.viewName.replace("_xl_", `_${farm}_`),
        dialogTitle: n.dialogTitle.replace("XLENCE", farmName),
      }));
  }
  return BALANZAS_NODES;
}

// ─── SQL helpers ──────────────────────────────────────────────────────────────

function buildTemporalConditions(
  dateCol: string,
  filters: BalanzasFilters,
): { conditions: string[]; values: unknown[] } {
  const conditions: string[] = [];
  const values: unknown[] = [];

  if (filters.dateFrom) {
    values.push(filters.dateFrom);
    conditions.push(`${dateCol} >= $${values.length}::date`);
  }
  if (filters.dateTo) {
    values.push(filters.dateTo);
    conditions.push(`${dateCol} <= $${values.length}::date`);
  }

  const weeks = decodeMultiSelectValue(filters.weekValue);
  if (weeks.length > 0) {
    values.push(weeks);
    conditions.push(
      `(lpad((extract(isoyear from ${dateCol}) % 100)::int::text, 2, '0') || lpad(extract(week from ${dateCol})::int::text, 2, '0')) = any($${values.length}::text[])`,
    );
  }

  const months = decodeMultiSelectValue(filters.month);
  if (months.length > 0) {
    values.push(months);
    conditions.push(`extract(month from ${dateCol})::text = any($${values.length}::text[])`);
  }

  const years = decodeMultiSelectValue(filters.year);
  if (years.length > 0) {
    values.push(years);
    conditions.push(`extract(year from ${dateCol})::text = any($${values.length}::text[])`);
  }

  return { conditions, values };
}

// ─── Filter options ───────────────────────────────────────────────────────────

const OPTIONS_CACHE_TTL = 3 * 60 * 1000;

/**
 * Union DISTINCT de las fechas de todos los nodos activos. Cada nodo aporta su
 * propia columna de fecha (`work_date` o `lot_date`); la unión natural de SQL
 * (UNION sin ALL) deduplica los valores. Esto reemplaza el `OPTIONS_SOURCE`
 * único anterior, asegurando que las opciones de Semana / Mes / Año reflejen
 * todas las vistas activas y no sólo `gv_b1_vs_b1c_weight_xl_np_cur`.
 */
async function buildActiveNodeDateUnionSql(farm: string): Promise<string> {
  const candidates = getNodesForFarm(farm).filter((n) => n.active);
  if (candidates.length === 0) return "SELECT null::date AS d WHERE false";

  const names = candidates.map((n) => n.viewName.replace(/^gld\./, ""));
  const existsResult = await query<{ name: string }>(
    `SELECT matviewname AS name FROM pg_catalog.pg_matviews WHERE schemaname = 'gld' AND matviewname = ANY($1)
     UNION SELECT viewname AS name FROM pg_catalog.pg_views WHERE schemaname = 'gld' AND viewname = ANY($1)`,
    [names],
  );
  const existing = new Set(existsResult.rows.map((r) => `gld.${r.name}`));
  const active = candidates.filter((n) => existing.has(n.viewName));

  if (active.length === 0) return "SELECT null::date AS d WHERE false";
  return active
    .map((n) => `SELECT ${n.dateCol}::date AS d FROM ${n.viewName}`)
    .join("\n      UNION\n      ");
}

async function loadFilterOptionsImpl(farm: string): Promise<BalanzasFilterOptions> {
  const sql = `
    WITH all_dates AS (
      ${await buildActiveNodeDateUnionSql(farm)}
    ),
    distinct_dates AS (
      SELECT DISTINCT d FROM all_dates WHERE d IS NOT NULL
    )
    SELECT
      (
        SELECT array_agg(week_val ORDER BY week_val DESC)
        FROM (
          SELECT DISTINCT
            lpad((extract(isoyear from d) % 100)::int::text, 2, '0')
            || lpad(extract(week from d)::int::text, 2, '0') AS week_val
          FROM distinct_dates
        ) w
      ) AS weeks,
      (
        SELECT array_agg(month_val ORDER BY month_val::int ASC)
        FROM (
          SELECT DISTINCT extract(month from d)::int::text AS month_val
          FROM distinct_dates
        ) m
      ) AS months,
      (
        SELECT array_agg(year_val ORDER BY year_val::int DESC)
        FROM (
          SELECT DISTINCT extract(year from d)::int::text AS year_val
          FROM distinct_dates
        ) y
      ) AS years
  `;

  const result = await query<{ weeks: string[] | null; months: string[] | null; years: string[] | null }>(sql);
  const row = result.rows[0];
  const weeks = row?.weeks ?? [];
  const months = row?.months ?? [];
  const years = row?.years ?? [];

  return {
    weeks: weeks.map((value) => ({ value, label: formatWeekLabel(value) })),
    months: months.map((value) => ({ value, label: formatMonthName(value) })),
    years: years.map((value) => ({ value, label: value })),
  };
}

function loadFilterOptions(farm: string): Promise<BalanzasFilterOptions> {
  return cachedAsync(`balanzas:options:v4:${farm}`, OPTIONS_CACHE_TTL, () => loadFilterOptionsImpl(farm));
}

// ─── Node summary ─────────────────────────────────────────────────────────────

async function loadNodeSummary(
  nodeDef: BalanzasNodeDef,
  filters: BalanzasFilters,
): Promise<BalanzasNodeSummary> {
  const { conditions, values } = buildTemporalConditions(nodeDef.dateCol, filters);
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const aggExprs = buildSummaryMetricSelects(nodeDef.summaryMetrics);
  const sql = `
    SELECT COUNT(*) AS row_count, MIN(${nodeDef.dateCol}) AS date_min, MAX(${nodeDef.dateCol}) AS date_max
    ${aggExprs ? `, ${aggExprs}` : ""}
    FROM ${nodeDef.viewName}
    ${where}
  `;

  try {
    const result = await query<Record<string, unknown>>(sql, values);
    const row = result.rows[0] ?? {};
    return {
      key: nodeDef.key,
      label: nodeDef.label,
      shortLabel: nodeDef.shortLabel,
      dialogTitle: nodeDef.dialogTitle,
      branch: nodeDef.branch,
      active: nodeDef.active,
      detailTableMode: nodeDef.detailTableMode ?? "tree",
      rowCount: toNumber(row.row_count) ?? 0,
      dateMin: row.date_min ? String(row.date_min).slice(0, 10) : null,
      dateMax: row.date_max ? String(row.date_max).slice(0, 10) : null,
      metrics: nodeDef.summaryMetrics.map((m) => {
        const raw = resolveSummaryMetricValue(row, m);
        return { col: m.col, label: m.label, value: raw, formatted: formatMetricValue(raw, m.format) };
      }),
      bpmnElementId: nodeDef.bpmnBinding?.elementId ?? null,
      overlayOffsetLeft: nodeDef.bpmnBinding?.overlayOffsetLeft ?? 0,
      bpmnByDestination: nodeDef.bpmnByDestination,
    };
  } catch {
    return {
      key: nodeDef.key,
      label: nodeDef.label,
      shortLabel: nodeDef.shortLabel,
      dialogTitle: nodeDef.dialogTitle,
      branch: nodeDef.branch,
      active: nodeDef.active,
      detailTableMode: nodeDef.detailTableMode ?? "tree",
      rowCount: 0,
      dateMin: null,
      dateMax: null,
      metrics: nodeDef.summaryMetrics.map((m) => ({
        col: m.col,
        label: m.label,
        value: null,
        formatted: "—",
      })),
      bpmnElementId: nodeDef.bpmnBinding?.elementId ?? null,
      overlayOffsetLeft: nodeDef.bpmnBinding?.overlayOffsetLeft ?? 0,
      bpmnByDestination: nodeDef.bpmnByDestination,
    };
  }
}

// ─── Node detail ──────────────────────────────────────────────────────────────

export async function loadNodeDetail(
  nodeKey: string,
  filters: BalanzasFilters,
  localFilters: BalanzasDetailLocalFilters,
): Promise<BalanzasNodeDetail> {
  const nodeDef = getNodesForFarm(filters.farm).find((n) => n.key === nodeKey);
  if (!nodeDef) throw new Error(`Nodo balanzas no encontrado: ${nodeKey}`);

  const { conditions, values } = buildTemporalConditions(nodeDef.dateCol, filters);
  applyLocalDetailFilters(nodeDef, localFilters, conditions, values);

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const { conditions: optConds, values: optVals } = buildTemporalConditions(nodeDef.dateCol, filters);
  const optWhere = optConds.length > 0 ? `WHERE ${optConds.join(" AND ")}` : "";
  const optSelects = [
    nodeDef.hasDestination ? "destination" : "null::text AS destination",
    nodeDef.hasGrade ? "grade" : "null::text AS grade",
    nodeDef.hasGradeGroup ? "grade_group" : "null::text AS grade_group",
  ].join(", ");

  const aggExprs = buildSummaryMetricSelects(nodeDef.summaryMetrics);

  const [dataRes, optRes, summaryRes] = await Promise.all([
    query<BalanzasDetailRow>(
      `SELECT * FROM ${nodeDef.viewName} ${where} ORDER BY ${nodeDef.dateCol} DESC LIMIT 2000`,
      values,
    ),
    query<{ destination: string | null; grade: string | null; grade_group: string | null }>(
      `SELECT DISTINCT ${optSelects} FROM ${nodeDef.viewName} ${optWhere} ORDER BY 1 NULLS LAST, 2 NULLS LAST, 3 NULLS LAST`,
      optVals,
    ),
    query<Record<string, unknown>>(
      `SELECT COUNT(*) AS row_count, MIN(${nodeDef.dateCol}) AS date_min, MAX(${nodeDef.dateCol}) AS date_max ${aggExprs ? `, ${aggExprs}` : ""} FROM ${nodeDef.viewName} ${where}`,
      values,
    ),
  ]);

  const rows = dataRes.rows;
  const sampleRow = rows[0] ?? {};
  const detailColumnConfig = nodeDef.detailColumnConfig ?? {};
  const visibleColumnKeys = nodeDef.detailVisibleColumns ?? Object.keys(sampleRow);
  const columns = visibleColumnKeys
    .filter((key) => key in sampleRow)
    .map<BalanzasDetailColumn>((key) => {
    const config = detailColumnConfig[key];
    const numeric = Boolean(config) || typeof sampleRow[key] === "number";

    return {
      key,
      label: columnLabelForNode(nodeDef, key),
      numeric,
      format: numeric ? config?.format ?? "count" : null,
      aggregateMode: numeric ? config?.aggregateMode ?? "sum" : null,
      aggregateSources: numeric ? config?.aggregateSources : undefined,
    };
    });

  const sRow = summaryRes.rows[0] ?? {};
  const metrics: BalanzasSummaryMetric[] = nodeDef.summaryMetrics.map((m) => {
    const raw = resolveSummaryMetricValue(sRow, m);
    return { col: m.col, label: m.label, value: raw, formatted: formatMetricValue(raw, m.format) };
  });

  return {
    nodeKey: nodeDef.key,
    nodeLabel: nodeDef.label,
    branch: nodeDef.branch,
    active: nodeDef.active,
    tableMode: nodeDef.detailTableMode ?? "tree",
    dateFilterKeys: nodeDef.detailDateFilterKeys ?? [],
    rows,
    columns,
    destinations: [...new Set(optRes.rows.map((r) => r.destination).filter((v): v is string => !!v))].sort(),
    grades: [...new Set(optRes.rows.map((r) => r.grade).filter((v): v is string => !!v))].sort(),
    gradeGroups: [...new Set(optRes.rows.map((r) => r.grade_group).filter((v): v is string => !!v))].sort(),
    rowCount: toNumber(sRow.row_count) ?? rows.length,
    metrics,
  };
}

/**
 * Mapeo backend (snake_case / nombres legacy de Excel) → label visible canónico.
 *
 * Casing canónico: B1, B1AB, B1C, B2, B2A, B3 siempre en uppercase.
 * Sin abreviaturas técnicas (`%HIDR` → `Hidratación %`).
 *
 * Las columnas Meta % / Objetivo % / Cumplimiento % vienen preparadas pero
 * el loader devuelve `null` si la tabla fuente aún no existe — la tabla
 * sanitiza nulls/NaN/Infinity a `—` (em-dash) para no mostrar valores crudos.
 */
const COLUMN_LABELS: Record<string, string> = {
  // Fechas
  work_date: "Fecha trabajo",
  lot_date: "Fecha lote",
  fecha_b1: "Fecha B1",
  fecha_b1c: "Fecha B1C",
  fecha_entrega: "Fecha entrega",
  // Categorías y filtros
  destination: "Destino",
  grade: "Grado",
  grade_group: "Grupo grado",
  lote: "Lote",
  tipo: "Tipo",
  codigo_actividad: "Actividad",
  dias_hidratacion: "Días hidratación",
  // Tallos (uppercase canónico)
  stems_b1: "Tallos B1",
  stems_b1_count: "Tallos B1",
  stems_b1ab: "Tallos B1AB",
  stems_b1c_count: "Tallos B1C",
  stems_b2: "Tallos B2",
  stems_b2_count: "Tallos B2",
  stems_b2a: "Tallos B2A",
  // Pesos (uppercase canónico, kg explícito)
  weight_b1_kg: "Peso B1 (kg)",
  weight_b1ab_kg: "Peso B1AB (kg)",
  weight_b1ab_est: "Peso B1AB est. (kg)",
  weight_b1c_kg: "Peso B1C (kg)",
  weight_b1c_estimated_kg: "Peso B1C est. (kg)",
  weight_per_stem_kg: "Peso por tallo (kg)",
  weight_per_stem_b1ab: "Peso por tallo B1AB (kg)",
  weight_b2_kg: "Peso B2 (kg)",
  weight_b2: "Peso B2 (kg)",
  weight_b2a_kg: "Peso B2A (kg)",
  weight_b3_kg: "Peso B3 (kg)",
  ideal_weight_kg: "Peso ideal (kg)",
  // Hidratación / Despacho
  hydration_pct: "Hidratación %",
  hydration_target: "Meta hidratación",
  dispatch_pct: "Despacho %",
  dispatch_pct_stems: "Despacho tallos %",
  dispatch_pct_weight: "Despacho peso %",
  dispatch_1_pct: "Despacho 1 %",
  dispatch_2_pct: "Despacho 2 %",
  // Diferencias
  diff_pct_stems: "Diferencia tallos %",
  diff_pct_weight: "Diferencia peso %",
  stems_diff_pct: "Diferencia tallos %",
  weight_diff_pct: "Diferencia peso %",
  // Rendimientos / ratios
  yield_b1_vs_b3: "Rendimiento B1/B3",
  yield_b1_vs_ideal: "Rendimiento vs ideal",
  b2a_to_ideal_ratio: "B2A/Ideal",
  b2a_to_b1c_ratio: "B2A/B1C",
  ideal_to_b1c_ratio: "Ideal/B1C",
  // Conteos operativos
  processed_bunch_count: "Ramos procesados",
  bunches_prod: "Ramos producidos",
  // Metas / Objetivo / Cumplimiento (preparadas — null si no hay tabla fuente)
  meta_pct: "Meta %",
  objetivo_pct: "Objetivo %",
  cumplimiento_pct: "Cumplimiento %",
  // Tiempo
  week_id: "Semana",
};

function columnLabel(key: string): string {
  return COLUMN_LABELS[key] ?? `[${key}]`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

function buildDefaultBalanzasFilters(): BalanzasFilters {
  const now = new Date();
  const currentYYWW = toYYWW(now);
  const prevDate = new Date(now);
  prevDate.setDate(prevDate.getDate() - 7);
  const prevYYWW = toYYWW(prevDate);
  const weeks = currentYYWW === prevYYWW ? [currentYYWW] : [currentYYWW, prevYYWW];
  return {
    weekValue: encodeMultiSelectValue(weeks),
    month: "all",
    year: "all",
    dateFrom: "",
    dateTo: "",
    farm: "xl",
  };
}

const VALID_FARMS = new Set(["xl", "cl", "zn"]);

export function normalizeBalanzasFilters(raw: {
  weekValue?: string;
  month?: string;
  year?: string;
  dateFrom?: string;
  dateTo?: string;
  farm?: string;
}): BalanzasFilters {
  const defaults = buildDefaultBalanzasFilters();
  const farm = (raw.farm ?? "xl").toLowerCase();
  return {
    weekValue: raw.weekValue ?? defaults.weekValue,
    month: raw.month ?? "all",
    year: raw.year ?? "all",
    dateFrom: raw.dateFrom ?? "",
    dateTo: raw.dateTo ?? "",
    farm: VALID_FARMS.has(farm) ? farm : "xl",
  };
}

export async function getBalanzasDashboardData(filters: BalanzasFilters): Promise<BalanzasDashboardData> {
  const nodes = getNodesForFarm(filters.farm);
  const [options, ...nodeSummaries] = await Promise.all([
    loadFilterOptions(filters.farm),
    ...nodes.map((n) => loadNodeSummary(n, filters)),
  ]);
  return { filters, options, nodes: nodeSummaries };
}

export function createEmptyBalanzasDashboardData(
  filters: BalanzasFilters,
  _message?: string,
): BalanzasDashboardData {
  void _message;
  return { filters, options: { weeks: [], months: [], years: [] }, nodes: [] };
}

export const defaultBalanzasFilters: BalanzasFilters = buildDefaultBalanzasFilters();
