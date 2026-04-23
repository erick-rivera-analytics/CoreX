import "server-only";

import type { QueryResultRow } from "pg";

import { query } from "@/lib/db";
import { decodeMultiSelectValue, encodeMultiSelectValue, hasMultiSelectValue } from "@/lib/multi-select";
import { cachedAsync } from "@/lib/server-cache";
import { formatFlexibleNumber, formatPercent as formatPercentShared } from "@/shared/lib/format";
import { roundValue, toNumber } from "@/shared/lib/number-utils";

export type BalanzasMetric = "peso" | "tallos";
export type BalanzasWeekMode = "none" | "pre" | "iso";
export type BalanzasLaneId =
  | "pre-gv"
  | "pre-directo"
  | "apertura-gv-pelado"
  | "apertura-apertura";
export type BalanzasNodeKind = "metric" | "aggregate";
export type BalanzasNodeFocus = "source" | "target";
export type BalanzasNodeKey =
  | "b1_preclasificacion"
  | "b1ab_pre_gv"
  | "b2_pre_gv"
  | "b3_pre_gv_arcoiris"
  | "b3_pre_gv_tinturado"
  | "b3_pre_gv_blanco"
  | "general_pre_gv"
  | "b1ab_pre_directo"
  | "b2_pre_directo"
  | "b3_pre_directo_arcoiris"
  | "b3_pre_directo_tinturado"
  | "b3_pre_directo_blanco"
  | "general_pre_directo"
  | "b1_apertura"
  | "b1c_apertura_gv"
  | "b2_apertura_max10"
  | "b2a_apertura_max10_arcoiris"
  | "b2a_apertura_max10_tinturado"
  | "b2a_apertura_max10_blanco"
  | "general_apertura_max10"
  | "b1c_apertura_directo"
  | "b2_apertura_directo"
  | "b2a_apertura_directo_arcoiris"
  | "b2a_apertura_directo_tinturado"
  | "b2a_apertura_directo_blanco"
  | "general_apertura_directo";
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
  minY?: number;
  maxY?: number;
};

export type BalanzasNodeData = {
  key: BalanzasNodeKey;
  metric: BalanzasMetric;
  label: string;
  shortLabel: string;
  kind: BalanzasNodeKind;
  laneId: BalanzasLaneId;
  laneLabel: string;
  sourceStage: string;
  targetStage: string;
  focusStage: string;
  focusRole: BalanzasNodeFocus;
  description: string;
  fixedDestination: string | null;
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
  primaryTotal: number;
  primaryTotalDisplay: string;
  secondaryStage: string | null;
  secondaryTotal: number | null;
  secondaryTotalDisplay: string;
  processBindings: BalanzasProcessBinding[];
  childrenKeys: BalanzasNodeKey[];
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
  /** Nombres reales de columnas detectadas en la vista (útil para diagnóstico). */
  rawColumnNames: string[];
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
  kind: BalanzasNodeKind;
  laneId: BalanzasLaneId;
  laneLabel: string;
  sourceStage: string;
  targetStage: string;
  focusRole: BalanzasNodeFocus;
  description: string;
  fixedDestination?: string | null;
  childrenKeys?: BalanzasNodeKey[];
  views: Partial<Record<BalanzasMetric, string | string[]>>;
  processBindings: BalanzasProcessBinding[];
};

