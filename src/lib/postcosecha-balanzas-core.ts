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

export type BalanzasNodeSummary = {
  key: string;
  label: string;
  shortLabel: string;
  branch: "preclasif" | "gv" | "apertura";
  active: boolean;
  rowCount: number;
  dateMin: string | null;
  dateMax: string | null;
  metrics: BalanzasSummaryMetric[];
  bpmnElementId: string | null;
  overlayOffsetLeft: number;
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
  rows: BalanzasDetailRow[];
  columns: { key: string; label: string; numeric: boolean }[];
  destinations: string[];
  grades: string[];
  gradeGroups: string[];
  rowCount: number;
  metrics: BalanzasSummaryMetric[];
};

// ─── Internal types ───────────────────────────────────────────────────────────

type FormatType = "kg" | "pct" | "count" | "ratio";
type AggType = "sum" | "avg";

type BalanzasBpmnBinding = {
  elementId: string;
  overlayOffsetLeft: number;
};

type SummaryMetricDef = {
  col: string;
  label: string;
  agg: AggType;
  format: FormatType;
};

type BalanzasNodeDef = {
  key: string;
  label: string;
  shortLabel: string;
  branch: "preclasif" | "gv" | "apertura";
  active: boolean;
  viewName: string;
  dateCol: "work_date" | "lot_date";
  summaryMetrics: SummaryMetricDef[];
  hasDestination: boolean;
  hasGrade: boolean;
  hasGradeGroup: boolean;
  bpmnBinding: BalanzasBpmnBinding | null;
};

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
  if (yyww.length !== 4) return yyww;
  const yy = parseInt(yyww.slice(0, 2), 10);
  const ww = parseInt(yyww.slice(2, 4), 10);
  const year = yy < 50 ? 2000 + yy : 1900 + yy;
  return `Sem. ${ww} · ${year}`;
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

function formatMetricValue(value: number | null, format: FormatType): string {
  if (value === null) return "—";
  switch (format) {
    case "kg": return formatFlexibleNumber(value) + " kg";
    case "pct": return formatPercentShared(value, { input: "ratio" });
    case "count": return formatFlexibleNumber(value);
    case "ratio": return formatPercentShared(value, { input: "ratio" });
  }
}

// ─── Node definitions (19 nodos, prefijo vw_ confirmado en DB) ───────────────

const VIEW_PREFIX = "gld.vw_camp_ind_bal_";

