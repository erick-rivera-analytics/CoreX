import { getISOWeek, getISOWeekYear } from "date-fns";

import { query } from "@/lib/db";
import { decodeMultiSelectValue, encodeMultiSelectValue, hasMultiSelectValue } from "@/lib/multi-select";
import { cachedAsync } from "@/lib/server-cache";
import { normalizeAreaDisplayName } from "@/shared/lib/area-normalization";

type FenogramaQueryRow = {
  cycle_key: string | null;
  area: string | null;
  block: string | null;
  variety: string | null;
  sp_type: string | null;
  sp_date: string | null;
  harvest_start_date: string | null;
  harvest_end_date: string | null;
  lifecycle_status: FenogramaLifecycle;
  iso_week_id: string;
  stems_count: number | string | null;
};

type FenogramaOptionsRow = {
  areas: string[] | null;
  varieties: string[] | null;
  sp_types: string[] | null;
};

type CycleProfileQueryRow = {
  record_id: string;
  cycle_key: string;
  valid_from: string | null;
  valid_to: string | null;
  is_current: boolean | null;
  bed_count: string | number | null;
  valve_count: string | number | null;
  pambiles_count: string | number | null;
  bed_area: number | string | null;
  variety: string | null;
  sp_type: string | null;
  light_type: string | null;
  greenhouse: boolean | null;
  parent_block: string | null;
  block_id: string | null;
  area_id: string | null;
  soil_type: string | null;
  sp_date: string | null;
  status: string | null;
  is_valid: boolean | null;
  change_reason: string | null;
  programmed_plants: string | number | null;
  cycle_start_plants: string | number | null;
  plants_dead: string | number | null;
  plants_reseeded: string | number | null;
  plants_current: string | number | null;
  availability_vs_scheduled_pct: string | number | null;
  availability_vs_initial_pct: string | number | null;
  mortality_pct: string | number | null;
  harvest_start_date: string | null;
  harvest_end_date: string | null;
  total_stems: string | number | null;
  green_weight_kg: string | number | null;
  post_weight_kg: string | number | null;
  block_programmed_plants: string | number | null;
  actual_hours: string | number | null;
  effective_hours: string | number | null;
  units_produced: string | number | null;
};

type BedProfileQueryRow = {
  record_id: string;
  bed_id: string;
  cycle_key: string;
  valve_id: string | null;
  valid_from: string | null;
  valid_to: string | null;
  is_current: boolean | null;
  length: number | string | null;
  width: number | string | null;
  pambiles_count: string | number | null;
  bed_area: string | number | null;
  variety: string | null;
  sp_type: string | null;
  attributes: string | null;
  is_valid: boolean | null;
  change_reason: string | null;
  programmed_plants: string | number | null;
  cycle_start_plants: string | number | null;
  plants_dead: string | number | null;
  plants_reseeded: string | number | null;
  plants_current: string | number | null;
  availability_vs_scheduled_pct: string | number | null;
  availability_vs_initial_pct: string | number | null;
  mortality_pct: string | number | null;
};

type BedProfileBaseQueryRow = {
  record_id: string;
  bed_id: string;
  cycle_key: string;
  valve_id: string | null;
  valid_from: string | null;
  valid_to: string | null;
  is_current: boolean | null;
  length: number | string | null;
  width: number | string | null;
  pambiles_count: string | number | null;
  bed_area: string | number | null;
  variety: string | null;
  sp_type: string | null;
  attributes: string | null;
  is_valid: boolean | null;
  change_reason: string | null;
};

type BedPlantsQueryRow = {
  bed_id: string;
  programmed_plants: string | number | null;
  cycle_start_plants: string | number | null;
  plants_dead: string | number | null;
  plants_reseeded: string | number | null;
  plants_current: string | number | null;
  availability_vs_scheduled_pct: string | number | null;
  availability_vs_initial_pct: string | number | null;
  mortality_pct: string | number | null;
};

type ValveProfileBaseQueryRow = {
  record_id: string;
  valve_id: string;
  cycle_key: string;
  block_id: string | null;
  valid_from: string | null;
  valid_to: string | null;
  is_current: boolean | null;
  attributes: string | null;
  pambiles_count: string | number | null;
  bed_area: string | number | null;
  is_valid: boolean | null;
  change_reason: string | null;
};

type ValvePlantsQueryRow = {
  valve_id: string;
  programmed_plants: string | number | null;
  cycle_start_plants: string | number | null;
  plants_dead: string | number | null;
  plants_reseeded: string | number | null;
  plants_current: string | number | null;
  availability_vs_scheduled_pct: string | number | null;
  availability_vs_initial_pct: string | number | null;
  mortality_pct: string | number | null;
};

type ValveProfileQueryRow = {
  record_id: string;
  valve_id: string;
  cycle_key: string;
  block_id: string | null;
  valid_from: string | null;
  valid_to: string | null;
  is_current: boolean | null;
  attributes: string | null;
  pambiles_count: string | number | null;
  bed_area: string | number | null;
  is_valid: boolean | null;
  change_reason: string | null;
  programmed_plants: string | number | null;
  cycle_start_plants: string | number | null;
  plants_dead: string | number | null;
  plants_reseeded: string | number | null;
  plants_current: string | number | null;
  availability_vs_scheduled_pct: string | number | null;
  availability_vs_initial_pct: string | number | null;
  mortality_pct: string | number | null;
};

type HarvestCurveQueryRow = {
  event_date: string | null;
  stems_count: number | string | null;
};

type CycleLaborHoursQueryRow = {
  cost_area: string | null;
  sub_cost_center: string | null;
  cycle_key: string;
  person_id: string | number | null;
  activity_id: string | number | null;
  activity_name: string | null;
  activity_type: string | null;
  unit_of_measure: string | null;
  actual_hours: string | number | null;
  effective_hours: string | number | null;
  units_produced: string | number | null;
};

type CycleLaborPersonProfileQueryRow = {
  person_name: string | null;
  national_id: string | null;
  gender: string | null;
  marital_status: string | null;
  birth_date: string | null;
  birth_place: string | null;
  job_title: string | null;
  employee_type: string | null;
  contract_type: string | null;
  farm_code: string | null;
  associated_worker_name: string | null;
  email: string | null;
  phone_number: string | null;
  address: string | null;
  city: string | null;
  parish: string | null;
  nationality: string | null;
  education_title: string | null;
  job_classification_code: string | null;
  children_count: string | number | null;
  dependents_count: string | number | null;
  last_entry_date: string | null;
  last_exit_date: string | null;
  employer_name: string | null;
  performance_pay_applicable: boolean | null;
  disabled_flag: boolean | null;
};

type CycleLaborPersonLookupQueryRow = {
  person_id: string | null;
  person_name: string | null;
};

type CycleLaborPersonActivityDetailQueryRow = {
  activity_id: string | null;
  activity_name: string | null;
  activity_type: string | null;
  unit_of_measure: string | null;
  actual_hours: string | number | null;
  effective_hours: string | number | null;
  units_produced: string | number | null;
  non_normal_actual_hours: string | number | null;
  historical_actual_hours: string | number | null;
  historical_units_produced: string | number | null;
  cycle_actual_hours: string | number | null;
  cycle_units_produced: string | number | null;
};

type GreenDailyQueryRow = {
  event_date: string | null;
  green_weight_kg: number | string | null;
};

type BlockModalRowQueryRow = {
  parent_block: string | null;
  area: string | null;
  variety: string | null;
  sp_type: string | null;
  sp_date: string | null;
  harvest_start_date: string | null;
  harvest_end_date: string | null;
  total_stems: number | string | null;
};

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
  weekValues: Record<string, number | null>;
};

export type FenogramaWeeklyTotal = {
  week: string;
  stems: number;
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
  /** Proportional daily green weight (kg) based on stem share */
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

export const defaultFenogramaFilters: FenogramaFilters = {
  includeActive: true,
  includePlanned: true,
  includeHistory: true,
  area: "all",
  variety: "all",
  spType: "all",
  startWeek: "",
  endWeek: "",
};

const AREA_SQL = `
  case
    when nullif(parent_block, '') is not null
      and position(concat('-', nullif(parent_block, ''), '-') in coalesce(cycle_key, '')) > 0
      then nullif(split_part(coalesce(cycle_key, ''), concat('-', nullif(parent_block, ''), '-'), 1), '')
    else nullif(split_part(coalesce(cycle_key, ''), '-', 1), '')
  end
`;

const FENOGRAMA_SOURCE = "gld.mv_prod_fenograma_cur";
const FENOGRAMA_DAY_SOURCE = "gld.mv_prod_fenograma_day_cur";
const BED_PLANTS_SOURCE = "gld.mv_camp_kardex_bed_plants_cur";
const CYCLE_PLANTS_SOURCE = "gld.mv_camp_kardex_cycle_plants_cur";
const VALVE_PLANTS_SOURCE = "gld.mv_camp_kardex_valve_plants_cur";
const PROD_HOURS_SOURCE = "gld.mv_prod_hours_cycle_person_cur";

const FENOGRAMA_OPTIONS_QUERY = `
  select
    array(
      select distinct area_value
      from (
        select ${AREA_SQL} as area_value
        from ${FENOGRAMA_SOURCE}
      ) areas
      where area_value is not null
      order by area_value
    ) as areas,
    array(
      select distinct variety_value
      from (
        select nullif(variety, '') as variety_value
        from ${FENOGRAMA_SOURCE}
      ) varieties
      where variety_value is not null
      order by variety_value
    ) as varieties,
    array(
      select distinct sp_type_value
      from (
        select nullif(sp_type, '') as sp_type_value
        from ${FENOGRAMA_SOURCE}
      ) sp_types
      where sp_type_value is not null
      order by sp_type_value
    ) as sp_types
`;

const FENOGRAMA_OPTIONS_TTL_MS = 5 * 60 * 1000;
const FENOGRAMA_DASHBOARD_TTL_MS = 30 * 1000;
const FENOGRAMA_BLOCK_TTL_MS = 60 * 1000;
const FENOGRAMA_BEDS_TTL_MS = 60 * 1000;
const FENOGRAMA_VALVE_TTL_MS = 60 * 1000;
const FENOGRAMA_CURVE_TTL_MS = 60 * 1000;
const FENOGRAMA_HOURS_TTL_MS = 60 * 1000;

function cleanText(value: string | null) {
  return value?.trim() ?? "";
}

function parseBoolean(value: string | boolean | undefined, fallback: boolean) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value !== "string") {
    return fallback;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return fallback;
}

