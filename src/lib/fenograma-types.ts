// Public TypeScript types for the Fenograma domain.
// No server-only imports — safe to reference from client code.

export type FenogramaLifecycle = "active" | "planned" | "history";

export type FenogramaFilters = {
  includeActive: boolean;
  includePlanned: boolean;
  includeHistory: boolean;
  area: string;
  variety: string;
  spType: string;
  startWeek: string;
  endWeek: string;
};

export type BlockModalRow = {
  block: string;
  cycleKey: string | null;
  area: string;
  variety: string;
  spType: string;
  spDate: string | null;
  harvestStartDate: string | null;
  harvestEndDate: string | null;
  totalStems: number;
  primaryMetricLabel?: string | null;
  primaryMetricText?: string | null;
};

/**
 * Métricas del Fenograma seleccionables desde el header del módulo.
 *
 * - `stems`         → Tallos cosechados (mv_prod_fenograma_cur.stems_count)
 * - `greenBoxes`    → Cajas verde (green_weight_kg / 10)
 * - `whiteBoxes`    → Cajas blanco (post_weight_kg / 10)
 * - `weightPerStem` → Peso por tallo (g/tallo) — RATIO DE SUMAS:
 *     SUM(green_weight_kg) * 1000 / NULLIF(SUM(stems_count), 0)
 *     NUNCA promedio de ratios.
 */
export type FenogramaMetric = "stems" | "greenBoxes" | "whiteBoxes" | "weightPerStem";

export const FENOGRAMA_METRIC_DEFAULT: FenogramaMetric = "stems";

export type FenogramaMetricMeta = {
  value: FenogramaMetric;
  label: string;
  unit: string;
  isRatio: boolean;
  decimals: number;
};

export const FENOGRAMA_METRIC_META: Record<FenogramaMetric, FenogramaMetricMeta> = {
  stems:         { value: "stems",         label: "Tallos",         unit: "tallos",  isRatio: false, decimals: 0 },
  greenBoxes:    { value: "greenBoxes",    label: "Cajas verde",    unit: "cajas",   isRatio: false, decimals: 0 },
  whiteBoxes:    { value: "whiteBoxes",    label: "Cajas blanco",   unit: "cajas",   isRatio: false, decimals: 0 },
  weightPerStem: { value: "weightPerStem", label: "Peso por tallo", unit: "g/tallo", isRatio: true,  decimals: 2 },
};

export function isValidFenogramaMetric(value: unknown): value is FenogramaMetric {
  return value === "stems" || value === "greenBoxes" || value === "whiteBoxes" || value === "weightPerStem";
}

/**
 * Valores brutos de las 4 métricas para una celda (semana × fila).
 *
 * `greenWeightKg` se mantiene RAW para que las agregaciones cliente-side
 * calculen `weightPerStem` como ratio de sumas en lugar de promedio de ratios.
 */
export type FenogramaWeekMetricValues = {
  stems: number;
  greenBoxes: number;
  whiteBoxes: number;
  greenWeightKg: number;
};

export type FenogramaPivotRow = {
  id: string;
  cycleKey: string;
  block: string;
  area: string;
  variety: string;
  spType: string;
  spDate: string | null;
  harvestStartDate: string | null;
  harvestEndDate: string | null;
  lifecycleStatus: FenogramaLifecycle;
  totalStems: number;
  /** Valores legacy: solo tallos. Mantener por compat con consumidores externos. */
  weekValues: Record<string, number | null>;
  /** Valores por métrica para soportar el selector. Cargados a partir del audit final 2026-04-25. */
  weekMetrics?: Record<string, FenogramaWeekMetricValues | null>;
  /** Total de cajas verde en el rango visible. */
  totalGreenBoxes?: number;
  /** Total de cajas blanco en el rango visible. */
  totalWhiteBoxes?: number;
  /** Total de green_weight_kg raw (para weightPerStem ratio de sumas). */
  totalGreenWeightKg?: number;
};

export type FenogramaWeeklyTotal = {
  week: string;
  stems: number;
  greenBoxes?: number;
  whiteBoxes?: number;
  greenWeightKg?: number;
};

