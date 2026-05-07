import { currentDateString, currentIsoWeek } from "@/lib/talento-humano-utils";

export type TalentoFilters = {
  snapshotDate: string;
  weekFrom: string;
  weekTo: string;
  areaGeneral: string;
  area: string;
  gender: string;
  maritalStatus: string;
  city: string;
  jobTitle: string;
  employerName: string;
  jobClassification: string;
  associatedWorker: string;
};

export type TalentoFilterOptions = {
  weeksAvailable: string[];
  areaGenerals: string[];
  areas: string[];
  genders: string[];
  maritalStatuses: string[];
  cities: string[];
  jobTitles: string[];
  employerNames: string[];
  jobClassifications: string[];
  associatedWorkers: string[];
  employeeTypes: string[];
  contractTypes: string[];
  birthPlaces: string[];
  parishes: string[];
};

export type TalentoPersonRecord = {
  personId: string;
  personName: string;
  areaId: string;
  areaName: string;
  areaGeneral: string;
  gender: string | null;
  maritalStatus: string | null;
  birthPlace: string | null;
  jobTitle: string | null;
  employeeType: string | null;
  contractType: string | null;
  associatedWorkerName: string | null;
  jobClassificationCode: string | null;
  employerName: string | null;
  address: string | null;
  city: string | null;
  parish: string | null;
  birthDate: string | null;
  lastEntryDate: string | null;
  farmCode: string | null;
  nationality: string | null;
  educationTitle: string | null;
  childrenCount: number | null;
  dependentsCount: number | null;
  entryCount: number | null;
  performancePayApplicable: boolean | null;
  disabledFlag: boolean | null;
};

export type TalentoActivosData = {
  generatedAt: string;
  filters: TalentoFilters;
  options: TalentoFilterOptions;
  rows: TalentoPersonRecord[];
  summary: {
    totalPersonas: number;
    totalAreas: number;
    totalCargos: number;
  };
};

export type TalentoRotacionWeekRow = {
  isoWeekId: string;
  entries: number;
  exits: number;
  activos: number;
  rate: number | null;
};

export type TalentoSalidaRecord = TalentoPersonRecord & {
  exitDate: string | null;
  isoWeekId: string | null;
};

export type TalentoIngresoRecord = TalentoPersonRecord & {
  entryDate: string | null;
  isoWeekId: string | null;
};

export type TalentoRotacionData = {
  generatedAt: string;
  filters: TalentoFilters;
  options: TalentoFilterOptions;
  summary: {
    totalIngresos: number;
    totalSalidas: number;
    avgActivos: number;
    rotationRate: number | null;
  };
  weeklyEvolution: TalentoRotacionWeekRow[];
  ingresos: TalentoIngresoRecord[];
  salidas: TalentoSalidaRecord[];
};

export type TalentoExitFilters = {
  year: string;
  month: string;
  areaGeneral: string;
  area: string;
  jobTitle: string;
  jobClassification: string;
  associatedWorker: string;
  exitReason: string;
  resignationReason: string;
  resignationCategory: string;
  resignationClassification: string;
  complianceBucket: string;
  tenureBucket: string;
};

export type TalentoExitFilterOptions = {
  years: string[];
  months: string[];
  areaGenerals: string[];
  areas: string[];
  jobTitles: string[];
  jobClassifications: string[];
  associatedWorkers: string[];
  exitReasons: string[];
  resignationReasons: string[];
  resignationCategories: string[];
  resignationClassifications: string[];
  complianceBuckets: string[];
  tenureBuckets: string[];
};

export type TalentoExitRecord = TalentoPersonRecord & {
  nationalId: string | null;
  lastExitDate: string | null;
  entryDate: string | null;
  exitDate: string | null;
  activeDays: number | null;
  activeMonths: number | null;
  exitReason: string | null;
  resignationReason: string | null;
  resignationCategory: string | null;
  resignationClassification: string | null;
  rendimiento: number | null;
  rendimientoMin: number | null;
  cumplimiento: number | null;
  pctActualHoursRend: number | null;
  pctActualHoursHn: number | null;
  pctAbsTotal: number | null;
  observations: string | null;
  complianceBucket: string;
  tenureBucket: string;
};