const BALANZAS_NODES: BalanzasNodeDef[] = [
  // ── PRECLASIFICACIÓN ──────────────────────────────────────────────────────
  {
    key: "preclasif-b1-b1a-stems",
    label: "B1 → B1a (Tallos)",
    shortLabel: "Tallos",
    branch: "preclasif",
    active: true,
    viewName: `${VIEW_PREFIX}preclasif_b1_vs_b1a_xl_np_stems_cur`,
    dateCol: "work_date",
    summaryMetrics: [
      { col: "stems_b1",           label: "Tallos B1",   agg: "sum", format: "count" },
      { col: "stems_b1ab",         label: "Tallos B1a",  agg: "sum", format: "count" },
      { col: "dispatch_pct_stems", label: "Despacho %",  agg: "avg", format: "pct" },
    ],
    hasDestination: true,
    hasGrade: false,
    hasGradeGroup: true,
    bpmnBinding: { elementId: "Task_B1AB_Pre_Directo", overlayOffsetLeft: 0 },
  },
  {
    key: "preclasif-b1-b1a-weight",
    label: "B1 → B1a (Peso)",
    shortLabel: "Peso",
    branch: "preclasif",
    active: true,
    viewName: `${VIEW_PREFIX}preclasif_b1_vs_b1a_xl_np_weight_cur`,
    dateCol: "work_date",
    summaryMetrics: [
      { col: "weight_b1_kg",         label: "B1 kg",       agg: "sum", format: "kg" },
      { col: "weight_b1ab_kg",       label: "B1a kg",      agg: "sum", format: "kg" },
      { col: "dispatch_pct_weight",  label: "Despacho %",  agg: "avg", format: "pct" },
    ],
    hasDestination: true,
    hasGrade: false,
    hasGradeGroup: true,
    bpmnBinding: { elementId: "Task_B1AB_Pre_Directo", overlayOffsetLeft: 172 },
  },
  {
    key: "preclasif-b1a-b2-stems",
    label: "B1a → B2 (Tallos)",
    shortLabel: "Tallos",
    branch: "preclasif",
    active: true,
    viewName: `${VIEW_PREFIX}preclasif_b1a_vs_b2_xl_np_stems_cur`,
    dateCol: "lot_date",
    summaryMetrics: [
      { col: "stems_b1ab",      label: "Tallos B1a",    agg: "sum", format: "count" },
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
    label: "B1a → B2 (Peso)",
    shortLabel: "Peso",
    branch: "preclasif",
    active: true,
    viewName: `${VIEW_PREFIX}preclasif_b1a_vs_b2_xl_np_weight_cur`,
    dateCol: "work_date",
    summaryMetrics: [
      { col: "weight_b1ab_est",  label: "B1a est. kg",    agg: "sum", format: "kg" },
      { col: "weight_b2",        label: "B2 kg",          agg: "sum", format: "kg" },
      { col: "hydration_pct",    label: "Hidratación %",  agg: "avg", format: "pct" },
    ],
    hasDestination: true,
    hasGrade: false,
    hasGradeGroup: true,
    bpmnBinding: { elementId: "Task_B2_Pre_Directo", overlayOffsetLeft: 172 },
  },
  {
    key: "preclasif-b2-b3-weight",
    label: "B2 → B3 (Peso)",
    shortLabel: "B2 → B3",
    branch: "preclasif",
    active: true,
    viewName: `${VIEW_PREFIX}preclasif_b2_vs_b3_xl_np_weight_cur`,
    dateCol: "work_date",
    summaryMetrics: [
      { col: "weight_b2_kg",    label: "B2 kg",        agg: "sum", format: "kg" },
      { col: "weight_b3_kg",    label: "B3 kg",        agg: "sum", format: "kg" },
      { col: "diff_pct_weight", label: "Diferencia %", agg: "avg", format: "pct" },
    ],
    hasDestination: true,
    hasGrade: false,
    hasGradeGroup: false,
    bpmnBinding: { elementId: "Task_General_Pre_Directo", overlayOffsetLeft: 0 },
  },
  {
    key: "preclasif-b1-b3-ideal",
    label: "B1 → B3 Ideal",
    shortLabel: "→ Ideal",
    branch: "preclasif",
    active: true,
    viewName: `${VIEW_PREFIX}preclasif_b1_vs_b3_ideal_weight_xl_np_cur`,
    dateCol: "work_date",
    summaryMetrics: [
      { col: "weight_b1_kg",   label: "B1 kg",          agg: "sum", format: "kg" },
      { col: "weight_b3_kg",   label: "B3 kg",          agg: "sum", format: "kg" },
      { col: "yield_b1_vs_b3", label: "Rendimiento %",  agg: "avg", format: "pct" },
    ],
    hasDestination: true,
    hasGrade: false,
    hasGradeGroup: false,
    bpmnBinding: { elementId: "Task_General_Pre_Directo", overlayOffsetLeft: 172 },
  },
  // ── COSECHA GV ────────────────────────────────────────────────────────────
  {
    key: "gv-b1-b1c-stems",
    label: "B1 → B1c (Tallos)",
    shortLabel: "Tallos",
    branch: "gv",
    active: true,
    viewName: `${VIEW_PREFIX}gv_b1_vs_b1c_stems_xl_np_cur`,
    dateCol: "work_date",
    summaryMetrics: [
      { col: "stems_b1_count",  label: "Tallos B1",    agg: "sum", format: "count" },
      { col: "stems_b1c_count", label: "Tallos B1c",   agg: "sum", format: "count" },
      { col: "stems_diff_pct",  label: "Diferencia %", agg: "avg", format: "pct" },
    ],
    hasDestination: false,
    hasGrade: false,
    hasGradeGroup: false,
    bpmnBinding: { elementId: "Task_B1C_Apertura_GV", overlayOffsetLeft: 0 },
  },
  {
    key: "gv-b1-b1c-weight",
    label: "B1 → B1c (Peso)",
    shortLabel: "Peso",
    branch: "gv",
    active: true,
    viewName: `${VIEW_PREFIX}gv_b1_vs_b1c_weight_xl_np_cur`,
    dateCol: "work_date",
    summaryMetrics: [
      { col: "weight_b1_kg",    label: "B1 kg",        agg: "sum", format: "kg" },
      { col: "weight_b1c_kg",   label: "B1c kg",       agg: "sum", format: "kg" },
      { col: "weight_diff_pct", label: "Diferencia %", agg: "avg", format: "pct" },
    ],
    hasDestination: false,
    hasGrade: false,
    hasGradeGroup: false,
    bpmnBinding: { elementId: "Task_B1C_Apertura_GV", overlayOffsetLeft: 172 },
  },
  {
    key: "gv-b1c-b2-stems",
    label: "B1c → B2 (Tallos)",
    shortLabel: "Tallos",
    branch: "gv",
    active: true,
    viewName: `${VIEW_PREFIX}gv_b1c_vs_b2_stems_xl_np_cur`,
    dateCol: "lot_date",
    summaryMetrics: [
      { col: "stems_b1c_count", label: "Tallos B1c",   agg: "sum", format: "count" },
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
    label: "B1c → B2 (Peso)",
    shortLabel: "Peso",
    branch: "gv",
    active: true,
    viewName: `${VIEW_PREFIX}gv_b1c_vs_b2_weight_xl_np_cur`,
    dateCol: "work_date",
    summaryMetrics: [
      { col: "weight_b2_kg",            label: "B2 kg",          agg: "sum", format: "kg" },
      { col: "weight_b1c_estimated_kg", label: "B1c est. kg",    agg: "sum", format: "kg" },
      { col: "hydration_pct",           label: "Hidratación %",  agg: "avg", format: "pct" },
    ],
    hasDestination: true,
    hasGrade: true,
    hasGradeGroup: false,
    bpmnBinding: { elementId: "Task_B2_Apertura_Max10", overlayOffsetLeft: 172 },
  },
  {
    key: "gv-b2-b2a-weight",
    label: "B2 → B2a (Peso)",
    shortLabel: "B2 → B2A",
    branch: "gv",
    active: true,
    viewName: `${VIEW_PREFIX}gv_b2_vs_b2a_weight_xl_np_cur`,
    dateCol: "work_date",
    summaryMetrics: [
      { col: "weight_b2_kg",   label: "B2 kg",       agg: "sum", format: "kg" },
      { col: "weight_b2a_kg",  label: "B2a kg",      agg: "sum", format: "kg" },
      { col: "dispatch_pct",   label: "Despacho %",  agg: "avg", format: "pct" },
    ],
    hasDestination: true,
    hasGrade: false,
    hasGradeGroup: false,
    bpmnBinding: { elementId: "Task_General_Apertura_Max10", overlayOffsetLeft: 0 },
  },
  {
    key: "gv-b1c-b2a-ideal",
    label: "B1c → B2a → Ideal",
    shortLabel: "→ Ideal",
    branch: "gv",
    active: true,
    viewName: `${VIEW_PREFIX}gv_b1c_vs_b2a_vs_ideal_weight_xl_np_cur`,
    dateCol: "work_date",
    summaryMetrics: [
      { col: "weight_b2a_kg",      label: "B2a kg",    agg: "sum", format: "kg" },
      { col: "ideal_weight_kg",    label: "Ideal kg",  agg: "sum", format: "kg" },
      { col: "b2a_to_ideal_ratio", label: "B2a/Ideal", agg: "avg", format: "ratio" },
    ],
    hasDestination: true,
    hasGrade: false,
    hasGradeGroup: false,
    bpmnBinding: { elementId: "Task_General_Apertura_Max10", overlayOffsetLeft: 172 },
  },
  // ── APERTURA (inactive — rama legacy) ────────────────────────────────────
  {
    key: "apertura-b1-b1c-stems",
    label: "B1 → B1c (Tallos)",
    shortLabel: "Tallos",
    branch: "apertura",
    active: true,
    viewName: `${VIEW_PREFIX}apertura_b1_vs_b1c_stems_xl_np_cur`,
    dateCol: "work_date",
    summaryMetrics: [
      { col: "stems_b1_count",  label: "Tallos B1",    agg: "sum", format: "count" },
      { col: "stems_b1c_count", label: "Tallos B1c",   agg: "sum", format: "count" },
      { col: "stems_diff_pct",  label: "Diferencia %", agg: "avg", format: "pct" },
    ],
    hasDestination: false,
    hasGrade: false,
    hasGradeGroup: false,
    bpmnBinding: { elementId: "Task_B1C_Apertura_Directo", overlayOffsetLeft: 0 },
  },
  {
    key: "apertura-b1-b1c-weight",
    label: "B1 → B1c (Peso)",
    shortLabel: "Peso",
    branch: "apertura",
    active: true,
    viewName: `${VIEW_PREFIX}apertura_b1_vs_b1c_weight_xl_np_cur`,
    dateCol: "work_date",
    summaryMetrics: [
      { col: "weight_b1_kg",    label: "B1 kg",        agg: "sum", format: "kg" },
      { col: "weight_b1c_kg",   label: "B1c kg",       agg: "sum", format: "kg" },
      { col: "weight_diff_pct", label: "Diferencia %", agg: "avg", format: "pct" },
    ],
    hasDestination: false,
    hasGrade: false,
    hasGradeGroup: false,
    bpmnBinding: { elementId: "Task_B1C_Apertura_Directo", overlayOffsetLeft: 172 },
  },
  {
    key: "apertura-b1c-b2-stems",
    label: "B1c → B2 (Tallos)",
    shortLabel: "Tallos",
    branch: "apertura",
    active: true,
    viewName: `${VIEW_PREFIX}apertura_b1c_vs_b2_stems_xl_np_cur`,
    dateCol: "lot_date",
    summaryMetrics: [
      { col: "stems_b1c_count", label: "Tallos B1c",   agg: "sum", format: "count" },
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
    label: "B1c → B2 (Peso)",
    shortLabel: "Peso",
    branch: "apertura",
    active: true,
    viewName: `${VIEW_PREFIX}apertura_b1c_vs_b2_weight_xl_np_cur`,
    dateCol: "work_date",
    summaryMetrics: [
      { col: "weight_b2_kg",            label: "B2 kg",          agg: "sum", format: "kg" },
      { col: "weight_b1c_estimated_kg", label: "B1c est. kg",    agg: "sum", format: "kg" },
      { col: "hydration_pct",           label: "Hidratación %",  agg: "avg", format: "pct" },
    ],
    hasDestination: true,
    hasGrade: true,
    hasGradeGroup: false,
    bpmnBinding: { elementId: "Task_B2_Apertura_Directo", overlayOffsetLeft: 172 },
  },
  {
    key: "apertura-b2-b2a-weight",
    label: "B2 → B2a (Peso)",
    shortLabel: "B2 → B2A",
    branch: "apertura",
    active: true,
    viewName: `${VIEW_PREFIX}apertura_b2_vs_b2a_weight_xl_np_cur`,
    dateCol: "work_date",
    summaryMetrics: [
      { col: "weight_b2_kg",  label: "B2 kg",       agg: "sum", format: "kg" },
      { col: "weight_b2a_kg", label: "B2a kg",      agg: "sum", format: "kg" },
      { col: "dispatch_pct",  label: "Despacho %",  agg: "avg", format: "pct" },
    ],
    hasDestination: true,
    hasGrade: false,
    hasGradeGroup: false,
    bpmnBinding: { elementId: "Task_General_Apertura_Directo", overlayOffsetLeft: 0 },
  },
  {
    key: "apertura-b1c-b2a-ideal",
    label: "B1c → B2a → Ideal",
    shortLabel: "→ Ideal",
    branch: "apertura",
    active: true,
    viewName: `${VIEW_PREFIX}apertura_b1c_vs_b2a_vs_ideal_weight_xl_np_cur`,
    dateCol: "work_date",
    summaryMetrics: [
      { col: "weight_b2a_kg",      label: "B2a kg",    agg: "sum", format: "kg" },
      { col: "ideal_weight_kg",    label: "Ideal kg",  agg: "sum", format: "kg" },
      { col: "b2a_to_ideal_ratio", label: "B2a/Ideal", agg: "avg", format: "ratio" },
    ],
    hasDestination: true,
    hasGrade: false,
    hasGradeGroup: false,
    bpmnBinding: { elementId: "Task_General_Apertura_Directo", overlayOffsetLeft: 172 },
  },
  {
    key: "apertura-b2a-ideal-grade",
    label: "B2a → Ideal × Grado",
    shortLabel: "B2A × Grado",
    branch: "apertura",
    active: true,
    viewName: `${VIEW_PREFIX}apertura_b2a_vs_ideal_weight_x_grade_xl_np_cur`,
    dateCol: "work_date",
    summaryMetrics: [
      { col: "weight_b2a_kg",      label: "B2a kg",    agg: "sum", format: "kg" },
      { col: "ideal_weight_kg",    label: "Ideal kg",  agg: "sum", format: "kg" },
      { col: "b2a_to_ideal_ratio", label: "B2a/Ideal", agg: "avg", format: "ratio" },
    ],
    hasDestination: true,
    hasGrade: true,
    hasGradeGroup: false,
    bpmnBinding: { elementId: "Task_General_Apertura_Directo", overlayOffsetLeft: 344 },
  },
];

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

const OPTIONS_SOURCE = `${VIEW_PREFIX}gv_b1_vs_b1c_weight_xl_np_cur`;
const OPTIONS_CACHE_TTL = 3 * 60 * 1000;

async function loadFilterOptionsImpl(): Promise<BalanzasFilterOptions> {
  const [weeksRes, monthsRes, yearsRes] = await Promise.all([
    query<{ week_val: string }>(
      `SELECT week_val FROM (
         SELECT DISTINCT lpad((extract(isoyear from work_date) % 100)::int::text, 2, '0')
                      || lpad(extract(week from work_date)::int::text, 2, '0') AS week_val
         FROM ${OPTIONS_SOURCE}
       ) t ORDER BY week_val DESC`,
    ),
    query<{ month_val: string }>(
      `SELECT month_val FROM (
         SELECT DISTINCT extract(month from work_date)::int::text AS month_val
         FROM ${OPTIONS_SOURCE}
       ) t ORDER BY month_val::int ASC`,
    ),
    query<{ year_val: string }>(
      `SELECT year_val FROM (
         SELECT DISTINCT extract(year from work_date)::int::text AS year_val
         FROM ${OPTIONS_SOURCE}
       ) t ORDER BY year_val::int DESC`,
    ),
  ]);

  return {
    weeks: weeksRes.rows.map((r) => ({ value: r.week_val, label: formatWeekLabel(r.week_val) })),
    months: monthsRes.rows.map((r) => ({ value: r.month_val, label: formatMonthName(r.month_val) })),
    years: yearsRes.rows.map((r) => ({ value: r.year_val, label: r.year_val })),
  };
}

function loadFilterOptions(): Promise<BalanzasFilterOptions> {
  return cachedAsync("balanzas:options:v3", OPTIONS_CACHE_TTL, loadFilterOptionsImpl);
}

// ─── Node summary ─────────────────────────────────────────────────────────────

async function loadNodeSummary(
  nodeDef: BalanzasNodeDef,
  filters: BalanzasFilters,
): Promise<BalanzasNodeSummary> {
  const { conditions, values } = buildTemporalConditions(nodeDef.dateCol, filters);
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const aggExprs = nodeDef.summaryMetrics
    .map((m) => `${m.agg === "sum" ? "SUM" : "AVG"}(${m.col}::numeric) AS ${m.col}`)
    .join(", ");
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
      branch: nodeDef.branch,
      active: nodeDef.active,
      rowCount: toNumber(row.row_count) ?? 0,
      dateMin: row.date_min ? String(row.date_min).slice(0, 10) : null,
      dateMax: row.date_max ? String(row.date_max).slice(0, 10) : null,
      metrics: nodeDef.summaryMetrics.map((m) => {
        const raw = toNumber(row[m.col]);
        return { col: m.col, label: m.label, value: raw, formatted: formatMetricValue(raw, m.format) };
      }),
      bpmnElementId: nodeDef.bpmnBinding?.elementId ?? null,
      overlayOffsetLeft: nodeDef.bpmnBinding?.overlayOffsetLeft ?? 0,
    };
  } catch {
    return {
      key: nodeDef.key,
      label: nodeDef.label,
      shortLabel: nodeDef.shortLabel,
      branch: nodeDef.branch,
      active: nodeDef.active,
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
    };
  }
}

// ─── Node detail ──────────────────────────────────────────────────────────────

export async function loadNodeDetail(
  nodeKey: string,
  filters: BalanzasFilters,
  localFilters: { destinations: string[]; grades: string[]; gradeGroups: string[] },
): Promise<BalanzasNodeDetail> {
  const nodeDef = BALANZAS_NODES.find((n) => n.key === nodeKey);
  if (!nodeDef) throw new Error(`Nodo balanzas no encontrado: ${nodeKey}`);

  const { conditions, values } = buildTemporalConditions(nodeDef.dateCol, filters);

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

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const { conditions: optConds, values: optVals } = buildTemporalConditions(nodeDef.dateCol, filters);
  const optWhere = optConds.length > 0 ? `WHERE ${optConds.join(" AND ")}` : "";
  const optSelects = [
    nodeDef.hasDestination ? "destination" : "null::text AS destination",
    nodeDef.hasGrade ? "grade" : "null::text AS grade",
    nodeDef.hasGradeGroup ? "grade_group" : "null::text AS grade_group",
  ].join(", ");

  const aggExprs = nodeDef.summaryMetrics
    .map((m) => `${m.agg === "sum" ? "SUM" : "AVG"}(${m.col}::numeric) AS ${m.col}`)
    .join(", ");

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
      `SELECT COUNT(*) AS row_count, MIN(${nodeDef.dateCol}) AS date_min, MAX(${nodeDef.dateCol}) AS date_max ${aggExprs ? `, ${aggExprs}` : ""} FROM ${nodeDef.viewName} ${optWhere}`,
      optVals,
    ),
  ]);

  const rows = dataRes.rows;
  const sampleRow = rows[0] ?? {};
  const columns = Object.keys(sampleRow).map((key) => ({
    key,
    label: columnLabel(key),
    numeric: typeof sampleRow[key] === "number",
  }));

  const sRow = summaryRes.rows[0] ?? {};
  const metrics: BalanzasSummaryMetric[] = nodeDef.summaryMetrics.map((m) => {
    const raw = toNumber(sRow[m.col]);
    return { col: m.col, label: m.label, value: raw, formatted: formatMetricValue(raw, m.format) };
  });

  return {
    nodeKey: nodeDef.key,
    nodeLabel: nodeDef.label,
    branch: nodeDef.branch,
    active: nodeDef.active,
    rows,
    columns,
    destinations: [...new Set(optRes.rows.map((r) => r.destination).filter((v): v is string => !!v))].sort(),
    grades: [...new Set(optRes.rows.map((r) => r.grade).filter((v): v is string => !!v))].sort(),
    gradeGroups: [...new Set(optRes.rows.map((r) => r.grade_group).filter((v): v is string => !!v))].sort(),
    rowCount: toNumber(sRow.row_count) ?? rows.length,
    metrics,
  };
}