type BalanzasViewSchema = {
  viewName: string;
  sourceViews: string[];
  fromSql: string;
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
const BALANZAS_SCOPE_LABEL = "Rutas operativas: Preclasificacion y Apertura";
const BALANZAS_SCOPE_NOTE = "Cada caja azul del diagrama se modela como un nodo independiente y cada boton GENERAL agrega la rama completa.";
const BALANZAS_DESTINATION_LABEL = "Destino";

const PRE_SHARED_NOTE =
  "La fuente actual de preclasificacion no separa GV sin pelar y Directo; este corte se refleja igual en ambas rutas operativas.";

const BALANZAS_PROCESS_NODES: BalanzasProcessNodeDefinition[] = [
  {
    key: "b1_preclasificacion",
    label: "B1",
    shortLabel: "B1",
    kind: "metric",
    laneId: "pre-gv",
    laneLabel: "Preclasificacion",
    sourceStage: "B1",
    targetStage: "B1AB",
    focusRole: "source",
    description: "Nodo inicial de preclasificacion antes de bifurcar hacia GV sin pelar y Directo.",
    views: {
      peso: "gld.mv_camp_ind_bal_preclasif_b1_vs_b1a_xl_np_weight_cur",
      tallos: "gld.mv_camp_ind_bal_preclasif_b1_vs_b1a_xl_np_stems_cur",
    },
    processBindings: [{ taskName: "B1", elementId: "Task_B1_Preclasificacion" }],
  },
  {
    key: "b1ab_pre_gv",
    label: "B1AB",
    shortLabel: "B1AB",
    kind: "metric",
    laneId: "pre-gv",
    laneLabel: "Preclasificacion / GV sin pelar",
    sourceStage: "B1",
    targetStage: "B1AB",
    focusRole: "target",
    description: `B1AB de la ruta GV sin pelar. ${PRE_SHARED_NOTE}`,
    views: {
      peso: "gld.mv_camp_ind_bal_preclasif_b1_vs_b1a_xl_np_weight_cur",
      tallos: "gld.mv_camp_ind_bal_preclasif_b1_vs_b1a_xl_np_stems_cur",
    },
    processBindings: [{ taskName: "B1AB", elementId: "Task_B1AB_Pre_GV" }],
  },
  {
    key: "b2_pre_gv",
    label: "B2",
    shortLabel: "B2",
    kind: "metric",
    laneId: "pre-gv",
    laneLabel: "Preclasificacion / GV sin pelar",
    sourceStage: "B1AB",
    targetStage: "B2",
    focusRole: "target",
    description: `B2 de la ruta GV sin pelar. ${PRE_SHARED_NOTE}`,
    views: {
      peso: "gld.mv_camp_ind_bal_preclasif_b1a_vs_b2_xl_np_weight_cur",
      tallos: "gld.mv_camp_ind_bal_preclasif_b1a_vs_b2_xl_np_stems_cur",
    },
    processBindings: [{ taskName: "B2", elementId: "Task_B2_Pre_GV" }],
  },
  {
    key: "b3_pre_gv_arcoiris",
    label: "B3",
    shortLabel: "B3",
    kind: "metric",
    laneId: "pre-gv",
    laneLabel: "Preclasificacion / GV sin pelar",
    sourceStage: "B2",
    targetStage: "B3",
    focusRole: "target",
    description: `B3 Arcoiris de la ruta GV sin pelar. ${PRE_SHARED_NOTE}`,
    fixedDestination: "ARCOIRIS",
    views: { peso: "gld.mv_camp_ind_bal_preclasif_b2_vs_b3_xl_np_weight_cur" },
    processBindings: [{ taskName: "B3", elementId: "Task_B3_Pre_GV_Arcoiris" }],
  },
  {
    key: "b3_pre_gv_tinturado",
    label: "B3",
    shortLabel: "B3",
    kind: "metric",
    laneId: "pre-gv",
    laneLabel: "Preclasificacion / GV sin pelar",
    sourceStage: "B2",
    targetStage: "B3",
    focusRole: "target",
    description: `B3 Tinturado de la ruta GV sin pelar. ${PRE_SHARED_NOTE}`,
    fixedDestination: "TINTURADO",
    views: { peso: "gld.mv_camp_ind_bal_preclasif_b2_vs_b3_xl_np_weight_cur" },
    processBindings: [{ taskName: "B3", elementId: "Task_B3_Pre_GV_Tinturado" }],
  },
  {
    key: "b3_pre_gv_blanco",
    label: "B3",
    shortLabel: "B3",
    kind: "metric",
    laneId: "pre-gv",
    laneLabel: "Preclasificacion / GV sin pelar",
    sourceStage: "B2",
    targetStage: "B3",
    focusRole: "target",
    description: `B3 Blanco de la ruta GV sin pelar. ${PRE_SHARED_NOTE}`,
    fixedDestination: "BLANCO",
    views: { peso: "gld.mv_camp_ind_bal_preclasif_b2_vs_b3_xl_np_weight_cur" },
    processBindings: [{ taskName: "B3", elementId: "Task_B3_Pre_GV_Blanco" }],
  },
  {
    key: "general_pre_gv",
    label: "GENERAL",
    shortLabel: "GENERAL",
    kind: "aggregate",
    laneId: "pre-gv",
    laneLabel: "Preclasificacion / GV sin pelar",
    sourceStage: "B1",
    targetStage: "B3",
    focusRole: "target",
    description: `Agregado B1→B3 con ideal de la ruta GV sin pelar. ${PRE_SHARED_NOTE}`,
    views: { peso: "gld.mv_camp_ind_bal_preclasif_b1_vs_b3_ideal_weight_xl_np_cur" },
    processBindings: [{ taskName: "GENERAL", elementId: "Task_General_Pre_GV" }],
    childrenKeys: ["b3_pre_gv_arcoiris", "b3_pre_gv_tinturado", "b3_pre_gv_blanco"],
  },
  {
    key: "b1ab_pre_directo",
    label: "B1AB",
    shortLabel: "B1AB",
    kind: "metric",
    laneId: "pre-directo",
    laneLabel: "Preclasificacion / Directo",
    sourceStage: "B1",
    targetStage: "B1AB",
    focusRole: "target",
    description: `B1AB de la ruta Directo. ${PRE_SHARED_NOTE}`,
    views: {
      peso: "gld.mv_camp_ind_bal_preclasif_b1_vs_b1a_xl_np_weight_cur",
      tallos: "gld.mv_camp_ind_bal_preclasif_b1_vs_b1a_xl_np_stems_cur",
    },
    processBindings: [{ taskName: "B1AB", elementId: "Task_B1AB_Pre_Directo" }],
  },
  {
    key: "b2_pre_directo",
    label: "B2",
    shortLabel: "B2",
    kind: "metric",
    laneId: "pre-directo",
    laneLabel: "Preclasificacion / Directo",
    sourceStage: "B1AB",
    targetStage: "B2",
    focusRole: "target",
    description: `B2 de la ruta Directo. ${PRE_SHARED_NOTE}`,
    views: {
      peso: "gld.mv_camp_ind_bal_preclasif_b1a_vs_b2_xl_np_weight_cur",
      tallos: "gld.mv_camp_ind_bal_preclasif_b1a_vs_b2_xl_np_stems_cur",
    },
    processBindings: [{ taskName: "B2", elementId: "Task_B2_Pre_Directo" }],
  },
  {
    key: "b3_pre_directo_arcoiris",
    label: "B3",
    shortLabel: "B3",
    kind: "metric",
    laneId: "pre-directo",
    laneLabel: "Preclasificacion / Directo",
    sourceStage: "B2",
    targetStage: "B3",
    focusRole: "target",
    description: `B3 Arcoiris de la ruta Directo. ${PRE_SHARED_NOTE}`,
    fixedDestination: "ARCOIRIS",
    views: { peso: "gld.mv_camp_ind_bal_preclasif_b2_vs_b3_xl_np_weight_cur" },
    processBindings: [{ taskName: "B3", elementId: "Task_B3_Pre_Directo_Arcoiris" }],
  },
  {
    key: "b3_pre_directo_tinturado",
    label: "B3",
    shortLabel: "B3",
    kind: "metric",
    laneId: "pre-directo",
    laneLabel: "Preclasificacion / Directo",
    sourceStage: "B2",
    targetStage: "B3",
    focusRole: "target",
    description: `B3 Tinturado de la ruta Directo. ${PRE_SHARED_NOTE}`,
    fixedDestination: "TINTURADO",
    views: { peso: "gld.mv_camp_ind_bal_preclasif_b2_vs_b3_xl_np_weight_cur" },
    processBindings: [{ taskName: "B3", elementId: "Task_B3_Pre_Directo_Tinturado" }],
  },
  {
    key: "b3_pre_directo_blanco",
    label: "B3",
    shortLabel: "B3",
    kind: "metric",
    laneId: "pre-directo",
    laneLabel: "Preclasificacion / Directo",
    sourceStage: "B2",
    targetStage: "B3",
    focusRole: "target",
    description: `B3 Blanco de la ruta Directo. ${PRE_SHARED_NOTE}`,
    fixedDestination: "BLANCO",
    views: { peso: "gld.mv_camp_ind_bal_preclasif_b2_vs_b3_xl_np_weight_cur" },
    processBindings: [{ taskName: "B3", elementId: "Task_B3_Pre_Directo_Blanco" }],
  },
  {
    key: "general_pre_directo",
    label: "GENERAL",
    shortLabel: "GENERAL",
    kind: "aggregate",
    laneId: "pre-directo",
    laneLabel: "Preclasificacion / Directo",
    sourceStage: "B1",
    targetStage: "B3",
    focusRole: "target",
    description: `Agregado B1→B3 con ideal de la ruta Directo. ${PRE_SHARED_NOTE}`,
    views: { peso: "gld.mv_camp_ind_bal_preclasif_b1_vs_b3_ideal_weight_xl_np_cur" },
    processBindings: [{ taskName: "GENERAL", elementId: "Task_General_Pre_Directo" }],
    childrenKeys: ["b3_pre_directo_arcoiris", "b3_pre_directo_tinturado", "b3_pre_directo_blanco"],
  },
  {
    key: "b1_apertura",
    label: "B1",
    shortLabel: "B1",
    kind: "metric",
    laneId: "apertura-gv-pelado",
    laneLabel: "Apertura",
    sourceStage: "B1",
    targetStage: "B1C",
    focusRole: "source",
    description: "Nodo inicial compartido de Apertura antes de bifurcar entre GV pelado y Apertura.",
    views: {
      peso: [
        "gld.mv_camp_ind_bal_gv_b1_vs_b1c_weight_xl_np_cur",
        "gld.mv_camp_ind_bal_apertura_b1_vs_b1c_weight_xl_np_cur",
      ],
      tallos: [
        "gld.mv_camp_ind_bal_gv_b1_vs_b1c_stems_xl_np_cur",
        "gld.mv_camp_ind_bal_apertura_b1_vs_b1c_stems_xl_np_cur",
      ],
    },
    processBindings: [{ taskName: "B1", elementId: "Task_B1_Apertura" }],
  },
  {
    key: "b1c_apertura_gv",
    label: "B1C",
    shortLabel: "B1C",
    kind: "metric",
    laneId: "apertura-gv-pelado",
    laneLabel: "Apertura / GV pelado",
    sourceStage: "B1",
    targetStage: "B1C",
    focusRole: "target",
    description: "B1C de la ruta GV pelado.",
    views: {
      peso: "gld.mv_camp_ind_bal_gv_b1_vs_b1c_weight_xl_np_cur",
      tallos: "gld.mv_camp_ind_bal_gv_b1_vs_b1c_stems_xl_np_cur",
    },
    processBindings: [{ taskName: "B1C", elementId: "Task_B1C_Apertura_GV" }],
  },
  {
    key: "b2_apertura_max10",
    label: "B2",
    shortLabel: "B2",
    kind: "metric",
    laneId: "apertura-gv-pelado",
    laneLabel: "Apertura / GV pelado",
    sourceStage: "B1C",
    targetStage: "B2",
    focusRole: "target",
    description: "B2 de la ruta GV pelado, incluyendo el tramo MAX 10 dias e hidratacion.",
    views: {
      peso: "gld.mv_camp_ind_bal_gv_b1c_vs_b2_weight_xl_np_cur",
      tallos: "gld.mv_camp_ind_bal_gv_b1c_vs_b2_stems_xl_np_cur",
    },
    processBindings: [{ taskName: "B2", elementId: "Task_B2_Apertura_Max10" }],
  },
  {
    key: "b2a_apertura_max10_arcoiris",
    label: "B2A",
    shortLabel: "B2A",
    kind: "metric",
    laneId: "apertura-gv-pelado",
    laneLabel: "Apertura / GV pelado",
    sourceStage: "B2",
    targetStage: "B2A",
    focusRole: "target",
    description: "B2A Arcoiris de la ruta GV pelado.",
    fixedDestination: "ARCOIRIS",
    views: { peso: "gld.mv_camp_ind_bal_gv_b2_vs_b2a_weight_xl_np_cur" },
    processBindings: [{ taskName: "B2A", elementId: "Task_B2A_Apertura_Max10_Arcoiris" }],
  },
  {
    key: "b2a_apertura_max10_tinturado",
    label: "B2A",
    shortLabel: "B2A",
    kind: "metric",
    laneId: "apertura-gv-pelado",
    laneLabel: "Apertura / GV pelado",
    sourceStage: "B2",
    targetStage: "B2A",
    focusRole: "target",
    description: "B2A Tinturado de la ruta GV pelado.",
    fixedDestination: "TINTURADO",
    views: { peso: "gld.mv_camp_ind_bal_gv_b2_vs_b2a_weight_xl_np_cur" },
    processBindings: [{ taskName: "B2A", elementId: "Task_B2A_Apertura_Max10_Tinturado" }],
  },
  {
    key: "b2a_apertura_max10_blanco",
    label: "B2A",
    shortLabel: "B2A",
    kind: "metric",
    laneId: "apertura-gv-pelado",
    laneLabel: "Apertura / GV pelado",
    sourceStage: "B2",
    targetStage: "B2A",
    focusRole: "target",
    description: "B2A Blanco de la ruta GV pelado.",
    fixedDestination: "BLANCO",
    views: { peso: "gld.mv_camp_ind_bal_gv_b2_vs_b2a_weight_xl_np_cur" },
    processBindings: [{ taskName: "B2A", elementId: "Task_B2A_Apertura_Max10_Blanco" }],
  },
  {
    key: "general_apertura_max10",
    label: "GENERAL",
    shortLabel: "GENERAL",
    kind: "aggregate",
    laneId: "apertura-gv-pelado",
    laneLabel: "Apertura / GV pelado",
    sourceStage: "B1C",
    targetStage: "B2A",
    focusRole: "target",
    description: "Agregado B1C→B2A con ideal de la ruta GV pelado.",
    views: { peso: "gld.mv_camp_ind_bal_gv_b1c_vs_b2a_vs_ideal_weight_xl_np_cur" },
    processBindings: [{ taskName: "GENERAL", elementId: "Task_General_Apertura_Max10" }],
    childrenKeys: [
      "b2a_apertura_max10_arcoiris",
      "b2a_apertura_max10_tinturado",
      "b2a_apertura_max10_blanco",
    ],
  },
  {
    key: "b1c_apertura_directo",
    label: "B1C",
    shortLabel: "B1C",
    kind: "metric",
    laneId: "apertura-apertura",
    laneLabel: "Apertura / Apertura",
    sourceStage: "B1",
    targetStage: "B1C",
    focusRole: "target",
    description: "B1C de la ruta Apertura.",
    views: {
      peso: "gld.mv_camp_ind_bal_apertura_b1_vs_b1c_weight_xl_np_cur",
      tallos: "gld.mv_camp_ind_bal_apertura_b1_vs_b1c_stems_xl_np_cur",
    },
    processBindings: [{ taskName: "B1C", elementId: "Task_B1C_Apertura_Directo" }],
  },
  {
    key: "b2_apertura_directo",
    label: "B2",
    shortLabel: "B2",
    kind: "metric",
    laneId: "apertura-apertura",
    laneLabel: "Apertura / Apertura",
    sourceStage: "B1C",
    targetStage: "B2",
    focusRole: "target",
    description: "B2 de la ruta Apertura.",
    views: {
      peso: "gld.mv_camp_ind_bal_apertura_b1c_vs_b2_weight_xl_np_cur",
      tallos: "gld.mv_camp_ind_bal_apertura_b1c_vs_b2_stems_xl_np_cur",
    },
    processBindings: [{ taskName: "B2", elementId: "Task_B2_Apertura_Directo" }],
  },
  {
    key: "b2a_apertura_directo_arcoiris",
    label: "B2A",
    shortLabel: "B2A",
    kind: "metric",
    laneId: "apertura-apertura",
    laneLabel: "Apertura / Apertura",
    sourceStage: "B2",
    targetStage: "B2A",
    focusRole: "target",
    description: "B2A Arcoiris de la ruta Apertura.",
    fixedDestination: "ARCOIRIS",
    views: { peso: "gld.mv_camp_ind_bal_apertura_b2_vs_b2a_weight_xl_np_cur" },
    processBindings: [{ taskName: "B2A", elementId: "Task_B2A_Apertura_Directo_Arcoiris" }],
  },
  {
    key: "b2a_apertura_directo_tinturado",
    label: "B2A",
    shortLabel: "B2A",
    kind: "metric",
    laneId: "apertura-apertura",
    laneLabel: "Apertura / Apertura",
    sourceStage: "B2",
    targetStage: "B2A",
    focusRole: "target",
    description: "B2A Tinturado de la ruta Apertura.",
    fixedDestination: "TINTURADO",
    views: { peso: "gld.mv_camp_ind_bal_apertura_b2_vs_b2a_weight_xl_np_cur" },
    processBindings: [{ taskName: "B2A", elementId: "Task_B2A_Apertura_Directo_Tinturado" }],
  },
  {
    key: "b2a_apertura_directo_blanco",
    label: "B2A",
    shortLabel: "B2A",
    kind: "metric",
    laneId: "apertura-apertura",
    laneLabel: "Apertura / Apertura",
    sourceStage: "B2",
    targetStage: "B2A",
    focusRole: "target",
    description: "B2A Blanco de la ruta Apertura.",
    fixedDestination: "BLANCO",
    views: { peso: "gld.mv_camp_ind_bal_apertura_b2_vs_b2a_weight_xl_np_cur" },
    processBindings: [{ taskName: "B2A", elementId: "Task_B2A_Apertura_Directo_Blanco" }],
  },
  {
    key: "general_apertura_directo",
    label: "GENERAL",
    shortLabel: "GENERAL",
    kind: "aggregate",
    laneId: "apertura-apertura",
    laneLabel: "Apertura / Apertura",
    sourceStage: "B1C",
    targetStage: "B2A",
    focusRole: "target",
    description: "Agregado B1C→B2A con ideal de la ruta Apertura.",
    views: { peso: "gld.mv_camp_ind_bal_apertura_b1c_vs_b2a_vs_ideal_weight_xl_np_cur" },
    processBindings: [{ taskName: "GENERAL", elementId: "Task_General_Apertura_Directo" }],
    childrenKeys: [
      "b2a_apertura_directo_arcoiris",
      "b2a_apertura_directo_tinturado",
      "b2a_apertura_directo_blanco",
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

function getSourceStageTokens(stage: string, metric: BalanzasMetric = "peso") {
  // Los tokens se usan para detectar columnas de una vista por nombre canónico.
  // Para el metric "peso", se excluye "count" para no confundir columnas de tallos
  // (stems_bX_count) con columnas de peso (weight_bX_kg) en vistas mixtas.
  const isWeight = metric === "peso";

  switch (stage) {
    case "B1":
    case "BAL1":
      // weight_b1_kg / stems_b1 / b1_peso / b1_kg — excluir b1c, b1a, b2, b3
      return {
        contains: ["b1"],
        excludes: isWeight
          ? ["b1c", "b1a", "b1ab", "2", "3", "count"]
          : ["b1c", "b1a", "b1ab", "2", "3"],
      };
    case "B1AB":
    case "B1A":
    case "BAL1AB":
      // weight_b1ab_kg / stems_b1ab — excluir per_stem (factor de escala, no total)
      return {
        contains: ["b1a"],
        excludes: isWeight ? ["b1c", "per_stem", "count"] : ["b1c", "per_stem"],
      };
    case "B1C":
    case "BAL1C":
      // weight_b1c_kg / stems_b1c_count — excluir "count" para peso
      return {
        contains: ["b1c"],
        excludes: isWeight ? ["count"] : [],
      };
    case "B2":
    case "BAL2":
      // weight_b2_kg / stems_b2_count — excluir b2a y "count" para peso
      return {
        contains: ["b2"],
        excludes: isWeight ? ["b2a", "b2_a", "count"] : ["b2a", "b2_a"],
      };
    case "B2A":
    case "BAL2A":
      // weight_b2a_kg / stems_b2a — excluir "count" para peso
      return {
        contains: ["b2a"],
        excludes: isWeight ? ["count"] : [],
      };
    case "B3":
    case "BAL3":
      // weight_b3_kg / stems_b3
      return { contains: ["b3"], excludes: [] as string[] };
    case "IDEAL":
      return { contains: ["ideal"], excludes: [] as string[] };
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
  const configuredViews = node.views[metric] ?? null;
  const sourceViews = Array.isArray(configuredViews)
    ? configuredViews
    : configuredViews
      ? [configuredViews]
      : [];

  if (!sourceViews.length) {
    return null;
  }

  const columns = await loadViewColumns(sourceViews[0]!);
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
  const sourceTokens = getSourceStageTokens(node.sourceStage, metric);
  const targetTokens = getSourceStageTokens(node.targetStage, metric);

  return {
    viewName: sourceViews.join(" + "),
    sourceViews,
    fromSql: sourceViews.length === 1
      ? sourceViews[0]!
      : `(${sourceViews.map((viewName) => `select * from ${viewName}`).join(" union all ")}) as balanzas_union`,
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
          // Nombres exactos de las vistas actuales (gld.mv_camp_ind_bal_*)
          "dispatch_pct",
          "dispatch_pct_weight",
          "dispatch_pct_stems",
          "weight_diff_pct",
          "stems_diff_pct",
          "diff_pct_weight",
          "diff_pct_stems",
          "b2a_to_b1c_ratio",
          "b2a_to_ideal_ratio",
          "ideal_to_b1c_ratio",
          "yield_b1_vs_b3",
          "yield_b1_vs_ideal",
          // Patrones originales
          "diff_weight",
          "diff_stems",
          "hidr_pct",
          "desp_pct_peso",
          "desp_pct_stems",
          "ratio_pct",
          "apertura_pct",
          // Patrones extendidos para vistas modificadas
          "rendimiento_pct",
          "rendimiento_porcentaje",
          "eficiencia_pct",
          "eficiencia_porcentaje",
          "pct_rendimiento",
          "pct_eficiencia",
          "porcentaje_rendimiento",
          "porcentaje_eficiencia",
          "rendimiento",
          "eficiencia",
          "macro_indicador",
          "indicador",
        ],
        // Fallback: cualquier columna que contenga "pct"
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
      years: await loadDistinctValues(schema.fromSql, buildTextFieldExpression(schema, "year"), true),
      months: await loadDistinctValues(schema.fromSql, buildTextFieldExpression(schema, "month"), true),
      preWeeks: await loadDistinctValues(schema.fromSql, buildTextFieldExpression(schema, "preWeek"), true),
      isoWeeks: await loadDistinctValues(schema.fromSql, buildTextFieldExpression(schema, "isoWeek"), true),
      dayNames: await loadDistinctValues(schema.fromSql, buildTextFieldExpression(schema, "dayName")),
      destinations: await loadDistinctValues(schema.fromSql, buildTextFieldExpression(schema, "destination")),
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

function buildWhereClause(
  schema: BalanzasViewSchema,
  filters: BalanzasFilters,
  node: BalanzasProcessNodeDefinition,
) {
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

  if (node.fixedDestination && destinationExpression) {
    values.push(node.fixedDestination);
    conditions.push(`${destinationExpression} = $${values.length}::text`);
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

  // Cuando las columnas clave (source/target) no se detectaron automáticamente,
  // exponer TODAS las columnas numéricas de la vista primero para que el usuario
  // pueda ver los datos aunque el alias-matching haya fallado por cambios en el schema.
  const hasKeyMetrics = Boolean(schema.aliases.source && schema.aliases.targetValue);
  const remainingColumns = schema.columns
    .map((column) => column.name)
    .filter((columnName) => columnName !== schema.aliases.ratio)
    .filter((columnName) => !desiredColumns.includes(columnName))
    .sort((a, b) => {
      if (hasKeyMetrics) {
        return 0;
      }
      // Numéricas primero, luego texto
      const aNum = schema.numericColumns.includes(a) ? 0 : 1;
      const bNum = schema.numericColumns.includes(b) ? 0 : 1;
      return aNum - bNum;
    })
    // Si no se detectaron métricas clave, mostrar todas las columnas (sin límite de 4)
    .slice(0, hasKeyMetrics ? 4 : schema.columns.length);

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

function formatConfiguredViews(configuredViews: string | string[] | undefined) {
  if (!configuredViews) {
    return null;
  }

  return Array.isArray(configuredViews) ? configuredViews.join(" + ") : configuredViews;
}

function createUnavailableNodeData(
  node: BalanzasProcessNodeDefinition,
  filters: BalanzasFilters,
  message: string,
): BalanzasNodeData {
  const focusStage = node.focusRole === "source" ? node.sourceStage : node.targetStage;
  const secondaryStage = node.focusRole === "source" ? node.targetStage : node.sourceStage;
  return {
    key: node.key,
    metric: filters.metric,
    label: node.label,
    shortLabel: node.shortLabel,
    kind: node.kind,
    laneId: node.laneId,
    laneLabel: node.laneLabel,
    sourceStage: node.sourceStage,
    targetStage: node.targetStage,
    focusStage,
    focusRole: node.focusRole,
    description: node.description,
    fixedDestination: node.fixedDestination ?? null,
    sourceView: formatConfiguredViews(node.views[filters.metric]),
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
    primaryTotal: 0,
    primaryTotalDisplay: "0",
    secondaryStage,
    secondaryTotal: 0,
    secondaryTotalDisplay: "0",
    processBindings: node.processBindings,
    childrenKeys: node.childrenKeys ?? [],
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
    rawColumnNames: [],
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

  const { whereClause, values } = buildWhereClause(schema, filters, node);
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
      from ${schema.fromSql}
      ${whereClause}
    `,
    values,
  );
  const detailValues = [...values, BALANZAS_MAX_NODE_ROWS];
  const detailResult = await query<GenericQueryRow>(
    `
      select *
      from ${schema.fromSql}
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
  const primaryTotal = node.focusRole === "source" ? sourceTotal : targetTotal;
  const secondaryTotal = node.focusRole === "source" ? targetTotal : sourceTotal;
  const focusStage = node.focusRole === "source" ? node.sourceStage : node.targetStage;
  const secondaryStage = node.focusRole === "source" ? node.targetStage : node.sourceStage;

  return {
    key: node.key,
    metric: filters.metric,
    label: node.label,
    shortLabel: node.shortLabel,
    kind: node.kind,
    laneId: node.laneId,
    laneLabel: node.laneLabel,
    sourceStage: node.sourceStage,
    targetStage: node.targetStage,
    focusStage,
    focusRole: node.focusRole,
    description: node.description,
    fixedDestination: node.fixedDestination ?? null,
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
    primaryTotal,
    primaryTotalDisplay: formatNumber(primaryTotal),
    secondaryStage,
    secondaryTotal,
    secondaryTotalDisplay: formatNumber(secondaryTotal),
    processBindings: node.processBindings,
    childrenKeys: node.childrenKeys ?? [],
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
    rawColumnNames: schema.columns.map((c) => c.name),
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

// ─── Diagnóstico ────────────────────────────────────────────────────────────

async function listAvailableGldViews(): Promise<Array<{ viewName: string; columns: string[] }>> {
  // Usar pg_class en lugar de information_schema para incluir vistas materializadas (relkind='m')
  const result = await query<{ view_name: string; column_name: string }>(
    `
      select
        c.relname     as view_name,
        a.attname     as column_name
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      join pg_attribute a on a.attrelid = c.oid
      where n.nspname = 'gld'
        and c.relname like 'mv_camp_ind_bal%'
        and c.relkind in ('r', 'v', 'm')
        and a.attnum > 0
        and not a.attisdropped
      order by c.relname, a.attnum
    `,
  );

  const map = new Map<string, string[]>();
  for (const row of result.rows) {
    const key = `gld.${row.view_name}`;
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key)!.push(row.column_name);
  }

  return Array.from(map.entries()).map(([viewName, columns]) => ({ viewName, columns }));
}

export type BalanzasDiagnosticNodeSchema = {
  nodeKey: string;
  nodeLabel: string;
  viewName: string | null;
  error: string | null;
  columns: Array<{ name: string; dataType: string }>;
  aliases: {
    date: string | null;
    source: string | null;
    targetValue: string | null;
    ratio: string | null;
    destination: string | null;
    isoWeek: string | null;
    month: string | null;
    dayName: string | null;
    lot: string | null;
    grade: string | null;
    hydrationDays: string | null;
  };
  missingAliases: string[];
};

/**
 * Devuelve:
 * 1. `availableViews`: todas las vistas `gld.mv_camp_ind_bal_*` que EXISTEN
 *    actualmente en la base de datos (con sus columnas).
 * 2. `nodes`: para cada nodo del proceso, la vista configurada en el código,
 *    si existe en la BD, y qué aliases se detectaron.
 *
 * Si las vistas fueron renombradas, `nodes[].error` indica "vista no encontrada"
 * y `availableViews` muestra los nombres nuevos para actualizar el código.
 */
export async function getBalanzasDiagnosticSchema(
  metric: BalanzasMetric,
): Promise<{
  metric: BalanzasMetric;
  availableViews: Array<{ viewName: string; columns: string[] }>;
  nodes: BalanzasDiagnosticNodeSchema[];
}> {
  const [availableViews, nodeResults] = await Promise.all([
    listAvailableGldViews(),
    Promise.all(
      BALANZAS_PROCESS_NODES.map(async (node): Promise<BalanzasDiagnosticNodeSchema> => {
        const configuredViews = node.views[metric] ?? null;
        const viewName = Array.isArray(configuredViews)
          ? configuredViews.join(" + ")
          : configuredViews ?? null;

        try {
          const schema = await loadBalanzasViewSchema(node, metric);
          if (!schema) {
            return {
              nodeKey: node.key,
              nodeLabel: node.label,
              viewName,
              error: "Sin vista configurada para esta métrica.",
              columns: [],
              aliases: {
                date: null, source: null, targetValue: null, ratio: null,
                destination: null, isoWeek: null, month: null, dayName: null,
                lot: null, grade: null, hydrationDays: null,
              },
              missingAliases: ["date", "source", "targetValue", "ratio"],
            };
          }

          const aliases = {
            date: schema.aliases.date,
            source: schema.aliases.source,
            targetValue: schema.aliases.targetValue,
            ratio: schema.aliases.ratio,
            destination: schema.aliases.destination,
            isoWeek: schema.aliases.isoWeek,
            month: schema.aliases.month,
            dayName: schema.aliases.dayName,
            lot: schema.aliases.lot,
            grade: schema.aliases.grade,
            hydrationDays: schema.aliases.hydrationDays,
          };

          const missingAliases = (Object.entries(aliases) as [string, string | null][])
            .filter(([, v]) => v === null)
            .map(([k]) => k);

          return {
            nodeKey: node.key,
            nodeLabel: node.label,
            viewName: schema.viewName,
            error: null,
            columns: schema.columns.map((c) => ({ name: c.name, dataType: c.dataType })),
            aliases,
            missingAliases,
          };
        } catch (err) {
          return {
            nodeKey: node.key,
            nodeLabel: node.label,
            viewName,
            error: err instanceof Error ? err.message : String(err),
            columns: [],
            aliases: {
              date: null, source: null, targetValue: null, ratio: null,
              destination: null, isoWeek: null, month: null, dayName: null,
              lot: null, grade: null, hydrationDays: null,
            },
            missingAliases: ["date", "source", "targetValue", "ratio", "destination"],
          };
        }
      }),
    ),
  ]);

  return { metric, availableViews, nodes: nodeResults };
}