export type FenogramaFilterOptions = {
  areas: string[];
  varieties: string[];
  spTypes: string[];
};

export type FenogramaDashboardData = {
  generatedAt: string;
  today: string;
  filters: FenogramaFilters;
  options: FenogramaFilterOptions;
  availableWeeks: string[];
  weeks: string[];
  rows: FenogramaPivotRow[];
  weeklyTotals: FenogramaWeeklyTotal[];
  summary: {
    rowCount: number;
    weekCount: number;
    totalRecords: number;
    totalStems: number;
    firstWeek: string | null;
    lastWeek: string | null;
    activeRows: number;
    plannedRows: number;
    historyRows: number;
  };
};

export type CycleProfileCard = {
  recordId: string;
  cycleKey: string;
  validFrom: string | null;
  validTo: string | null;
  isCurrent: boolean;
  isValid: boolean;
  bedCount: number | null;
  valveCount: number | null;
  pambilesCount: number | null;
  bedArea: number | null;
  variety: string;
  spType: string;
  lightType: string;
  greenhouse: boolean;
  parentBlock: string;
  blockId: string;
  areaId: string;
  soilType: string;
  pruningDate: string | null;
  status: string;
  changeReason: string;
  programmedPlants: number | null;
  cycleStartPlants: number | null;
  deadPlants: number | null;
  reseededPlants: number | null;
  currentPlants: number | null;
  availabilityVsScheduledPct: number | null;
  availabilityVsInitialPct: number | null;
  mortalityPct: number | null;
  harvestStartDate: string | null;
  harvestEndDate: string | null;
  totalStems: number | null;
  greenWeightKg: number | null;
  postWeightKg: number | null;
  blockProgrammedPlants: number | null;
  actualHours: number | null;
  effectiveHours: number | null;
  unitsProduced: number | null;
};

export type CycleProfileBlockPayload = {
  parentBlock: string;
  filteredCycleKey: string | null;
  generatedAt: string;
  summary: {
    totalCycles: number;
    currentCycles: number;
    validCycles: number;
    varieties: string[];
    spTypes: string[];
  };
  cycles: CycleProfileCard[];
};

export type BedProfileCard = {
  recordId: string;
  bedId: string;
  cycleKey: string;
  valveId: string;
  validFrom: string | null;
  validTo: string | null;
  isCurrent: boolean;
  isValid: boolean;
  length: number | null;
  width: number | null;
  bedArea: number | null;
  pambilesCount: number | null;
  variety: string;
  spType: string;
  changeReason: string;
  programmedPlants: number | null;
  cycleStartPlants: number | null;
  deadPlants: number | null;
  reseededPlants: number | null;
  currentPlants: number | null;
  availabilityVsScheduledPct: number | null;
  availabilityVsInitialPct: number | null;
  mortalityPct: number | null;
};

export type BedProfilePayload = {
  cycleKey: string;
  generatedAt: string;
  summary: {
    totalBeds: number;
    currentBeds: number;
    validBeds: number;
    totalProgrammedPlants: number;
    totalCycleStartPlants: number;
    totalCurrentPlants: number;
    totalBedArea: number;
  };
  beds: BedProfileCard[];
};

export type ValveProfileCard = {
  recordId: string;
  valveId: string;
  valveName: string;
  cycleKey: string;
  blockId: string;
  parentBlock: string;
  status: string;
  bedCount: number | null;
  bedArea: number | null;
  pambilesCount: number | null;
  validFrom: string | null;
  validTo: string | null;
  isCurrent: boolean;
  isValid: boolean;
  changeReason: string;
  programmedPlants: number | null;
  cycleStartPlants: number | null;
  deadPlants: number | null;
  reseededPlants: number | null;
  currentPlants: number | null;
  availabilityVsScheduledPct: number | null;
  availabilityVsInitialPct: number | null;
  mortalityPct: number | null;
};

export type ValveProfilePayload = {
  cycleKey: string;
  valveId: string;
  generatedAt: string;
  valve: ValveProfileCard | null;
  summary: {
    totalBeds: number;
    currentBeds: number;
    validBeds: number;
    totalProgrammedPlants: number;
    totalCycleStartPlants: number;
    totalCurrentPlants: number;
    totalBedArea: number;
  };
  beds: BedProfileCard[];
};

