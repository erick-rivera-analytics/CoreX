import { query } from "@/lib/db";
import { decodeMultiSelectValue } from "@/lib/multi-select";
import { roundValue, toNumber } from "@/shared/lib/number-utils";

const SOURCE_TABLE = "hist.temp_monitoreo_verde";
const MAX_CHART_RECORDS = 900;

export type PuntoAperturaFilters = {
  isoWeek: string;
  area: string;
  spType: string;
  month: string;
  year: string;
  dominantClass: string;
};

export type PuntoAperturaStatus = "Homogeneo" | "No homogeneo";

export type PuntoAperturaRecord = {
  id: string;
  fecha: string;
  bloque: string;
  ciclo: string;
  area: string;
  spType: string;
  month: string;
  year: string;
  isoWeekId: string;
  totalApertura: number;
  tallosMalla: number | null;
  dominanteClase: string;
  dominanteValor: number;
  dominantePct: number;
  estado: PuntoAperturaStatus;
  apertura: {
    boton: number;
    unoTres: number;
    cuatroNueve: number;
    diezVeinte: number;
    masVeinte: number;
  };
  participacion: {
    boton: number;
    unoTres: number;
    cuatroNueve: number;
    diezVeinte: number;
    masVeinte: number;
  };
};

export type PuntoAperturaOptions = {
  isoWeeks: string[];
  areas: string[];
  spTypes: string[];
  months: string[];
  years: string[];
  dominantClasses: string[];
};

export type PuntoAperturaDashboardData = {
  generatedAt: string;
  filters: PuntoAperturaFilters;
  options: PuntoAperturaOptions;
  records: PuntoAperturaRecord[];
  chartRecords: PuntoAperturaRecord[];
  summary: {
    totalRecords: number;
    totalCycles: number;
    meanPct: number;
    sdPct: number;
    lowerLimitPct: number;
    visibleMeanPct: number;
    visibleSdPct: number;
    homogeneousRecords: number;
    nonHomogeneousRecords: number;
    homogeneousPct: number;
    dominantClass: string;
    chartRecordLimit: number;
  };
};

type OptionsRow = {
  iso_weeks: string[] | null;
  areas: string[] | null;
  sp_types: string[] | null;
  months: string[] | null;
  years: string[] | null;
  dominant_classes: string[] | null;
};

type RecordRow = {
  record_index: string | number;
  fecha: string | null;
  bloque: string | null;
  ciclo: string | null;
  area: string | null;
  sp_type: string | null;
  record_month: string | null;
  record_year: string | null;
  iso_week_id: string | null;
  boton: string | number | null;
  uno_tres: string | number | null;
  cuatro_nueve: string | number | null;
  diez_veinte: string | number | null;
  mas_veinte: string | number | null;
  total_apertura: string | number | null;
  tallos_malla: string | number | null;
  dominante_valor: string | number | null;
  dominante_clase: string | null;
  dominante_pct: string | number | null;
};

export { CALIDAD_CHART_COLORS } from "@/lib/calidad-chart-colors";

export const defaultPuntoAperturaFilters: PuntoAperturaFilters = {
  isoWeek: "all",
  area: "all",
  spType: "all",
  month: "all",
  year: "all",
  dominantClass: "all",
};

export function normalizePuntoAperturaFilters(input: Partial<PuntoAperturaFilters> = {}): PuntoAperturaFilters {
  return {
    isoWeek: normalizeSelect(input.isoWeek),
    area: normalizeSelect(input.area),
    spType: normalizeSelect(input.spType),
    month: normalizeSelect(input.month),
    year: normalizeSelect(input.year),
    dominantClass: normalizeSelect(input.dominantClass),
  };
}

function normalizeSelect(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : "all";
}

function sqlArrayFilter(alias: string, column: string, values: string[], params: unknown[]) {
  if (!values.length) return "";
  params.push(values);
  return ` and ${alias}.${column} = any($${params.length}::text[])`;
}