export type TalentoExitData = {
  generatedAt: string;
  filters: TalentoExitFilters;
  options: TalentoExitFilterOptions;
  rows: TalentoExitRecord[];
  summary: {
    totalExits: number;
    exitsWithReason: number;
    categoriesDetected: number;
    socialWorkers: number;
    avgCompliance: number | null;
    avgRendimiento: number | null;
    avgRendimientoMin: number | null;
    avgPctActualHoursRend: number | null;
    avgPctActualHoursHn: number | null;
    avgPctAbsTotal: number | null;
    avgActiveMonths: number | null;
  };
};

export type TalentoPersonRendimientoPayload = {
  personId: string;
  generatedAt: string;
  totals: {
    rendimiento: number | null;
    rendimientoMin: number | null;
    cumplimiento: number | null;
    actualHoursHn: number;
    actualHoursRend: number;
    totalActualHours: number;
    weekCount: number;
  };
  weeklyRows: TalentoPersonRendimientoWeek[];
};

export type TalentoPersonRendimientoWeek = {
  isoWeekId: string;
  rendimiento: number | null;
  rendimientoMin: number | null;
  cumplimiento: number | null;
  actualHoursHn: number;
  actualHoursRend: number;
  totalActualHours: number;
};

export type TalentoPersonProfile = {
  personId: string;
  personName: string | null;
  nationalId: string | null;
  gender: string | null;
  maritalStatus: string | null;
  birthDate: string | null;
  birthPlace: string | null;
  jobTitle: string | null;
  employeeType: string | null;
  contractType: string | null;
  farmCode: string | null;
  associatedWorkerName: string | null;
  email: string | null;
  phoneNumber: string | null;
  address: string | null;
  city: string | null;
  parish: string | null;
  nationality: string | null;
  educationTitle: string | null;
  jobClassificationCode: string | null;
  childrenCount: number | null;
  dependentsCount: number | null;
  lastEntryDate: string | null;
  lastExitDate: string | null;
  employerName: string | null;
  performancePayApplicable: boolean | null;
  disabledFlag: boolean | null;
};

// ---------------------------------------------------------------------------
// Helpers (private — used by normalizers below)
// ---------------------------------------------------------------------------

function normalizeWeek(value: string | undefined, fallback: string) {
  const cleaned = value?.trim();
  if (!cleaned) return fallback;
  if (/^\d{6}$/.test(cleaned)) return cleaned.slice(2);
  if (/^\d{4}$/.test(cleaned)) return cleaned;
  return fallback;
}

function normalizeDate(value: string | undefined, fallback: string) {
  const cleaned = value?.trim();
  return cleaned && /^\d{4}-\d{2}-\d{2}$/.test(cleaned) ? cleaned : fallback;
}

// ---------------------------------------------------------------------------
// Filter defaults and normalizers (exported)
// ---------------------------------------------------------------------------

export const defaultTalentoFilters: TalentoFilters = {
  snapshotDate: currentDateString(),
  weekFrom: "2401",
  weekTo: currentIsoWeek(),
  areaGeneral: "all",
  area: "all",
  gender: "all",
  maritalStatus: "all",
  city: "all",
  jobTitle: "all",
  employerName: "all",
  jobClassification: "all",
  associatedWorker: "all",
};

export const defaultTalentoSnapshotFilters: TalentoFilters = {
  ...defaultTalentoFilters,
  snapshotDate: currentDateString(),
  weekFrom: currentIsoWeek(),
  weekTo: currentIsoWeek(),
};

export const defaultTalentoExitFilters: TalentoExitFilters = {
  year: String(new Date().getFullYear()),
  // Mes no se prefiltra a propósito: la vista por defecto muestra el año completo
  // para que el analista pueda comparar tendencia mensual desde el primer click.
  month: "all",
  areaGeneral: "all",
  area: "all",
  jobTitle: "all",
  jobClassification: "AGRICOLA",
  associatedWorker: "all",
  exitReason: "all",
  resignationReason: "all",
  resignationCategory: "all",
  resignationClassification: "all",
  complianceBucket: "all",
  tenureBucket: "all",
};

