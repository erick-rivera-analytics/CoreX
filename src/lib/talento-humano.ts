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

export type TalentoPersonRendimientoActivity = {
  activityId: string;
  activityName: string;
  activityType: string;
  unitOfMeasure: string;
  actualHours: number;
  effectiveHours: number;
  unitsProduced: number;
  productivity: number | null;
  rendimientoPct: number | null;
};

export type TalentoPersonRendimientoCycle = {
  cycleKey: string;
  totalActualHours: number;
  totalEffectiveHours: number;
  totalUnitsProduced: number;
  rendimientoPct: number | null;
  activities: TalentoPersonRendimientoActivity[];
};

export type TalentoPersonRendimientoPayload = {
  personId: string;
  generatedAt: string;
  totals: {
    totalActualHours: number;
    totalEffectiveHours: number;
    totalUnitsProduced: number;
    rendimientoPct: number | null;
    cycleCount: number;
    activityCount: number;
  };
  cycles: TalentoPersonRendimientoCycle[];
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

// ---------------------------------------------------------------------------
// Async loaders — implemented in talento-humano-loaders.ts
// ---------------------------------------------------------------------------

export { getActivosPersonas, getRotacionData, getPersonProfile, getPersonRendimiento } from "./talento-humano-loaders";