function parseSelectValue(value: string | undefined) {
  return encodeMultiSelectValue(decodeMultiSelectValue(value));
}

function parseWeekFilter(value: string | undefined) {
  if (!value) {
    return "";
  }

  const normalizedValue = value.trim();
  return /^\d{4}$/.test(normalizedValue) ? normalizedValue : "";
}

function roundValue(value: number) {
  return Number(value.toFixed(2));
}

function toNumber(value: string | number | null) {
  if (value === null || value === undefined) {
    return null;
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function toPercentRatio(value: string | number | null) {
  const numericValue = toNumber(value);

  if (numericValue === null) {
    return null;
  }

  return Math.abs(numericValue) > 1.5 ? numericValue / 100 : numericValue;
}

function sumNumbers(values: Array<number | null | undefined>) {
  return roundValue(values.reduce<number>((sum, value) => sum + (value ?? 0), 0));
}

function toPercent(value: string | number | null) {
  const numericValue = toPercentRatio(value);

  if (numericValue === null) {
    return null;
  }

  return roundValue(numericValue * 100);
}

function toRatio(numerator: number | null, denominator: number | null) {
  if (numerator === null || denominator === null || denominator <= 0) {
    return null;
  }

  return roundValue(numerator / denominator);
}

function toPercentFromNumbers(numerator: number | null, denominator: number | null) {
  const ratio = toRatio(numerator, denominator);
  return ratio === null ? null : roundValue(ratio * 100);
}

async function getPersonNameMap(personIds: string[]) {
  const normalizedPersonIds = Array.from(new Set(
    personIds
      .map((personId) => personId.trim())
      .filter((personId) => personId.length > 0),
  ));

  if (!normalizedPersonIds.length) {
    return new Map<string, string>();
  }

  const result = await query<CycleLaborPersonLookupQueryRow>(
    `
      with ranked_profiles as (
        select
          trim(person_id::text) as person_id,
          nullif(trim(person_name), '') as person_name,
          row_number() over (
            partition by trim(person_id::text)
            order by
              case when nullif(trim(person_name), '') is null then 1 else 0 end,
              nullif(trim(person_name), '') asc
          ) as rn
        from slv.tthh_dim_person_profile_scd2
        where trim(person_id::text) = any($1::text[])
      )
      select
        person_id,
        person_name
      from ranked_profiles
      where rn = 1
    `,
    [normalizedPersonIds],
  );

  return new Map<string, string>(
    result.rows
      .map((row) => {
        const personId = cleanText(row.person_id);
        const fullName = cleanText(row.person_name);
        return personId && fullName ? [personId, fullName] as const : null;
      })
      .filter((row): row is readonly [string, string] => row !== null),
  );
}

function isMultipleOfTwenty(value: number) {
  const remainder = value % 20;
  return Math.abs(remainder) < 0.000001 || Math.abs(remainder - 20) < 0.000001;
}

function formatToday() {
  return new Date().toISOString().slice(0, 10);
}

function serializeFilters(filters: FenogramaFilters) {
  return [
    filters.includeActive ? "1" : "0",
    filters.includePlanned ? "1" : "0",
    filters.includeHistory ? "1" : "0",
    filters.area,
    filters.variety,
    filters.spType,
    filters.startWeek,
    filters.endWeek,
  ].join("|");
}

function getCurrentIsoWeekId() {
  const today = new Date();
  const isoYear = String(getISOWeekYear(today)).slice(-2);
  const isoWeek = String(getISOWeek(today)).padStart(2, "0");
  return `${isoYear}${isoWeek}`;
}

function shouldUseCurrentWeekWindow(filters: FenogramaFilters) {
  return (
    !hasMultiSelectValue(filters.area)
    && !hasMultiSelectValue(filters.variety)
    && !hasMultiSelectValue(filters.spType)
  );
}

const DEFAULT_VISIBLE_WEEK_SPAN = 24;

function buildDefaultVisibleWeeks(allWeeks: string[], filters: FenogramaFilters) {
  if (!allWeeks.length) {
    return [] as string[];
  }

  if (!shouldUseCurrentWeekWindow(filters)) {
    return allWeeks.slice(-DEFAULT_VISIBLE_WEEK_SPAN);
  }

  const currentIsoWeekId = getCurrentIsoWeekId();
  const visibleWeeks = allWeeks
    .filter((week) => Number(week) >= Number(currentIsoWeekId))
    .slice(0, DEFAULT_VISIBLE_WEEK_SPAN);

  if (visibleWeeks.length) {
    return visibleWeeks;
  }

  return allWeeks.slice(-DEFAULT_VISIBLE_WEEK_SPAN);
}

function buildVisibleWeeks(allWeeks: string[], filters: FenogramaFilters) {
  if (!allWeeks.length) {
    return {
      weeks: [] as string[],
      startWeek: "",
      endWeek: "",
    };
  }

  const requestedStartWeek = parseWeekFilter(filters.startWeek);
  const requestedEndWeek = parseWeekFilter(filters.endWeek);
  let startIndex = requestedStartWeek ? allWeeks.indexOf(requestedStartWeek) : -1;
  let endIndex = requestedEndWeek ? allWeeks.indexOf(requestedEndWeek) : -1;

  if (startIndex === -1 && endIndex === -1) {
    const defaultWeeks = buildDefaultVisibleWeeks(allWeeks, filters);

    return {
      weeks: defaultWeeks,
      startWeek: defaultWeeks[0] ?? "",
      endWeek: defaultWeeks[defaultWeeks.length - 1] ?? "",
    };
  }

  if (startIndex === -1) {
    startIndex = 0;
  }

  if (endIndex === -1) {
    endIndex = allWeeks.length - 1;
  }

  if (startIndex > endIndex) {
    [startIndex, endIndex] = [endIndex, startIndex];
  }

  const weeks = allWeeks.slice(startIndex, endIndex + 1);

  return {
    weeks,
    startWeek: weeks[0] ?? "",
    endWeek: weeks[weeks.length - 1] ?? "",
  };
}

function buildRowKey(
  row: Pick<
    FenogramaPivotRow,
    "cycleKey" | "block" | "area" | "variety" | "spType" | "spDate" | "harvestStartDate" | "harvestEndDate"
  >,
) {
  return [
    row.cycleKey,
    row.block,
    row.area,
    row.variety,
    row.spType,
    row.spDate ?? "",
    row.harvestStartDate ?? "",
    row.harvestEndDate ?? "",
  ].join("|");
}

function buildBlockModalRow(row: BlockModalRowQueryRow | null | undefined): BlockModalRow | null {
  const parentBlock = cleanText(row?.parent_block ?? null);

  if (!parentBlock) {
    return null;
  }

  return {
    block: parentBlock,
    cycleKey: null,
    area: normalizeAreaDisplayName(row?.area ?? null),
    variety: cleanText(row?.variety ?? null),
    spType: cleanText(row?.sp_type ?? null),
    spDate: row?.sp_date ?? null,
    harvestStartDate: row?.harvest_start_date ?? null,
    harvestEndDate: row?.harvest_end_date ?? null,
    totalStems: roundValue(toNumber(row?.total_stems ?? null) ?? 0),
  };
}

function normalizeAttributes(attributes: string | null) {
  if (!attributes) {
    return {} as Record<string, string>;
  }

  try {
    const parsed = JSON.parse(attributes) as Record<string, unknown>;

    return Object.fromEntries(
      Object.entries(parsed).map(([key, value]) => [key, String(value ?? "")]),
    );
  } catch {
    return {} as Record<string, string>;
  }
}

function mapBedProfileRow(row: BedProfileQueryRow): BedProfileCard {
  return {
    recordId: row.record_id,
    bedId: row.bed_id,
    cycleKey: row.cycle_key,
    valveId: cleanText(row.valve_id),
    validFrom: row.valid_from,
    validTo: row.valid_to,
    isCurrent: Boolean(row.is_current),
    isValid: row.is_valid !== false,
    length: toNumber(row.length),
    width: toNumber(row.width),
    bedArea: toNumber(row.bed_area),
    pambilesCount: toNumber(row.pambiles_count),
    variety: cleanText(row.variety),
    spType: cleanText(row.sp_type),
    changeReason: cleanText(row.change_reason),
    programmedPlants: toNumber(row.programmed_plants),
    cycleStartPlants: toNumber(row.cycle_start_plants),
    deadPlants: toNumber(row.plants_dead),
    reseededPlants: toNumber(row.plants_reseeded),
    currentPlants: toNumber(row.plants_current),
    availabilityVsScheduledPct: toPercent(row.availability_vs_scheduled_pct),
    availabilityVsInitialPct: toPercent(row.availability_vs_initial_pct),
    mortalityPct: toPercent(row.mortality_pct),
  };
}

function mapValveProfileRow(
  row: ValveProfileBaseQueryRow,
  plants?: ValvePlantsQueryRow,
): ValveProfileCard {
  const attributes = normalizeAttributes(row.attributes);

  return {
    recordId: row.record_id,
    valveId: row.valve_id,
    valveName: cleanText(attributes.valve_name ?? row.valve_id),
    cycleKey: row.cycle_key,
    blockId: cleanText(row.block_id),
    parentBlock: cleanText(attributes.parent_block),
    status: cleanText(attributes.status),
    bedCount: toNumber(attributes.bed_count ?? null),
    bedArea: toNumber(row.bed_area),
    pambilesCount: toNumber(row.pambiles_count),
    validFrom: row.valid_from,
    validTo: row.valid_to,
    isCurrent: Boolean(row.is_current),
    isValid: row.is_valid !== false,
    changeReason: cleanText(row.change_reason),
    programmedPlants: toNumber(plants?.programmed_plants ?? null),
    cycleStartPlants: toNumber(plants?.cycle_start_plants ?? null),
    deadPlants: toNumber(plants?.plants_dead ?? null),
    reseededPlants: toNumber(plants?.plants_reseeded ?? null),
    currentPlants: toNumber(plants?.plants_current ?? null),
    availabilityVsScheduledPct: toPercent(plants?.availability_vs_scheduled_pct ?? null),
    availabilityVsInitialPct: toPercent(plants?.availability_vs_initial_pct ?? null),
    mortalityPct: toPercent(plants?.mortality_pct ?? null),
  };
}

function summarizeBeds(beds: BedProfileCard[]) {
  return {
    totalBeds: beds.length,
    currentBeds: beds.filter((bed) => bed.isCurrent).length,
    validBeds: beds.filter((bed) => bed.isValid).length,
    totalProgrammedPlants: sumNumbers(beds.map((bed) => bed.programmedPlants)),
    totalCycleStartPlants: sumNumbers(beds.map((bed) => bed.cycleStartPlants)),
    totalCurrentPlants: sumNumbers(beds.map((bed) => bed.currentPlants)),
    totalBedArea: sumNumbers(beds.map((bed) => bed.bedArea)),
  };
}

function summarizeValves(valves: ValveProfileCard[]) {
  return {
    totalValves: valves.length,
    currentValves: valves.filter((valve) => valve.isCurrent).length,
    validValves: valves.filter((valve) => valve.isValid).length,
    totalProgrammedPlants: sumNumbers(valves.map((valve) => valve.programmedPlants)),
    totalCycleStartPlants: sumNumbers(valves.map((valve) => valve.cycleStartPlants)),
    totalCurrentPlants: sumNumbers(valves.map((valve) => valve.currentPlants)),
  };
}

async function loadFenogramaFilterOptions(): Promise<FenogramaFilterOptions> {
  const result = await query<FenogramaOptionsRow>(FENOGRAMA_OPTIONS_QUERY);
  const row = result.rows[0];
  const collator = new Intl.Collator("es-EC", { numeric: true, sensitivity: "base" });

  return {
    areas: Array.from(new Set((row?.areas ?? []).map((value) => normalizeAreaDisplayName(value))))
      .filter(Boolean)
      .sort((left, right) => collator.compare(left, right)),
    varieties: [...(row?.varieties ?? [])].sort((left, right) => collator.compare(left, right)),
    spTypes: [...(row?.sp_types ?? [])].sort((left, right) => collator.compare(left, right)),
  };
}

async function getFenogramaFilterOptions(): Promise<FenogramaFilterOptions> {
  return cachedAsync("fenograma:options", FENOGRAMA_OPTIONS_TTL_MS, loadFenogramaFilterOptions);
}

function mergeBedProfileRows(
  baseRows: BedProfileBaseQueryRow[],
  plantRowsByBedId: Map<string, BedPlantsQueryRow>,
) {
  return baseRows.map((row) => {
    const plants = plantRowsByBedId.get(row.bed_id);

    return mapBedProfileRow({
      ...row,
      programmed_plants: plants?.programmed_plants ?? null,
      cycle_start_plants: plants?.cycle_start_plants ?? null,
      plants_dead: plants?.plants_dead ?? null,
      plants_reseeded: plants?.plants_reseeded ?? null,
      plants_current: plants?.plants_current ?? null,
      availability_vs_scheduled_pct: plants?.availability_vs_scheduled_pct ?? null,
      availability_vs_initial_pct: plants?.availability_vs_initial_pct ?? null,
      mortality_pct: plants?.mortality_pct ?? null,
    });
  });
}

async function getBedProfiles(
  cycleKey: string,
  valveId?: string,
) {
  const baseValues = valveId ? [cycleKey, valveId] : [cycleKey];
  const baseWhereClause = valveId ? "where bp.cycle_key = $1 and bp.valve_id = $2" : "where bp.cycle_key = $1";
  const baseResult = await query<BedProfileBaseQueryRow>(
    `
      select
        bp.record_id,
        bp.bed_id,
        bp.cycle_key,
        bp.valve_id,
        to_char(bp.valid_from, 'YYYY-MM-DD') as valid_from,
        to_char(bp.valid_to, 'YYYY-MM-DD') as valid_to,
        bp.is_current,
        bp.length,
        bp.width,
        bp.pambiles_count,
        bp.bed_area,
        cp_info.variety,
        cp_info.sp_type,
        bp.attributes_jsonb as attributes,
        bp.is_valid,
        bp.change_reason
      from slv.camp_dim_bed_profile_scd2 bp
      left join lateral (
        select cp2.variety, cp2.sp_type
        from slv.camp_dim_cycle_profile_scd2 cp2
        where cp2.cycle_key = bp.cycle_key
        order by cp2.is_current desc, cp2.valid_from desc nulls last
        limit 1
      ) cp_info on true
      ${baseWhereClause}
      order by
        bp.is_current desc,
        bp.valid_from desc nulls last,
        bp.bed_id asc
    `,
    baseValues,
  );

  if (!baseResult.rows.length) {
    return [] as BedProfileCard[];
  }

  const bedIds = Array.from(new Set(baseResult.rows.map((row) => row.bed_id).filter(Boolean)));
  const plantsResult = await query<BedPlantsQueryRow>(
    `
      select distinct on (bed_id)
        bed_id,
        initial_plants as programmed_plants,
        initial_plants_cycle as cycle_start_plants,
        dead_plants_count as plants_dead,
        reseed_plants_count as plants_reseeded,
        final_plants_count as plants_current,
        pct_availability_vs_scheduled_plants as availability_vs_scheduled_pct,
        pct_availability_vs_initial_plants as availability_vs_initial_pct,
        pct_mortality as mortality_pct
      from ${BED_PLANTS_SOURCE}
      where cycle_key = $1
        and bed_id = any($2::text[])
      order by
        bed_id,
        valid_from desc nulls last
    `,
    [cycleKey, bedIds],
  );

  const plantsByBedId = new Map(
    plantsResult.rows.map((row) => [row.bed_id, row] as const),
  );

  return mergeBedProfileRows(baseResult.rows, plantsByBedId);
}

export function normalizeFenogramaFilters(
  input: Partial<Record<keyof FenogramaFilters, string | boolean | number | undefined>> = {},
): FenogramaFilters {
  return {
    includeActive: parseBoolean(
      typeof input.includeActive === "boolean" || typeof input.includeActive === "string"
        ? input.includeActive
        : undefined,
      defaultFenogramaFilters.includeActive,
    ),
    includePlanned: parseBoolean(
      typeof input.includePlanned === "boolean" || typeof input.includePlanned === "string"
        ? input.includePlanned
        : undefined,
      defaultFenogramaFilters.includePlanned,
    ),
    includeHistory: parseBoolean(
      typeof input.includeHistory === "boolean" || typeof input.includeHistory === "string"
        ? input.includeHistory
        : undefined,
      defaultFenogramaFilters.includeHistory,
    ),
    area: parseSelectValue(typeof input.area === "string" ? input.area : undefined),
    variety: parseSelectValue(typeof input.variety === "string" ? input.variety : undefined),
    spType: parseSelectValue(typeof input.spType === "string" ? input.spType : undefined),
    startWeek: parseWeekFilter(typeof input.startWeek === "string" ? input.startWeek : undefined),
    endWeek: parseWeekFilter(typeof input.endWeek === "string" ? input.endWeek : undefined),
  };
}

function buildWhereClause(filters: FenogramaFilters) {
  const conditions: string[] = [];
  const values: unknown[] = [];
  const statusConditions: string[] = [];
  const selectedAreas = decodeMultiSelectValue(filters.area);
  const selectedVarieties = decodeMultiSelectValue(filters.variety);
  const selectedSpTypes = decodeMultiSelectValue(filters.spType);

  if (filters.includePlanned) {
    statusConditions.push("sp_date >= current_date");
  }

  if (filters.includeActive) {
    statusConditions.push(
      "(sp_date < current_date and coalesce(harvest_end_date, harvest_start_date, sp_date) >= current_date)",
    );
  }

  if (filters.includeHistory) {
    statusConditions.push(
      "coalesce(harvest_end_date, harvest_start_date, sp_date) < current_date",
    );
  }

  if (statusConditions.length) {
    conditions.push(`(${statusConditions.join(" or ")})`);
  } else {
    conditions.push("1 = 0");
  }

  if (selectedAreas.length) {
    values.push(selectedAreas);
    conditions.push(`${AREA_SQL} = any($${values.length}::text[])`);
  }

  if (selectedVarieties.length) {
    values.push(selectedVarieties);
    conditions.push(`nullif(variety, '') = any($${values.length}::text[])`);
  }

  if (selectedSpTypes.length) {
    values.push(selectedSpTypes);
    conditions.push(`nullif(sp_type, '') = any($${values.length}::text[])`);
  }

  return {
    whereClause: `where ${conditions.join(" and ")}`,
    values,
  };
}

export async function getFenogramaDashboardData(
  rawFilters: Partial<Record<keyof FenogramaFilters, string | boolean | number | undefined>> = {},
): Promise<FenogramaDashboardData> {
  const filters = normalizeFenogramaFilters(rawFilters);
  return cachedAsync(
    `fenograma:dashboard:${serializeFilters(filters)}`,
    FENOGRAMA_DASHBOARD_TTL_MS,
    async () => {
      const { whereClause, values } = buildWhereClause(filters);
      const optionsPromise = getFenogramaFilterOptions();
      const result = await query<FenogramaQueryRow>(
        `
          with filtered as (
            select
              nullif(mv.cycle_key, '') as cycle_key,
              ${AREA_SQL} as area,
              nullif(mv.parent_block, '') as block,
              nullif(mv.variety, '') as variety,
              nullif(mv.sp_type, '') as sp_type,
              to_char(coalesce(cp_dates.cp_sp_date, mv.sp_date), 'YYYY-MM-DD') as sp_date,
              to_char(coalesce(cp_dates.cp_harvest_start_date, mv.harvest_start_date), 'YYYY-MM-DD') as harvest_start_date,
              to_char(coalesce(cp_dates.cp_harvest_end_date, mv.harvest_end_date), 'YYYY-MM-DD') as harvest_end_date,
              case
                when mv.sp_date >= current_date then 'planned'
                when coalesce(mv.harvest_end_date, mv.harvest_start_date, mv.sp_date) >= current_date then 'active'
                else 'history'
              end as lifecycle_status,
              mv.iso_week_id,
              coalesce(mv.stems_count, 0) as stems_count
            from ${FENOGRAMA_SOURCE} mv
            left join lateral (
              select
                sp_date           as cp_sp_date,
                harvest_start_date as cp_harvest_start_date,
                harvest_end_date   as cp_harvest_end_date
              from slv.camp_dim_cycle_profile_scd2 cp2
              where cp2.cycle_key = mv.cycle_key
              order by cp2.valid_from desc nulls last
              limit 1
            ) cp_dates on true
            ${whereClause}
          )
          select
            cycle_key,
            area,
            block,
            variety,
            sp_type,
            sp_date,
            harvest_start_date,
            harvest_end_date,
            lifecycle_status,
            iso_week_id,
            sum(stems_count) as stems_count
          from filtered
          group by 1, 2, 3, 4, 5, 6, 7, 8, 9, 10
          order by
            harvest_start_date asc nulls last,
            sp_date asc nulls last,
            area asc nulls last,
            block asc nulls last,
            variety asc nulls last,
            sp_type asc nulls last,
            iso_week_id asc
        `,
        values,
      );

      const options = await optionsPromise;
      const weeksSet = new Set<string>();
      const rowsMap = new Map<string, FenogramaPivotRow>();
      const weeklyTotalsMap = new Map<string, number>();

      for (const entry of result.rows) {
        const isoWeek = cleanText(entry.iso_week_id);

        if (!isoWeek) {
          continue;
        }

        const stemsCount = roundValue(Number(entry.stems_count ?? 0));
        const normalizedRow: Omit<FenogramaPivotRow, "id" | "totalStems" | "weekValues"> = {
          cycleKey: cleanText(entry.cycle_key),
          block: cleanText(entry.block),
          area: normalizeAreaDisplayName(entry.area),
          variety: cleanText(entry.variety),
          spType: cleanText(entry.sp_type),
          spDate: entry.sp_date,
          harvestStartDate: entry.harvest_start_date,
          harvestEndDate: entry.harvest_end_date,
          lifecycleStatus: entry.lifecycle_status,
        };
        const rowKey = buildRowKey(normalizedRow);

        weeksSet.add(isoWeek);
        weeklyTotalsMap.set(isoWeek, roundValue((weeklyTotalsMap.get(isoWeek) ?? 0) + stemsCount));

        if (!rowsMap.has(rowKey)) {
          rowsMap.set(rowKey, {
            id: rowKey,
            ...normalizedRow,
            totalStems: 0,
            weekValues: {},
          });
        }

        const currentRow = rowsMap.get(rowKey)!;
        const currentWeekValue = currentRow.weekValues[isoWeek] ?? 0;
        currentRow.weekValues[isoWeek] = roundValue(currentWeekValue + stemsCount);
      }

      const availableWeeks = Array.from(weeksSet).sort((left, right) => Number(left) - Number(right));
      const visibleWeekRange = buildVisibleWeeks(availableWeeks, filters);
      const weeks = visibleWeekRange.weeks;
      const rows = Array.from(rowsMap.values())
        .map((row) => {
          const visibleWeekValues = Object.fromEntries(
            weeks.map((week) => [week, row.weekValues[week] ?? null]),
          ) as Record<string, number | null>;
          const totalStems = sumNumbers(weeks.map((week) => visibleWeekValues[week]));

          return {
            ...row,
            totalStems,
            weekValues: visibleWeekValues,
          };
        })
        .filter((row) => row.totalStems > 0);
      const weeklyTotals = weeks.map((week) => ({
        week,
        stems: roundValue(weeklyTotalsMap.get(week) ?? 0),
      }));
      const activeRows = rows.filter((row) => row.lifecycleStatus === "active").length;
      const plannedRows = rows.filter((row) => row.lifecycleStatus === "planned").length;
      const historyRows = rows.filter((row) => row.lifecycleStatus === "history").length;

      return {
        generatedAt: new Date().toISOString(),
        today: formatToday(),
        filters: {
          ...filters,
          startWeek: visibleWeekRange.startWeek,
          endWeek: visibleWeekRange.endWeek,
        },
        options,
        availableWeeks,
        weeks,
        rows,
        weeklyTotals,
        summary: {
          rowCount: rows.length,
          weekCount: weeks.length,
          totalRecords: result.rowCount ?? result.rows.length,
          totalStems: sumNumbers(weeklyTotals.map((entry) => entry.stems)),
          firstWeek: weeks[0] ?? null,
          lastWeek: weeks.length ? weeks[weeks.length - 1] : null,
          activeRows,
          plannedRows,
          historyRows,
        },
      };
    },
  );
}

export async function getBlockModalRowsByParentBlocks(parentBlocks: string[]) {
  const normalizedBlocks = Array.from(
    new Set(parentBlocks.map((parentBlock) => cleanText(parentBlock)).filter(Boolean)),
  );

  if (!normalizedBlocks.length) {
    return {} as Record<string, BlockModalRow>;
  }

  const result = await query<BlockModalRowQueryRow>(
    `
      with cycles as (
        select
          nullif(mv.parent_block, '') as parent_block,
          nullif(mv.cycle_key, '') as cycle_key,
          ${AREA_SQL} as area,
          nullif(mv.variety, '') as variety,
          nullif(mv.sp_type, '') as sp_type,
          coalesce(cp_dates.cp_sp_date, mv.sp_date) as sp_date,
          coalesce(cp_dates.cp_harvest_start_date, mv.harvest_start_date) as harvest_start_date,
          coalesce(cp_dates.cp_harvest_end_date, mv.harvest_end_date) as harvest_end_date,
          sum(coalesce(mv.stems_count, 0)) as total_stems
        from ${FENOGRAMA_SOURCE} mv
        left join lateral (
          select
            sp_date           as cp_sp_date,
            harvest_start_date as cp_harvest_start_date,
            harvest_end_date   as cp_harvest_end_date
          from slv.camp_dim_cycle_profile_scd2 cp2
          where cp2.cycle_key = mv.cycle_key
          order by cp2.valid_from desc nulls last
          limit 1
        ) cp_dates on true
        where nullif(mv.parent_block, '') = any($1::text[])
        group by 1, 2, 3, 4, 5, 6, 7, 8
      ),
      ranked as (
        select
          parent_block,
          area,
          variety,
          sp_type,
          sp_date,
          harvest_start_date,
          harvest_end_date,
          total_stems,
          row_number() over (
            partition by parent_block
            order by
              case
                when sp_date < current_date
                  and coalesce(harvest_end_date, harvest_start_date, sp_date) >= current_date
                  then 0
                when sp_date >= current_date then 1
                else 2
              end,
              coalesce(harvest_end_date, harvest_start_date, sp_date) desc nulls last,
              sp_date desc nulls last,
              nullif(variety, '') asc nulls last,
              nullif(sp_type, '') asc nulls last,
              cycle_key asc nulls last
          ) as rn
        from cycles
      )
      select
        parent_block,
        area,
        variety,
        sp_type,
        to_char(sp_date, 'YYYY-MM-DD') as sp_date,
        to_char(harvest_start_date, 'YYYY-MM-DD') as harvest_start_date,
        to_char(harvest_end_date, 'YYYY-MM-DD') as harvest_end_date,
        total_stems
      from ranked
      where rn = 1
    `,
    [normalizedBlocks],
  );

  const rowsByParentBlock = Object.fromEntries(
    result.rows
      .map((row) => buildBlockModalRow(row))
      .filter((row): row is BlockModalRow => Boolean(row))
      .map((row) => [row.block, row]),
  ) as Record<string, BlockModalRow>;

  const missingBlocks = normalizedBlocks.filter((parentBlock) => !rowsByParentBlock[parentBlock]);

  if (!missingBlocks.length) {
    return rowsByParentBlock;
  }

  const fallbackResult = await query<BlockModalRowQueryRow>(
    `
      with ranked as (
        select
          nullif(bp.parent_block, '') as parent_block,
          nullif(bp.area_id, '') as area,
          nullif(cp.variety, '') as variety,
          nullif(cp.sp_type, '') as sp_type,
          to_char(bp.valid_from, 'YYYY-MM-DD') as sp_date,
          to_char(cp.harvest_start_date, 'YYYY-MM-DD') as harvest_start_date,
          to_char(cp.harvest_end_date, 'YYYY-MM-DD') as harvest_end_date,
          0::numeric as total_stems,
          row_number() over (
            partition by bp.parent_block
            order by
              bp.is_current desc,
              bp.valid_from desc nulls last,
              bp.block_id asc
          ) as rn
        from slv.camp_dim_block_profile_scd2 bp
        left join slv.camp_dim_cycle_profile_scd2 cp
          on cp.cycle_key = bp.cycle_key
        where nullif(bp.parent_block, '') = any($1::text[])
      )
      select
        parent_block,
        area,
        variety,
        sp_type,
        sp_date,
        harvest_start_date,
        harvest_end_date,
        total_stems
      from ranked
      where rn = 1
    `,
    [missingBlocks],
  );

  for (const row of fallbackResult.rows) {
    const blockRow = buildBlockModalRow(row);

    if (blockRow) {
      rowsByParentBlock[blockRow.block] = blockRow;
    }
  }

  return rowsByParentBlock;
}

export async function getCycleProfilesByBlock(
  parentBlock: string,
  options: { cycleKey?: string | null } = {},
): Promise<CycleProfileBlockPayload> {
  const normalizedBlock = parentBlock.trim();
  const normalizedCycleKey = cleanText(options.cycleKey ?? null) || null;
  const cacheKey = normalizedCycleKey
    ? `fenograma:block:${normalizedBlock}:cycle:${normalizedCycleKey}`
    : `fenograma:block:${normalizedBlock}`;

  return cachedAsync(cacheKey, FENOGRAMA_BLOCK_TTL_MS, async () => {
    const result = await query<CycleProfileQueryRow>(
      `
        select
          cp.record_id,
          cp.cycle_key,
          to_char(cp.valid_from, 'YYYY-MM-DD') as valid_from,
          to_char(cp.valid_to, 'YYYY-MM-DD') as valid_to,
          cp.is_current,
          cp.bed_count,
          valves.valve_count,
          cp.pambiles_count,
          cp.bed_area,
          cp.variety,
          cp.sp_type,
          cp.light_type,
          cp.greenhouse,
          cp.parent_block,
          cp.block_id,
          area_info.area_id,
          cp.soil_type,
          to_char(cp.sp_date, 'YYYY-MM-DD') as sp_date,
          cp.attributes_jsonb::jsonb ->> 'status' as status,
          cp.is_valid,
          cp.change_reason,
          plants.programmed_plants,
          plants.cycle_start_plants,
          plants.plants_dead,
          plants.plants_reseeded,
          plants.plants_current,
          plants.availability_vs_scheduled_pct,
          plants.availability_vs_initial_pct,
          plants.mortality_pct,
          to_char(cp.harvest_start_date, 'YYYY-MM-DD') as harvest_start_date,
          to_char(cp.harvest_end_date, 'YYYY-MM-DD') as harvest_end_date,
          feno.total_stems,
          green.green_weight_kg,
          post.post_weight_kg,
          block_plants.block_programmed_plants,
          labor.actual_hours,
          labor.effective_hours,
          labor.units_produced
        from slv.camp_dim_cycle_profile_scd2 cp
        left join lateral (
          select nullif(bp.area_id, '') as area_id
          from slv.camp_dim_block_profile_scd2 bp
          where bp.parent_block = cp.parent_block
            and bp.is_current = true
          order by bp.valid_from desc nulls last
          limit 1
        ) area_info on true
        left join lateral (
          select
            count(distinct valve_id) as valve_count
          from slv.camp_dim_valve_profile_scd2 vp
          where vp.cycle_key = cp.cycle_key
        ) valves on true
        left join lateral (
          select
            initial_plants as programmed_plants,
            initial_plants_cycle as cycle_start_plants,
            dead_plants_count as plants_dead,
            reseed_plants_count as plants_reseeded,
            final_plants_count as plants_current,
            pct_availability_vs_scheduled_plants as availability_vs_scheduled_pct,
            pct_availability_vs_initial_plants as availability_vs_initial_pct,
            pct_mortality as mortality_pct
          from ${CYCLE_PLANTS_SOURCE}
          where cycle_key = cp.cycle_key
          order by valid_from desc nulls last
          limit 1
        ) plants on true
        left join lateral (
          select
            coalesce(sum(stems_count), 0) as total_stems
          from ${FENOGRAMA_SOURCE}
          where cycle_key = cp.cycle_key
        ) feno on true
        left join lateral (
          select coalesce(sum(green_weight_kg), 0) as green_weight_kg
          from gld.mv_prod_productivity_green_cur
          where cycle_key = cp.cycle_key
        ) green on true
        left join lateral (
          select coalesce(sum(post_weight_kg), 0) as post_weight_kg
          from gld.mv_prod_productivity_post_cur
          where cycle_key = cp.cycle_key
        ) post on true
        left join lateral (
          select coalesce(cp2.sum_initial_plants, 0) as block_programmed_plants
          from slv.camp_dim_cycle_profile_scd2 cp2
          where cp2.block_id = cp.block_id
          order by cp2.valid_from desc nulls last
          limit 1
        ) block_plants on true
        left join lateral (
          select
            sum(actual_hours) as actual_hours,
            sum(effective_hours) as effective_hours,
            sum(units_produced) as units_produced
          from ${PROD_HOURS_SOURCE}
          where cycle_key = cp.cycle_key
        ) labor on true
        where cp.parent_block = $1
          and ($2::text is null or cp.cycle_key = $2)
        order by
          cp.is_current desc,
          cp.valid_from desc nulls last,
          cp.cycle_key asc
      `,
      [normalizedBlock, normalizedCycleKey],
    );

    const cycles = result.rows.map((row) => ({
      recordId: row.record_id,
      cycleKey: row.cycle_key,
      validFrom: row.valid_from,
      validTo: row.valid_to,
      isCurrent: Boolean(row.is_current),
      isValid: row.is_valid !== false,
      bedCount: toNumber(row.bed_count),
      valveCount: toNumber(row.valve_count),
      pambilesCount: toNumber(row.pambiles_count),
      bedArea: toNumber(row.bed_area),
      variety: cleanText(row.variety),
      spType: cleanText(row.sp_type),
      lightType: cleanText(row.light_type),
      greenhouse: Boolean(row.greenhouse),
      parentBlock: cleanText(row.parent_block),
      blockId: cleanText(row.block_id),
      areaId: normalizeAreaDisplayName(row.area_id),
      soilType: cleanText(row.soil_type),
      pruningDate: row.sp_date ?? null,
      status: cleanText(row.status),
      changeReason: cleanText(row.change_reason),
      programmedPlants: toNumber(row.programmed_plants),
      cycleStartPlants: toNumber(row.cycle_start_plants),
      deadPlants: toNumber(row.plants_dead),
      reseededPlants: toNumber(row.plants_reseeded),
      currentPlants: toNumber(row.plants_current),
      availabilityVsScheduledPct: toPercent(row.availability_vs_scheduled_pct),
      availabilityVsInitialPct: toPercent(row.availability_vs_initial_pct),
      mortalityPct: toPercent(row.mortality_pct),
      harvestStartDate: row.harvest_start_date ?? null,
      harvestEndDate: row.harvest_end_date ?? null,
      totalStems: toNumber(row.total_stems),
      greenWeightKg: toNumber(row.green_weight_kg),
      postWeightKg: toNumber(row.post_weight_kg),
      blockProgrammedPlants: toNumber(row.block_programmed_plants),
      actualHours: toNumber(row.actual_hours),
      effectiveHours: toNumber(row.effective_hours),
      unitsProduced: toNumber(row.units_produced),
    }));

    return {
      parentBlock: normalizedBlock,
      filteredCycleKey: normalizedCycleKey,
      generatedAt: new Date().toISOString(),
      summary: {
        totalCycles: cycles.length,
        currentCycles: cycles.filter((cycle) => cycle.isCurrent).length,
        validCycles: cycles.filter((cycle) => cycle.isValid).length,
        varieties: Array.from(new Set(cycles.map((cycle) => cycle.variety).filter(Boolean))).sort(),
        spTypes: Array.from(new Set(cycles.map((cycle) => cycle.spType).filter(Boolean))).sort(),
      },
      cycles,
    };
  });
}

export async function getCycleLaborHoursByCycleKey(
  cycleKey: string,
): Promise<CycleLaborHoursPayload> {
  const normalizedCycleKey = cycleKey.trim();

  return cachedAsync(`fenograma:hours:${normalizedCycleKey}`, FENOGRAMA_HOURS_TTL_MS, async () => {
    const result = await query<CycleLaborHoursQueryRow>(
      `
        select
          cycle_key,
          cost_area,
          sub_cost_center,
          person_id,
          activity_id,
          activity_name,
          activity_type,
          unit_of_measure,
          actual_hours,
          effective_hours,
          units_produced
        from ${PROD_HOURS_SOURCE}
        where cycle_key = $1
        order by
          coalesce(cost_area, '') asc,
          coalesce(sub_cost_center, '') asc,
          coalesce(activity_type, '') asc,
          coalesce(activity_name, '') asc,
          coalesce(activity_id::text, '') asc,
          coalesce(person_id::text, '') asc
      `,
      [normalizedCycleKey],
    );
    const personNameMap = await getPersonNameMap(
      result.rows.map((row) => cleanText(row.person_id === null ? null : String(row.person_id))),
    );

    const costAreaMap = new Map<string, {
      costArea: string;
      actualHours: number;
      effectiveHours: number;
      unitsProduced: number;
      subCostCenters: Map<string, {
        subCostCenter: string;
        costArea: string;
        actualHours: number;
        effectiveHours: number;
        unitsProduced: number;
        activityTypes: Map<string, {
          activityType: string;
          actualHours: number;
          effectiveHours: number;
          unitsProduced: number;
          activities: Map<string, {
            activityId: string;
            activityName: string;
            activityType: string;
            unitOfMeasure: string;
            actualHours: number;
            effectiveHours: number;
            unitsProduced: number;
            people: Map<string, CycleLaborPersonSummary>;
          }>;
        }>;
      }>;
    }>();
    const personIds = new Set<string>();
    let totalActualHours = 0;
    let totalEffectiveHours = 0;
    let totalUnitsProduced = 0;

    for (const row of result.rows) {
      const costArea = cleanText(row.cost_area) || "Sin área";
      const subCostCenter = cleanText(row.sub_cost_center) || "Sin subcentro";
      const activityType = cleanText(row.activity_type) || "Sin tipo";
      const activityId = cleanText(row.activity_id === null ? null : String(row.activity_id)) || "Sin actividad";
      const activityName = cleanText(row.activity_name) || activityId;
      const unitOfMeasure = cleanText(row.unit_of_measure);
      const personId = cleanText(row.person_id === null ? null : String(row.person_id)) || "Sin ID";
      const actualHours = toNumber(row.actual_hours) ?? 0;
      const effectiveHours = toNumber(row.effective_hours) ?? 0;
      const unitsProduced = toNumber(row.units_produced) ?? 0;

      totalActualHours += actualHours;
      totalEffectiveHours += effectiveHours;
      totalUnitsProduced += unitsProduced;
      personIds.add(personId);

      const costAreaEntry = costAreaMap.get(costArea) ?? {
        costArea, actualHours: 0, effectiveHours: 0, unitsProduced: 0, subCostCenters: new Map(),
      };
      costAreaEntry.actualHours += actualHours;
      costAreaEntry.effectiveHours += effectiveHours;
      costAreaEntry.unitsProduced += unitsProduced;
      costAreaMap.set(costArea, costAreaEntry);

      const subKey = `${costArea}|${subCostCenter}`;
      const subEntry = costAreaEntry.subCostCenters.get(subKey) ?? {
        subCostCenter, costArea, actualHours: 0, effectiveHours: 0, unitsProduced: 0, activityTypes: new Map(),
      };
      subEntry.actualHours += actualHours;
      subEntry.effectiveHours += effectiveHours;
      subEntry.unitsProduced += unitsProduced;
      costAreaEntry.subCostCenters.set(subKey, subEntry);

      const typeKey = `${subKey}|${activityType}`;
      const typeEntry = subEntry.activityTypes.get(typeKey) ?? {
        activityType, actualHours: 0, effectiveHours: 0, unitsProduced: 0, activities: new Map(),
      };
      typeEntry.actualHours += actualHours;
      typeEntry.effectiveHours += effectiveHours;
      typeEntry.unitsProduced += unitsProduced;
      subEntry.activityTypes.set(typeKey, typeEntry);

      const activityKey = `${typeKey}|${activityId}|${activityName}|${unitOfMeasure}`;
      const activityEntry = typeEntry.activities.get(activityKey) ?? {
        activityId, activityName, activityType, unitOfMeasure,
        actualHours: 0, effectiveHours: 0, unitsProduced: 0, people: new Map<string, CycleLaborPersonSummary>(),
      };
      activityEntry.actualHours += actualHours;
      activityEntry.effectiveHours += effectiveHours;
      activityEntry.unitsProduced += unitsProduced;
      typeEntry.activities.set(activityKey, activityEntry);

      const personEntry = activityEntry.people.get(personId) ?? {
        personId,
        personName: personNameMap.get(personId) ?? null,
        unitOfMeasure,
        actualHours: 0, effectiveHours: 0, unitsProduced: 0, productivity: null, rendimientoPct: null,
      };
      personEntry.actualHours += actualHours;
      personEntry.effectiveHours += effectiveHours;
      personEntry.unitsProduced += unitsProduced;
      activityEntry.people.set(personId, personEntry);
    }

    const sortLocale = (a: string, b: string) => a.localeCompare(b, "en-US", { numeric: true, sensitivity: "base" });

    const costAreas = Array.from(costAreaMap.values())
      .sort((a, b) => sortLocale(a.costArea, b.costArea))
      .map((caEntry) => {
        const subCostCenters = Array.from(caEntry.subCostCenters.values())
          .sort((a, b) => sortLocale(a.subCostCenter, b.subCostCenter))
          .map((scEntry) => {
            const activityTypes = Array.from(scEntry.activityTypes.values())
              .sort((a, b) => sortLocale(a.activityType, b.activityType))
              .map((typeEntry) => {
                const activities = Array.from(typeEntry.activities.values())
                  .sort((a, b) => {
                    const nc = sortLocale(a.activityName, b.activityName);
                    return nc !== 0 ? nc : sortLocale(a.activityId, b.activityId);
                  })
                  .map((actEntry) => {
                    const people = Array.from(actEntry.people.values())
                      .sort((a, b) => sortLocale(a.personId, b.personId))
                      .map((pe) => ({
                        ...pe,
                        actualHours: roundValue(pe.actualHours),
                        effectiveHours: roundValue(pe.effectiveHours),
                        unitsProduced: roundValue(pe.unitsProduced),
                        productivity: toRatio(pe.unitsProduced, pe.actualHours),
                        rendimientoPct: toPercentFromNumbers(pe.effectiveHours, pe.actualHours),
                      }));
                    return {
                      activityId: actEntry.activityId,
                      activityName: actEntry.activityName,
                      activityType: actEntry.activityType,
                      unitOfMeasure: actEntry.unitOfMeasure,
                      actualHours: roundValue(actEntry.actualHours),
                      effectiveHours: roundValue(actEntry.effectiveHours),
                      unitsProduced: roundValue(actEntry.unitsProduced),
                      productivity: toRatio(actEntry.unitsProduced, actEntry.actualHours),
                      rendimientoPct: toPercentFromNumbers(actEntry.effectiveHours, actEntry.actualHours),
                      people,
                    } satisfies CycleLaborActivitySummary;
                  });
                return {
                  activityType: typeEntry.activityType,
                  actualHours: roundValue(typeEntry.actualHours),
                  effectiveHours: roundValue(typeEntry.effectiveHours),
                  unitsProduced: roundValue(typeEntry.unitsProduced),
                  productivity: toRatio(typeEntry.unitsProduced, typeEntry.actualHours),
                  rendimientoPct: toPercentFromNumbers(typeEntry.effectiveHours, typeEntry.actualHours),
                  activities,
                } satisfies CycleLaborActivityTypeSummary;
              });
            return {
              subCostCenter: scEntry.subCostCenter,
              costArea: scEntry.costArea,
              actualHours: roundValue(scEntry.actualHours),
              effectiveHours: roundValue(scEntry.effectiveHours),
              unitsProduced: roundValue(scEntry.unitsProduced),
              productivity: toRatio(scEntry.unitsProduced, scEntry.actualHours),
              rendimientoPct: toPercentFromNumbers(scEntry.effectiveHours, scEntry.actualHours),
              activityTypes,
            } satisfies CycleLaborSubCostCenterSummary;
          });
        return {
          costArea: caEntry.costArea,
          actualHours: roundValue(caEntry.actualHours),
          effectiveHours: roundValue(caEntry.effectiveHours),
          unitsProduced: roundValue(caEntry.unitsProduced),
          productivity: toRatio(caEntry.unitsProduced, caEntry.actualHours),
          rendimientoPct: toPercentFromNumbers(caEntry.effectiveHours, caEntry.actualHours),
          subCostCenters,
        } satisfies CycleLaborCostAreaSummary;
      });

    const allSubCostCenters = costAreas.flatMap((ca) => ca.subCostCenters);
    const allActivityTypes = allSubCostCenters.flatMap((sc) => sc.activityTypes);
    const allActivities = allActivityTypes.flatMap((at) => at.activities);

    return {
      cycleKey: normalizedCycleKey,
      generatedAt: new Date().toISOString(),
      summary: {
        totalActualHours: roundValue(totalActualHours),
        totalEffectiveHours: roundValue(totalEffectiveHours),
        totalUnitsProduced: roundValue(totalUnitsProduced),
        costAreaCount: costAreas.length,
        subCostCenterCount: allSubCostCenters.length,
        activityTypeCount: allActivityTypes.length,
        activityCount: allActivities.length,
        personCount: personIds.size,
      },
      costAreas,
    };
  });
}

export async function getCycleLaborPersonDetailByCycleKey(
  cycleKey: string,
  personId: string,
): Promise<CycleLaborPersonDetailPayload> {
  const normalizedCycleKey = cycleKey.trim();
  const normalizedPersonId = personId.trim();

  return cachedAsync(
    `fenograma:hours:${normalizedCycleKey}:person:${normalizedPersonId}`,
    FENOGRAMA_HOURS_TTL_MS,
    async () => {
      const [profileResult, activitiesResult] = await Promise.all([
        query<CycleLaborPersonProfileQueryRow>(
          `
            with ranked_profiles as (
              select
                nullif(trim(person_name), '') as person_name,
                nullif(trim(national_id::text), '') as national_id,
                nullif(trim(gender), '') as gender,
                nullif(trim(marital_status), '') as marital_status,
                to_char(birth_date, 'YYYY-MM-DD') as birth_date,
                nullif(trim(birth_place), '') as birth_place,
                nullif(trim(job_title), '') as job_title,
                nullif(trim(employee_type), '') as employee_type,
                nullif(trim(contract_type), '') as contract_type,
                nullif(trim(farm_code::text), '') as farm_code,
                nullif(trim(associated_worker_name), '') as associated_worker_name,
                nullif(trim(email), '') as email,
                nullif(trim(phone_number::text), '') as phone_number,
                nullif(trim(address), '') as address,
                nullif(trim(city), '') as city,
                nullif(trim(parish), '') as parish,
                nullif(trim(nationality), '') as nationality,
                nullif(trim(education_title), '') as education_title,
                nullif(trim(job_classification_code::text), '') as job_classification_code,
                children_count,
                dependents_count,
                to_char(last_entry_date, 'YYYY-MM-DD') as last_entry_date,
                to_char(last_exit_date, 'YYYY-MM-DD') as last_exit_date,
                nullif(trim(employer_name), '') as employer_name,
                performance_pay_applicable,
                disabled_flag,
                row_number() over (
                  order by
                    nullif(trim(person_name), '') asc nulls last
                ) as rn
              from slv.tthh_dim_person_profile_scd2
              where trim(person_id::text) = $1
            )
            select
              person_name,
              national_id,
              gender,
              marital_status,
              birth_date,
              birth_place,
              job_title,
              employee_type,
              contract_type,
              farm_code,
              associated_worker_name,
              email,
              phone_number,
              address,
              city,
              parish,
              nationality,
              education_title,
              job_classification_code,
              children_count,
              dependents_count,
              last_entry_date,
              last_exit_date,
              employer_name,
              performance_pay_applicable,
              disabled_flag
            from ranked_profiles
            where rn = 1
          `,
          [normalizedPersonId],
        ),
        query<CycleLaborPersonActivityDetailQueryRow>(
          `
            with normalized_source as (
              select
                cycle_key,
                trim(person_id::text) as person_id,
                coalesce(nullif(trim(activity_id::text), ''), 'Sin actividad') as activity_id,
                coalesce(
                  nullif(trim(activity_name), ''),
                  coalesce(nullif(trim(activity_id::text), ''), 'Sin actividad')
                ) as activity_name,
                coalesce(nullif(trim(activity_type), ''), 'Sin tipo') as activity_type,
                coalesce(nullif(trim(unit_of_measure), ''), '') as unit_of_measure,
                coalesce(actual_hours, 0) as actual_hours,
                coalesce(effective_hours, 0) as effective_hours,
                coalesce(units_produced, 0) as units_produced
              from ${PROD_HOURS_SOURCE}
            ),
            person_cycle_activities as (
              select
                activity_id,
                activity_name,
                activity_type,
                unit_of_measure,
                sum(actual_hours) as actual_hours,
                sum(effective_hours) as effective_hours,
                sum(units_produced) as units_produced,
                sum(
                  case
                    when replace(replace(lower(unit_of_measure), ' ', ''), '.', '') <> 'hnormales'
                      then actual_hours
                    else 0
                  end
                ) as non_normal_actual_hours
              from normalized_source
              where cycle_key = $1
                and person_id = $2
              group by 1, 2, 3, 4
            ),
            cycle_activity_totals as (
              select
                activity_id,
                activity_name,
                activity_type,
                unit_of_measure,
                sum(actual_hours) as cycle_actual_hours,
                sum(units_produced) as cycle_units_produced
              from normalized_source
              where cycle_key = $1
              group by 1, 2, 3, 4
            ),
            person_activity_history as (
              select
                activity_id,
                activity_name,
                activity_type,
                unit_of_measure,
                sum(actual_hours) as historical_actual_hours,
                sum(units_produced) as historical_units_produced
              from normalized_source
              where cycle_key <> $1
                and person_id = $2
              group by 1, 2, 3, 4
            )
            select
              current_activity.activity_id,
              current_activity.activity_name,
              current_activity.activity_type,
              nullif(current_activity.unit_of_measure, '') as unit_of_measure,
              current_activity.actual_hours,
              current_activity.effective_hours,
              current_activity.units_produced,
              current_activity.non_normal_actual_hours,
              history_activity.historical_actual_hours,
              history_activity.historical_units_produced,
              cycle_activity.cycle_actual_hours,
              cycle_activity.cycle_units_produced
            from person_cycle_activities current_activity
            left join cycle_activity_totals cycle_activity
              on cycle_activity.activity_id = current_activity.activity_id
              and cycle_activity.activity_name = current_activity.activity_name
              and cycle_activity.activity_type = current_activity.activity_type
              and cycle_activity.unit_of_measure = current_activity.unit_of_measure
            left join person_activity_history history_activity
              on history_activity.activity_id = current_activity.activity_id
              and history_activity.activity_name = current_activity.activity_name
              and history_activity.activity_type = current_activity.activity_type
              and history_activity.unit_of_measure = current_activity.unit_of_measure
            order by
              current_activity.activity_name asc,
              current_activity.activity_id asc
          `,
          [normalizedCycleKey, normalizedPersonId],
        ),
      ]);

      const profileRow = profileResult.rows[0];
      const profile = profileRow
        ? {
            fullName: cleanText(profileRow.person_name) || null,
            nationalId: cleanText(profileRow.national_id) || null,
            gender: cleanText(profileRow.gender) || null,
            maritalStatus: cleanText(profileRow.marital_status) || null,
            birthDate: cleanText(profileRow.birth_date) || null,
            birthPlace: cleanText(profileRow.birth_place) || null,
            jobTitle: cleanText(profileRow.job_title) || null,
            employeeType: cleanText(profileRow.employee_type) || null,
            contractType: cleanText(profileRow.contract_type) || null,
            farmCode: cleanText(profileRow.farm_code) || null,
            associatedWorkerName: cleanText(profileRow.associated_worker_name) || null,
            email: cleanText(profileRow.email) || null,
            phoneNumber: cleanText(profileRow.phone_number) || null,
            address: cleanText(profileRow.address) || null,
            city: cleanText(profileRow.city) || null,
            parish: cleanText(profileRow.parish) || null,
            nationality: cleanText(profileRow.nationality) || null,
            educationTitle: cleanText(profileRow.education_title) || null,
            jobClassificationCode: cleanText(profileRow.job_classification_code) || null,
            childrenCount: toNumber(profileRow.children_count),
            dependentsCount: toNumber(profileRow.dependents_count),
            lastEntryDate: cleanText(profileRow.last_entry_date) || null,
            lastExitDate: cleanText(profileRow.last_exit_date) || null,
            employerName: cleanText(profileRow.employer_name) || null,
            performancePayApplicable: profileRow.performance_pay_applicable ?? null,
            disabledFlag: profileRow.disabled_flag ?? null,
          } satisfies CycleLaborPersonProfile
        : null;

      const activities = activitiesResult.rows.map((row) => {
        const actualHours = toNumber(row.actual_hours) ?? 0;
        const effectiveHours = toNumber(row.effective_hours) ?? 0;
        const unitsProduced = toNumber(row.units_produced) ?? 0;
        const historicalActualHours = toNumber(row.historical_actual_hours);
        const historicalUnitsProduced = toNumber(row.historical_units_produced);
        const cycleActualHours = toNumber(row.cycle_actual_hours);
        const cycleUnitsProduced = toNumber(row.cycle_units_produced);

        return {
          activityId: cleanText(row.activity_id) || "Sin actividad",
          activityName: cleanText(row.activity_name) || cleanText(row.activity_id) || "Sin actividad",
          activityType: cleanText(row.activity_type) || "Sin tipo",
          unitOfMeasure: cleanText(row.unit_of_measure),
          actualHours: roundValue(actualHours),
          effectiveHours: roundValue(effectiveHours),
          unitsProduced: roundValue(unitsProduced),
          productivity: toRatio(unitsProduced, actualHours),
          rendimientoPct: toPercentFromNumbers(effectiveHours, actualHours),
          historicalProductivity: toRatio(historicalUnitsProduced, historicalActualHours),
          cycleProductivity: toRatio(cycleUnitsProduced, cycleActualHours),
        } satisfies CycleLaborPersonActivityTypeSummary;
      });

      const totalActualHours = roundValue(
        activities.reduce((sum, entry) => sum + entry.actualHours, 0),
      );
      const totalEffectiveHours = roundValue(
        activities.reduce((sum, entry) => sum + entry.effectiveHours, 0),
      );
      const totalUnitsProduced = roundValue(
        activities.reduce((sum, entry) => sum + entry.unitsProduced, 0),
      );
      const totalNonNormalActualHours = roundValue(
        activitiesResult.rows.reduce(
          (sum, row) => sum + (toNumber(row.non_normal_actual_hours) ?? 0),
          0,
        ),
      );

      return {
        cycleKey: normalizedCycleKey,
        personId: normalizedPersonId,
        generatedAt: new Date().toISOString(),
        profile,
        summary: {
          totalActualHours,
          totalEffectiveHours,
          totalUnitsProduced,
          totalNonNormalActualHours,
          productivity: toRatio(totalUnitsProduced, totalActualHours),
          rendimientoPct: toPercentFromNumbers(totalEffectiveHours, totalActualHours),
          nonNormalActualHoursPct: toPercentFromNumbers(
            totalNonNormalActualHours,
            totalActualHours,
          ),
          activityCount: activities.length,
        },
        activities,
      };
    },
  );
}

export async function getBedProfilesByCycleKey(
  cycleKey: string,
): Promise<BedProfilePayload> {
  const normalizedCycleKey = cycleKey.trim();
  return cachedAsync(`fenograma:beds:${normalizedCycleKey}`, FENOGRAMA_BEDS_TTL_MS, async () => {
    const beds = await getBedProfiles(normalizedCycleKey);

    return {
      cycleKey: normalizedCycleKey,
      generatedAt: new Date().toISOString(),
      summary: summarizeBeds(beds),
      beds,
    };
  });
}

export async function getValveProfilesByCycleKey(
  cycleKey: string,
): Promise<ValveProfilesByCyclePayload> {
  const normalizedCycleKey = cycleKey.trim();

  return cachedAsync(`fenograma:valves:${normalizedCycleKey}`, FENOGRAMA_VALVE_TTL_MS, async () => {
    const baseResult = await query<ValveProfileBaseQueryRow>(
      `
        select distinct on (vp.valve_id)
          vp.record_id,
          vp.valve_id,
          vp.cycle_key,
          vp.block_id,
          to_char(vp.valid_from, 'YYYY-MM-DD') as valid_from,
          to_char(vp.valid_to, 'YYYY-MM-DD') as valid_to,
          vp.is_current,
          cp_attrs.attributes_jsonb as attributes,
          valve_beds.pambiles_count,
          valve_beds.bed_area,
          vp.is_valid,
          vp.change_reason
        from slv.camp_dim_valve_profile_scd2 vp
        left join lateral (
          select cp2.attributes_jsonb
          from slv.camp_dim_cycle_profile_scd2 cp2
          where cp2.cycle_key = vp.cycle_key
          order by cp2.is_current desc, cp2.valid_from desc nulls last
          limit 1
        ) cp_attrs on true
        left join lateral (
          select
            sum(coalesce(bp.pambiles_count, 0)) as pambiles_count,
            sum(coalesce(bp.bed_area, 0)) as bed_area
          from slv.camp_dim_bed_profile_scd2 bp
          where bp.cycle_key = vp.cycle_key
            and bp.valve_id = vp.valve_id
        ) valve_beds on true
        where vp.cycle_key = $1
        order by
          vp.valve_id asc,
          vp.is_current desc,
          vp.valid_from desc nulls last
      `,
      [normalizedCycleKey],
    );

    if (!baseResult.rows.length) {
      return {
        cycleKey: normalizedCycleKey,
        generatedAt: new Date().toISOString(),
        summary: summarizeValves([]),
        valves: [],
      };
    }

    const valveIds = Array.from(
      new Set(baseResult.rows.map((row) => row.valve_id).filter(Boolean)),
    );
    const plantsResult = await query<ValvePlantsQueryRow>(
      `
        select distinct on (valve_id)
          valve_id,
          initial_plants as programmed_plants,
          initial_plants_cycle as cycle_start_plants,
          dead_plants_count as plants_dead,
          reseed_plants_count as plants_reseeded,
          final_plants_count as plants_current,
          pct_availability_vs_scheduled_plants as availability_vs_scheduled_pct,
          pct_availability_vs_initial_plants as availability_vs_initial_pct,
          pct_mortality as mortality_pct
        from ${VALVE_PLANTS_SOURCE}
        where cycle_key = $1
          and valve_id = any($2::text[])
        order by
          valve_id,
          valid_from desc nulls last
      `,
      [normalizedCycleKey, valveIds],
    );

    const plantsByValveId = new Map(
      plantsResult.rows.map((row) => [row.valve_id, row] as const),
    );
    const valves = baseResult.rows.map((row) => mapValveProfileRow(row, plantsByValveId.get(row.valve_id)));

    return {
      cycleKey: normalizedCycleKey,
      generatedAt: new Date().toISOString(),
      summary: summarizeValves(valves),
      valves,
    };
  });
}

export async function getValveProfileByCycleAndValve(
  cycleKey: string,
  valveId: string,
): Promise<ValveProfilePayload> {
  const normalizedCycleKey = cycleKey.trim();
  const normalizedValveId = valveId.trim();
  return cachedAsync(
    `fenograma:valve:${normalizedCycleKey}:${normalizedValveId}`,
    FENOGRAMA_VALVE_TTL_MS,
    async () => {
      const [valveResult, beds] = await Promise.all([
        query<ValveProfileQueryRow>(
          `
            select
              vp.record_id,
              vp.valve_id,
              vp.cycle_key,
              vp.block_id,
              to_char(vp.valid_from, 'YYYY-MM-DD') as valid_from,
              to_char(vp.valid_to, 'YYYY-MM-DD') as valid_to,
              vp.is_current,
              cp_attrs.attributes_jsonb as attributes,
              valve_beds.pambiles_count,
              valve_beds.bed_area,
              vp.is_valid,
              vp.change_reason,
              plants.programmed_plants,
              plants.cycle_start_plants,
              plants.plants_dead,
              plants.plants_reseeded,
              plants.plants_current,
              plants.availability_vs_scheduled_pct,
              plants.availability_vs_initial_pct,
              plants.mortality_pct
            from slv.camp_dim_valve_profile_scd2 vp
            left join lateral (
              select cp2.attributes_jsonb
              from slv.camp_dim_cycle_profile_scd2 cp2
              where cp2.cycle_key = vp.cycle_key
              order by cp2.is_current desc, cp2.valid_from desc nulls last
              limit 1
            ) cp_attrs on true
            left join lateral (
              select
                sum(coalesce(bp.pambiles_count, 0)) as pambiles_count,
                sum(coalesce(bp.bed_area, 0)) as bed_area
              from slv.camp_dim_bed_profile_scd2 bp
              where bp.cycle_key = vp.cycle_key
                and bp.valve_id = vp.valve_id
            ) valve_beds on true
            left join lateral (
            select
              initial_plants as programmed_plants,
                initial_plants_cycle as cycle_start_plants,
                dead_plants_count as plants_dead,
                reseed_plants_count as plants_reseeded,
              final_plants_count as plants_current,
              pct_availability_vs_scheduled_plants as availability_vs_scheduled_pct,
              pct_availability_vs_initial_plants as availability_vs_initial_pct,
              pct_mortality as mortality_pct
              from ${VALVE_PLANTS_SOURCE}
              where cycle_key = vp.cycle_key
                and valve_id = vp.valve_id
              order by valid_from desc nulls last
              limit 1
            ) plants on true
            where vp.cycle_key = $1
              and vp.valve_id = $2
            order by
              vp.is_current desc,
              vp.valid_from desc nulls last
            limit 1
          `,
          [normalizedCycleKey, normalizedValveId],
        ),
        getBedProfiles(normalizedCycleKey, normalizedValveId),
      ]);

      const row = valveResult.rows[0];
      const attributes = normalizeAttributes(row?.attributes ?? null);

      return {
        cycleKey: normalizedCycleKey,
        valveId: normalizedValveId,
        generatedAt: new Date().toISOString(),
        valve: row
          ? {
            recordId: row.record_id,
            valveId: row.valve_id,
            valveName: cleanText(attributes.valve_name ?? row.valve_id),
            cycleKey: row.cycle_key,
            blockId: cleanText(row.block_id),
            parentBlock: cleanText(attributes.parent_block),
            status: cleanText(attributes.status),
            bedCount: toNumber(attributes.bed_count ?? null),
            bedArea: toNumber(row.bed_area),
            pambilesCount: toNumber(row.pambiles_count),
            validFrom: row.valid_from,
            validTo: row.valid_to,
            isCurrent: Boolean(row.is_current),
            isValid: row.is_valid !== false,
            changeReason: cleanText(row.change_reason),
            programmedPlants: toNumber(row.programmed_plants),
            cycleStartPlants: toNumber(row.cycle_start_plants),
            deadPlants: toNumber(row.plants_dead),
            reseededPlants: toNumber(row.plants_reseeded),
            currentPlants: toNumber(row.plants_current),
            availabilityVsScheduledPct: toPercent(row.availability_vs_scheduled_pct),
            availabilityVsInitialPct: toPercent(row.availability_vs_initial_pct),
            mortalityPct: toPercent(row.mortality_pct),
          }
          : null,
        summary: summarizeBeds(beds),
        beds,
      };
    },
  );
}

export async function getHarvestCurveByCycleKey(
  cycleKey: string,
): Promise<HarvestCurvePayload> {
  const normalizedCycleKey = cycleKey.trim();

  return cachedAsync(`fenograma:curve:${normalizedCycleKey}`, FENOGRAMA_CURVE_TTL_MS, async () => {
    const [result, greenDailyResult, greenResult, postResult] = await Promise.all([
      query<HarvestCurveQueryRow>(
        `
          select
            to_char(event_date::date, 'YYYY-MM-DD') as event_date,
            coalesce(stems_count, 0) as stems_count
          from ${FENOGRAMA_DAY_SOURCE}
          where cycle_key = $1
          order by event_date asc
        `,
        [normalizedCycleKey],
      ),
      query<GreenDailyQueryRow>(
        `
          select
            to_char(event_date::date, 'YYYY-MM-DD') as event_date,
            coalesce(green_weight_kg, 0) as green_weight_kg
          from gld.mv_prod_productivity_green_day_cur
          where cycle_key = $1
        `,
        [normalizedCycleKey],
      ),
      query<{ total: string | number }>(
        `select coalesce(sum(green_weight_kg), 0) as total from gld.mv_prod_productivity_green_cur where cycle_key = $1`,
        [normalizedCycleKey],
      ),
      query<{ total: string | number }>(
        `select coalesce(sum(post_weight_kg), 0) as total from gld.mv_prod_productivity_post_cur where cycle_key = $1`,
        [normalizedCycleKey],
      ),
    ]);

    const totalGreenWeightKg = roundValue(Number(greenResult.rows[0]?.total ?? 0));
    const totalPostWeightKg = roundValue(Number(postResult.rows[0]?.total ?? 0));

    // Build a map date → daily green kg (same approach as stems from fenograma_day)
    const greenKgByDate = new Map<string, number>();
    for (const row of greenDailyResult.rows) {
      if (row.event_date) {
        greenKgByDate.set(row.event_date, roundValue(Number(row.green_weight_kg ?? 0)));
      }
    }

    let cumulativeStems = 0;
    const rawPoints = result.rows.map((row, index) => {
      const dailyStems = roundValue(Number(row.stems_count ?? 0));
      cumulativeStems = roundValue(cumulativeStems + dailyStems);

      return {
        eventDate: row.event_date ?? "",
        eventDay: index + 1,
        dailyStems,
        cumulativeStems,
      };
    });

    const projectionStartIndex = rawPoints.findIndex((point) => !isMultipleOfTwenty(point.dailyStems));
    let cumulativeGreenKg = 0;
    const points = rawPoints.map((point, index) => {
      const isProjected = projectionStartIndex !== -1 && index >= projectionStartIndex;
      const dailyGreenKg = greenKgByDate.get(point.eventDate) ?? 0;
      cumulativeGreenKg = roundValue(cumulativeGreenKg + dailyGreenKg);

      return {
        ...point,
        observedCumulativeStems: !isProjected ? point.cumulativeStems : null,
        projectedCumulativeStems: isProjected ? point.cumulativeStems : null,
        isProjected,
        dailyGreenKg,
        cumulativeGreenKg,
        dailyWeightPerStemG: point.dailyStems > 0 ? roundValue((dailyGreenKg / point.dailyStems) * 1000) : null,
        cumulativeWeightPerStemG: point.cumulativeStems > 0 ? roundValue((cumulativeGreenKg / point.cumulativeStems) * 1000) : null,
      } satisfies HarvestCurvePoint;
    });

    const totalStems = sumNumbers(points.map((point) => point.dailyStems));

    return {
      cycleKey: normalizedCycleKey,
      generatedAt: new Date().toISOString(),
      projectionStartDay: projectionStartIndex === -1 ? null : rawPoints[projectionStartIndex]?.eventDay ?? null,
      projectionStartDate: projectionStartIndex === -1 ? null : rawPoints[projectionStartIndex]?.eventDate ?? null,
      summary: {
        totalStems,
        observedStems: sumNumbers(points.filter((point) => !point.isProjected).map((point) => point.dailyStems)),
        projectedStems: sumNumbers(points.filter((point) => point.isProjected).map((point) => point.dailyStems)),
        totalDays: points.length,
        totalGreenWeightKg,
        totalPostWeightKg,
        greenBoxes: roundValue(totalGreenWeightKg / 10),
        postBoxes: roundValue(totalPostWeightKg / 10),
        weightPerStemG: totalStems > 0 ? roundValue((totalGreenWeightKg * 1000) / totalStems) : null,
      },
      points,
    };
  });
}