export type ValveProfilesByCyclePayload = {
  cycleKey: string;
  generatedAt: string;
  summary: {
    totalValves: number;
    currentValves: number;
    validValves: number;
    totalProgrammedPlants: number;
    totalCycleStartPlants: number;
    totalCurrentPlants: number;
  };
  valves: ValveProfileCard[];
};

export type HarvestCurvePoint = {
  eventDate: string;
  eventDay: number;
  dailyStems: number;
  cumulativeStems: number;
  observedCumulativeStems: number | null;
  projectedCumulativeStems: number | null;
  isProjected: boolean;
  dailyGreenKg: number;
  cumulativeGreenKg: number;
  dailyWeightPerStemG: number | null;
  cumulativeWeightPerStemG: number | null;
};

export type HarvestCurvePayload = {
  cycleKey: string;
  generatedAt: string;
  projectionStartDay: number | null;
  projectionStartDate: string | null;
  summary: {
    totalStems: number;
    observedStems: number;
    projectedStems: number;
    totalDays: number;
    totalGreenWeightKg: number;
    totalPostWeightKg: number;
    greenBoxes: number;
    postBoxes: number;
    weightPerStemG: number | null;
  };
  points: HarvestCurvePoint[];
};

export type CycleLaborPersonSummary = {
  personId: string;
  personName: string | null;
  unitOfMeasure: string;
  actualHours: number;
  effectiveHours: number;
  unitsProduced: number;
  productivity: number | null;
  rendimientoPct: number | null;
};

export type CycleLaborActivitySummary = {
  activityId: string;
  activityName: string;
  activityType: string;
  unitOfMeasure: string;
  actualHours: number;
  effectiveHours: number;
  unitsProduced: number;
  productivity: number | null;
  rendimientoPct: number | null;
  people: CycleLaborPersonSummary[];
};

export type CycleLaborActivityTypeSummary = {
  activityType: string;
  actualHours: number;
  effectiveHours: number;
  unitsProduced: number;
  productivity: number | null;
  rendimientoPct: number | null;
  activities: CycleLaborActivitySummary[];
};

export type CycleLaborSubCostCenterSummary = {
  subCostCenter: string;
  costArea: string;
  actualHours: number;
  effectiveHours: number;
  unitsProduced: number;
  productivity: number | null;
  rendimientoPct: number | null;
  activityTypes: CycleLaborActivityTypeSummary[];
};

export type CycleLaborCostAreaSummary = {
  costArea: string;
  actualHours: number;
  effectiveHours: number;
  unitsProduced: number;
  productivity: number | null;
  rendimientoPct: number | null;
  subCostCenters: CycleLaborSubCostCenterSummary[];
};

export type CycleLaborHoursPayload = {
  cycleKey: string;
  generatedAt: string;
  summary: {
    totalActualHours: number;
    totalEffectiveHours: number;
    totalUnitsProduced: number;
    costAreaCount: number;
    subCostCenterCount: number;
    activityTypeCount: number;
    activityCount: number;
    personCount: number;
  };
  costAreas: CycleLaborCostAreaSummary[];
};

export type CycleLaborPersonProfile = {
  fullName: string | null;
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

export type CycleLaborPersonActivityTypeSummary = {
  activityId: string;
  activityName: string;
  activityType: string;
  unitOfMeasure: string;
  actualHours: number;
  effectiveHours: number;
  unitsProduced: number;
  productivity: number | null;
  rendimientoPct: number | null;
  historicalProductivity: number | null;
  cycleProductivity: number | null;
};

export type CycleLaborPersonDetailPayload = {
  cycleKey: string;
  personId: string;
  generatedAt: string;
  profile: CycleLaborPersonProfile | null;
  summary: {
    totalActualHours: number;
    totalEffectiveHours: number;
    totalUnitsProduced: number;
    totalNonNormalActualHours: number;
    productivity: number | null;
    rendimientoPct: number | null;
    nonNormalActualHoursPct: number | null;
    activityCount: number;
  };
  activities: CycleLaborPersonActivityTypeSummary[];
};