export function normalizeTalentoFilters(raw: Record<string, string | undefined>): TalentoFilters {
  const weekFrom = normalizeWeek(raw.weekFrom, defaultTalentoFilters.weekFrom);
  const weekTo = normalizeWeek(raw.weekTo, defaultTalentoFilters.weekTo);
  const [startWeek, endWeek] = weekFrom <= weekTo ? [weekFrom, weekTo] : [weekTo, weekFrom];

  return {
    weekFrom: startWeek,
    weekTo: endWeek,
    snapshotDate: normalizeDate(raw.snapshotDate, defaultTalentoFilters.snapshotDate),
    areaGeneral: raw.areaGeneral?.trim() || defaultTalentoFilters.areaGeneral,
    area: raw.area?.trim() || defaultTalentoFilters.area,
    gender: raw.gender?.trim() || defaultTalentoFilters.gender,
    maritalStatus: raw.maritalStatus?.trim() || defaultTalentoFilters.maritalStatus,
    city: raw.city?.trim() || defaultTalentoFilters.city,
    jobTitle: raw.jobTitle?.trim() || defaultTalentoFilters.jobTitle,
    employerName: raw.employerName?.trim() || defaultTalentoFilters.employerName,
    jobClassification: raw.jobClassification?.trim() || defaultTalentoFilters.jobClassification,
    associatedWorker: raw.associatedWorker?.trim() || defaultTalentoFilters.associatedWorker,
  };
}

export function normalizeTalentoSnapshotFilters(raw: Record<string, string | undefined>): TalentoFilters {
  const snapshotWeek = normalizeWeek(raw.weekFrom ?? raw.weekTo, defaultTalentoSnapshotFilters.weekFrom);
  const filters = normalizeTalentoFilters({
    ...raw,
    weekFrom: snapshotWeek,
    weekTo: snapshotWeek,
  });

  return {
    ...filters,
    snapshotDate: normalizeDate(raw.snapshotDate, defaultTalentoSnapshotFilters.snapshotDate),
    weekTo: filters.weekFrom,
  };
}

function normalizeYear(value: string | undefined, fallback: string) {
  const cleaned = value?.trim();
  if (!cleaned || cleaned === "all") return cleaned === "all" ? "all" : fallback;
  const years = cleaned.split(",").map((entry) => entry.trim()).filter(Boolean);
  return years.length && years.every((entry) => /^\d{4}$/.test(entry)) ? years.join(",") : fallback;
}

function normalizeMonth(value: string | undefined, fallback: string) {
  const cleaned = value?.trim();
  if (!cleaned || cleaned === "all") return cleaned === "all" ? "all" : fallback;
  const months = cleaned.split(",").map((entry) => entry.trim()).filter(Boolean);
  return months.length && months.every((entry) => /^(0?[1-9]|1[0-2])$/.test(entry))
    ? months.map((entry) => String(Number(entry))).join(",")
    : fallback;
}

function normalizeMultiFilter(value: string | undefined, fallback = "all") {
  const cleaned = value?.trim();
  return cleaned || fallback;
}

export function normalizeTalentoExitFilters(raw: Record<string, string | undefined>): TalentoExitFilters {
  return {
    year: normalizeYear(raw.year, defaultTalentoExitFilters.year),
    month: normalizeMonth(raw.month, defaultTalentoExitFilters.month),
    areaGeneral: normalizeMultiFilter(raw.areaGeneral),
    area: normalizeMultiFilter(raw.area),
    jobTitle: normalizeMultiFilter(raw.jobTitle),
    jobClassification: normalizeMultiFilter(raw.jobClassification),
    associatedWorker: normalizeMultiFilter(raw.associatedWorker),
    exitReason: normalizeMultiFilter(raw.exitReason),
    resignationReason: normalizeMultiFilter(raw.resignationReason),
    resignationCategory: normalizeMultiFilter(raw.resignationCategory),
    resignationClassification: normalizeMultiFilter(raw.resignationClassification),
    complianceBucket: normalizeMultiFilter(raw.complianceBucket),
    tenureBucket: normalizeMultiFilter(raw.tenureBucket),
  };
}

// ---------------------------------------------------------------------------
// Async loaders — implemented in talento-humano-loaders.ts
// ---------------------------------------------------------------------------

export {
  getActivosPersonas,
  getRotacionData,
  getPersonProfile,
  getPersonRendimiento,
  getDesvinculacionData,
} from "./talento-humano-loaders";