const COLUMN_LABELS: Record<string, string> = {
  work_date: "Fecha trabajo",
  lot_date: "Fecha lote",
  destination: "Destino",
  grade: "Grado",
  grade_group: "Grupo grado",
  stems_b1: "Tallos B1",
  stems_b1_count: "Tallos B1",
  stems_b1ab: "Tallos B1AB",
  stems_b1c_count: "Tallos B1C",
  stems_b2: "Tallos B2",
  stems_b2_count: "Tallos B2",
  weight_b1_kg: "Peso B1 (kg)",
  weight_b1ab_kg: "Peso B1AB (kg)",
  weight_b1ab_est: "Peso B1AB est. (kg)",
  weight_b1c_kg: "Peso B1C (kg)",
  weight_b1c_estimated_kg: "Peso B1C est. (kg)",
  weight_per_stem_kg: "Peso/tallo (kg)",
  weight_per_stem_b1ab: "Peso/tallo B1AB (kg)",
  weight_b2_kg: "Peso B2 (kg)",
  weight_b2: "Peso B2 (kg)",
  weight_b2a_kg: "Peso B2A (kg)",
  weight_b3_kg: "Peso B3 (kg)",
  ideal_weight_kg: "Peso ideal (kg)",
  hydration_pct: "Hidratación %",
  hydration_target: "Meta hidratación",
  dispatch_pct: "Despacho %",
  dispatch_pct_stems: "Despacho tallos %",
  dispatch_pct_weight: "Despacho peso %",
  dispatch_1_pct: "Despacho 1 %",
  dispatch_2_pct: "Despacho 2 %",
  diff_pct_stems: "Dif. tallos %",
  diff_pct_weight: "Dif. peso %",
  stems_diff_pct: "Dif. tallos %",
  weight_diff_pct: "Dif. peso %",
  yield_b1_vs_b3: "Rendimiento B1/B3",
  yield_b1_vs_ideal: "Rend. vs ideal",
  b2a_to_ideal_ratio: "B2A/Ideal",
  b2a_to_b1c_ratio: "B2A/B1C",
  ideal_to_b1c_ratio: "Ideal/B1C",
  processed_bunch_count: "Ramos procesados",
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
  };
}

export function normalizeBalanzasFilters(raw: {
  weekValue?: string;
  month?: string;
  year?: string;
  dateFrom?: string;
  dateTo?: string;
}): BalanzasFilters {
  const defaults = buildDefaultBalanzasFilters();
  return {
    weekValue: raw.weekValue ?? defaults.weekValue,
    month: raw.month ?? "all",
    year: raw.year ?? "all",
    dateFrom: raw.dateFrom ?? "",
    dateTo: raw.dateTo ?? "",
  };
}

export async function getBalanzasDashboardData(filters: BalanzasFilters): Promise<BalanzasDashboardData> {
  const [options, ...nodeSummaries] = await Promise.all([
    loadFilterOptions(),
    ...BALANZAS_NODES.map((n) => loadNodeSummary(n, filters)),
  ]);
  return { filters, options, nodes: nodeSummaries };
}

export function createEmptyBalanzasDashboardData(
  filters: BalanzasFilters,
  _message?: string,
): BalanzasDashboardData {
  return { filters, options: { weeks: [], months: [], years: [] }, nodes: [] };
}

export const defaultBalanzasFilters: BalanzasFilters = buildDefaultBalanzasFilters();