function buildBaseSql(whereSql = "") {
  return `
    with primeras as (
      select
        ciclo,
        min(fecha) filter (
          where coalesce(ptoapertura_boton, 0)
            + coalesce(ptoapertura_1a3, 0)
            + coalesce(ptoapertura_4a9, 0)
            + coalesce(ptoapertura_10a20, 0)
            + coalesce(ptoapertura_mas20, 0) > 0
        ) as primera_fecha_con_apertura
      from ${SOURCE_TABLE}
      group by ciclo
    ),
    cycle_profile as (
      select distinct on (cycle_key)
        cycle_key::text,
        nullif(area_id, '') as area,
        nullif(sp_type, '') as sp_type
      from slv.camp_dim_cycle_profile_scd2
      order by cycle_key, valid_from desc nulls last
    ),
    base as (
      select
        to_char(t.fecha::date, 'YYYY-MM-DD') as fecha,
        nullif(t.bloque, '') as bloque,
        t.ciclo::text as ciclo,
        coalesce(cp.area, 'Sin area') as area,
        coalesce(cp.sp_type, 'Sin tipo') as sp_type,
        to_char(t.fecha::date, 'YYYY-MM') as record_month,
        extract(year from t.fecha::date)::text as record_year,
        coalesce(c.iso_week_id, concat(c.iso_year::text, '-', lpad(c.iso_week::text, 2, '0'))) as iso_week_id,
        coalesce(t.ptoapertura_boton, 0)::numeric as boton,
        coalesce(t.ptoapertura_1a3, 0)::numeric as uno_tres,
        coalesce(t.ptoapertura_4a9, 0)::numeric as cuatro_nueve,
        coalesce(t.ptoapertura_10a20, 0)::numeric as diez_veinte,
        coalesce(t.ptoapertura_mas20, 0)::numeric as mas_veinte,
        nullif(t.num_tallos_por_malla_cv, 0)::numeric as tallos_malla
      from ${SOURCE_TABLE} t
      join primeras p on p.ciclo = t.ciclo
      left join slv.common_dim_calendar_date_scd0 c on c.calendar_date = t.fecha::date
      left join cycle_profile cp on cp.cycle_key = t.ciclo::text
      where p.primera_fecha_con_apertura is not null
        and t.fecha >= p.primera_fecha_con_apertura
    ),
    scored as (
      select
        row_number() over (order by fecha asc, ciclo asc, bloque asc) as record_index,
        *,
        boton + uno_tres + cuatro_nueve + diez_veinte + mas_veinte as total_apertura,
        greatest(boton, uno_tres, cuatro_nueve, diez_veinte, mas_veinte) as dominante_valor
      from base
    ),
    useful as (
      select
        *,
        case greatest(boton, uno_tres, cuatro_nueve, diez_veinte, mas_veinte)
          when boton then 'Boton'
          when uno_tres then '1 a 3'
          when cuatro_nueve then '4 a 9'
          when diez_veinte then '10 a 20'
          else 'Mas de 20'
        end as dominante_clase,
        dominante_valor / nullif(total_apertura, 0) as dominante_pct
      from scored
      where total_apertura > 0
    )
    select * from useful u
    where 1 = 1
    ${whereSql}
  `;
}

async function getOptions(): Promise<PuntoAperturaOptions> {
  const result = await query<OptionsRow>(`
    with primeras as (
      select
        ciclo,
        min(fecha) filter (
          where coalesce(ptoapertura_boton, 0)
            + coalesce(ptoapertura_1a3, 0)
            + coalesce(ptoapertura_4a9, 0)
            + coalesce(ptoapertura_10a20, 0)
            + coalesce(ptoapertura_mas20, 0) > 0
        ) as primera_fecha_con_apertura
      from ${SOURCE_TABLE}
      group by ciclo
    ),
    cycle_profile as (
      select distinct on (cycle_key)
        cycle_key::text,
        nullif(area_id, '') as area,
        nullif(sp_type, '') as sp_type
      from slv.camp_dim_cycle_profile_scd2
      order by cycle_key, valid_from desc nulls last
    ),
    filtered as (
      select
        coalesce(c.iso_week_id, concat(c.iso_year::text, '-', lpad(c.iso_week::text, 2, '0'))) as iso_week_id,
        coalesce(cp.area, 'Sin area') as area,
        coalesce(cp.sp_type, 'Sin tipo') as sp_type,
        to_char(t.fecha::date, 'YYYY-MM') as record_month,
        extract(year from t.fecha::date)::text as record_year,
        case greatest(
          coalesce(t.ptoapertura_boton, 0),
          coalesce(t.ptoapertura_1a3, 0),
          coalesce(t.ptoapertura_4a9, 0),
          coalesce(t.ptoapertura_10a20, 0),
          coalesce(t.ptoapertura_mas20, 0)
        )
          when coalesce(t.ptoapertura_boton, 0) then 'Boton'
          when coalesce(t.ptoapertura_1a3, 0) then '1 a 3'
          when coalesce(t.ptoapertura_4a9, 0) then '4 a 9'
          when coalesce(t.ptoapertura_10a20, 0) then '10 a 20'
          else 'Mas de 20'
        end as dominant_class
      from ${SOURCE_TABLE} t
      join primeras p on p.ciclo = t.ciclo
      left join slv.common_dim_calendar_date_scd0 c on c.calendar_date = t.fecha::date
      left join cycle_profile cp on cp.cycle_key = t.ciclo::text
      where p.primera_fecha_con_apertura is not null
        and t.fecha >= p.primera_fecha_con_apertura
        and coalesce(t.ptoapertura_boton, 0)
          + coalesce(t.ptoapertura_1a3, 0)
          + coalesce(t.ptoapertura_4a9, 0)
          + coalesce(t.ptoapertura_10a20, 0)
          + coalesce(t.ptoapertura_mas20, 0) > 0
    )
    select
      array(select distinct iso_week_id from filtered where iso_week_id is not null order by iso_week_id desc) as iso_weeks,
      array(select distinct area from filtered where area is not null order by area) as areas,
      array(select distinct sp_type from filtered where sp_type is not null order by sp_type) as sp_types,
      array(select distinct record_month from filtered where record_month is not null order by record_month desc) as months,
      array(select distinct record_year from filtered where record_year is not null order by record_year desc) as years,
      array(select distinct dominant_class from filtered where dominant_class is not null order by dominant_class) as dominant_classes
  `);

  const row = result.rows[0];
  return {
    isoWeeks: row?.iso_weeks ?? [],
    areas: row?.areas ?? [],
    spTypes: row?.sp_types ?? [],
    months: row?.months ?? [],
    years: row?.years ?? [],
    dominantClasses: row?.dominant_classes ?? [],
  };
}

async function getGlobalBaseline() {
  const result = await query<{ mean_pct: string | number | null; sd_pct: string | number | null }>(`
    select
      avg(dominante_pct) * 100 as mean_pct,
      stddev_samp(dominante_pct) * 100 as sd_pct
    from (
      ${buildBaseSql("")}
    ) baseline
  `);
  const meanPct = toNumber(result.rows[0]?.mean_pct, 0) ?? 0;
  const sdPct = toNumber(result.rows[0]?.sd_pct, 0) ?? 0;
  return {
    meanPct,
    sdPct,
    lowerLimitPct: Math.max(0, meanPct - sdPct),
  };
}

export async function getPuntoAperturaDashboardData(
  rawFilters: Partial<PuntoAperturaFilters> = defaultPuntoAperturaFilters,
): Promise<PuntoAperturaDashboardData> {
  const filters = normalizePuntoAperturaFilters(rawFilters);
  const params: unknown[] = [];
  const whereParts = [
    sqlArrayFilter("u", "iso_week_id", decodeMultiSelectValue(filters.isoWeek), params),
    sqlArrayFilter("u", "area", decodeMultiSelectValue(filters.area), params),
    sqlArrayFilter("u", "sp_type", decodeMultiSelectValue(filters.spType), params),
    sqlArrayFilter("u", "record_month", decodeMultiSelectValue(filters.month), params),
    sqlArrayFilter("u", "record_year", decodeMultiSelectValue(filters.year), params),
    sqlArrayFilter("u", "dominante_clase", decodeMultiSelectValue(filters.dominantClass), params),
  ].filter(Boolean);

  const sql = `
    ${buildBaseSql(whereParts.join("\n"))}
    order by fecha asc, record_index asc
  `;

  const [options, baseline, result] = await Promise.all([
    getOptions(),
    getGlobalBaseline(),
    query<RecordRow>(sql, params),
  ]);

  const rawRecords = result.rows.map(mapRecordRow);
  const visibleMeanPct = mean(rawRecords.map((record) => record.dominantePct));
  const visibleSdPct = sampleSd(rawRecords.map((record) => record.dominantePct));
  const lowerLimitPct = baseline.lowerLimitPct;
  const records = rawRecords.map((record) => ({
    ...record,
    estado: record.dominantePct >= lowerLimitPct ? "Homogeneo" : "No homogeneo",
  }) satisfies PuntoAperturaRecord);
  const homogeneousRecords = records.filter((record) => record.estado === "Homogeneo").length;
  const dominantClass = getDominantClass(records);

  return {
    generatedAt: new Date().toISOString(),
    filters,
    options,
    records,
    chartRecords: records.slice(-MAX_CHART_RECORDS),
    summary: {
      totalRecords: records.length,
      totalCycles: new Set(records.map((record) => record.ciclo)).size,
      meanPct: roundValue(baseline.meanPct, 2),
      sdPct: roundValue(baseline.sdPct, 2),
      lowerLimitPct: roundValue(lowerLimitPct, 2),
      visibleMeanPct: roundValue(visibleMeanPct, 2),
      visibleSdPct: roundValue(visibleSdPct, 2),
      homogeneousRecords,
      nonHomogeneousRecords: records.length - homogeneousRecords,
      homogeneousPct: records.length ? roundValue((homogeneousRecords / records.length) * 100, 2) : 0,
      dominantClass,
      chartRecordLimit: MAX_CHART_RECORDS,
    },
  };
}

function mapRecordRow(row: RecordRow): PuntoAperturaRecord {
  const totalApertura = toNumber(row.total_apertura, 0) ?? 0;
  const apertura = {
    boton: toNumber(row.boton, 0) ?? 0,
    unoTres: toNumber(row.uno_tres, 0) ?? 0,
    cuatroNueve: toNumber(row.cuatro_nueve, 0) ?? 0,
    diezVeinte: toNumber(row.diez_veinte, 0) ?? 0,
    masVeinte: toNumber(row.mas_veinte, 0) ?? 0,
  };
  const participacion = {
    boton: pct(apertura.boton, totalApertura),
    unoTres: pct(apertura.unoTres, totalApertura),
    cuatroNueve: pct(apertura.cuatroNueve, totalApertura),
    diezVeinte: pct(apertura.diezVeinte, totalApertura),
    masVeinte: pct(apertura.masVeinte, totalApertura),
  };
  const fecha = formatDateKey(row.fecha);
  const recordIndex = String(row.record_index ?? "");

  return {
    id: `${fecha}-${row.ciclo ?? "sin-ciclo"}-${recordIndex}`,
    fecha,
    bloque: row.bloque ?? "Sin bloque",
    ciclo: row.ciclo ?? "Sin ciclo",
    area: row.area ?? "Sin area",
    spType: row.sp_type ?? "Sin tipo",
    month: row.record_month ?? "Sin mes",
    year: row.record_year ?? "Sin año",
    isoWeekId: row.iso_week_id ?? "Sin semana",
    totalApertura,
    tallosMalla: toNumber(row.tallos_malla),
    dominanteClase: row.dominante_clase ?? "Sin dominante",
    dominanteValor: toNumber(row.dominante_valor, 0) ?? 0,
    dominantePct: roundValue((toNumber(row.dominante_pct, 0) ?? 0) * 100, 2),
    estado: "Homogeneo",
    apertura,
    participacion,
  };
}

function pct(value: number, total: number) {
  return total > 0 ? roundValue((value / total) * 100, 2) : 0;
}

function mean(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sampleSd(values: number[]) {
  if (values.length < 2) return 0;
  const avg = mean(values);
  const variance = values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function getDominantClass(records: PuntoAperturaRecord[]) {
  const counts = new Map<string, number>();
  for (const record of records) {
    counts.set(record.dominanteClase, (counts.get(record.dominanteClase) ?? 0) + 1);
  }

  return Array.from(counts.entries()).sort((left, right) => right[1] - left[1])[0]?.[0] ?? "-";
}

function formatDateKey(value: string | Date | null) {
  if (!value) return "";
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return value.slice(0, 10);
}
