const DEFAULT_LOCALE = "es-EC";
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// Cache de Intl.NumberFormat / Intl.DateTimeFormat por clave: construir un
// Intl formatter cuesta varios objetos por allocate; con tablas grandes
// (productividad, fenograma) llamamos a estas funciones miles de veces por
// render. El cache de instancias por (locale + options) reduce el overhead
// significativamente sin cambiar la semántica.
const NUMBER_FORMAT_CACHE = new Map<string, Intl.NumberFormat>();
const DATE_TIME_FORMAT_CACHE = new Map<string, Intl.DateTimeFormat>();

function getNumberFormat(locale: string, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let formatter = NUMBER_FORMAT_CACHE.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, options);
    NUMBER_FORMAT_CACHE.set(key, formatter);
  }
  return formatter;
}

function getDateTimeFormat(locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let formatter = DATE_TIME_FORMAT_CACHE.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, options);
    DATE_TIME_FORMAT_CACHE.set(key, formatter);
  }
  return formatter;
}

type NumericInput = number | string | null | undefined;

type BaseFormatOptions = {
  locale?: string;
  empty?: string;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
};

type PercentFormatOptions = BaseFormatOptions & {
  input?: "percent" | "ratio";
};

function normalizeIntlText(value: string) {
  return value.replace(/[\u00A0\u202F]/g, " ").replace(/\s+/g, " ").trim();
}

function buildLocalDate(year: number, month: number, day: number) {
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

export function localDateString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatLocalDateParts(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeNumber(value: NumericInput): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatNumericValue(value: NumericInput, options: BaseFormatOptions = {}) {
  const numericValue = normalizeNumber(value);
  if (numericValue === null) return options.empty ?? "-";

  return getNumberFormat(options.locale ?? DEFAULT_LOCALE, {
    minimumFractionDigits: options.minimumFractionDigits,
    maximumFractionDigits: options.maximumFractionDigits,
  }).format(numericValue);
}

export function formatInteger(value: NumericInput, options: Omit<BaseFormatOptions, "minimumFractionDigits" | "maximumFractionDigits"> = {}) {
  return formatNumericValue(value, {
    ...options,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export function formatDecimal(value: NumericInput, digits = 2, options: Omit<BaseFormatOptions, "minimumFractionDigits" | "maximumFractionDigits"> = {}) {
  return formatNumericValue(value, {
    ...options,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formatFlexibleNumber(value: NumericInput, options: BaseFormatOptions = {}) {
  return formatNumericValue(value, {
    maximumFractionDigits: 2,
    ...options,
  });
}

export function formatHours(value: NumericInput, digits = 2, suffix = " h") {
  const formatted = formatDecimal(value, digits);
  return formatted === "-" ? formatted : `${formatted}${suffix}`;
}

/**
 * Formatea una semana ISO al formato canónico visual `YYWW` (4 dígitos).
 *
 * Acepta los formatos de almacenamiento usados en CoreX y los normaliza a `YYWW`:
 * - `YYYYWW` (6 dígitos, fenograma `iso_week_id`) → toma últimos 4 dígitos visibles
 * - `YYWW` (4 dígitos, balanzas) → se devuelve tal cual
 * - `YYYY-WW` (calidad punto-apertura, con guión) → `YYWW`
 *
 * Si el valor no matchea, se devuelve tal cual.
 *
 * Ejemplos: `"202613"` → `"2613"`, `"2613"` → `"2613"`, `"2026-13"` → `"2613"`.
 */
export function formatIsoWeekLabel(value: NumericInput): string {
  if (value === null || value === undefined || value === "") return "-";
  const raw = String(value).trim();
  if (!raw) return "-";

  // YYYY-WW
  const dashed = raw.match(/^(\d{4})-(\d{1,2})$/);
  if (dashed) {
    const year = Number(dashed[1]);
    const week = Number(dashed[2]);
    const yy = year % 100;
    return `${String(yy).padStart(2, "0")}${String(week).padStart(2, "0")}`;
  }

  // YYYYWW (6 dígitos): toma últimos 2 del año + 2 de semana
  if (/^\d{6}$/.test(raw)) {
    const year = Number(raw.slice(0, 4));
    const week = Number(raw.slice(4, 6));
    const yy = year % 100;
    return `${String(yy).padStart(2, "0")}${String(week).padStart(2, "0")}`;
  }

  // YYWW (4 dígitos) — formato canónico, se devuelve tal cual
  if (/^\d{4}$/.test(raw)) {
    return raw;
  }

  return raw;
}

/**
 * Formatea una razón numerador / denominador con `digits` decimales.
 * Si el denominador es 0 o cualquier valor es nulo/no finito, devuelve `options.empty` (default `-`).
 *
 * Reemplaza el patrón inline `Math.round((num/den) * 100) / 100`.
 */
export function formatRatio(
  numerator: NumericInput,
  denominator: NumericInput,
  digits = 2,
  options: Omit<BaseFormatOptions, "minimumFractionDigits" | "maximumFractionDigits"> = {},
) {
  const num = normalizeNumber(numerator);
  const den = normalizeNumber(denominator);
  if (num === null || den === null || den === 0) return options.empty ?? "-";
  return formatDecimal(num / den, digits, options);
}

/**
 * Concatena un valor entero con su sustantivo singular o plural según corresponda.
 * Reemplaza la concatenación manual `${count} ${count === 1 ? singular : plural}`.
 */
export function formatCount(
  value: NumericInput,
  singular: string,
  plural: string,
  options: Omit<BaseFormatOptions, "minimumFractionDigits" | "maximumFractionDigits"> = {},
) {
  const numericValue = normalizeNumber(value);
  if (numericValue === null) return options.empty ?? "-";
  const formatted = formatInteger(numericValue, options);
  return `${formatted} ${numericValue === 1 ? singular : plural}`;
}

/**
 * Formatea un valor como porcentaje (locale `es-EC` por defecto).
 *
 * Contrato del parámetro `input` (CRÍTICO — pasarlo siempre que el valor sea
 * ratio decimal):
 *
 * - `input: "ratio"`  → el valor es decimal `0..1` (ej: `0.42` → `"42,00 %"`).
 *   Usar cuando la fuente entrega ratios crudos (count/total cliente,
 *   solver Python, mortandad acumulada normalizada en backend).
 *
 * - `input: "percent"` (default si se omite) → el valor ya está en escala
 *   `0..100` (ej: `42` → `"42,00 %"`). Usar cuando el backend SQL multiplicó
 *   por 100 antes de enviar (calidad punto-apertura, mortality_pct,
 *   rendimientoPct, etc.).
 *
 * Convención por módulo (ver `docs/datos.md`):
 * - mortality, productividad, fenograma, calidad: backend devuelve `0..100`
 *   → llamar sin `input` o con `input: "percent"`.
 * - comparacion: backend devuelve `0..1` (normalizado por `toPercentRatio`)
 *   → llamar con `input: "ratio"`.
 * - solver, talento (cálculos cliente count/total): valores `0..1`
 *   → `input: "ratio"`.
 *
 * Pasar el valor con la escala incorrecta produce números 100× alto/bajo.
 */
export function formatPercent(value: NumericInput, options: PercentFormatOptions = {}) {
  const numericValue = normalizeNumber(value);
  if (numericValue === null) return options.empty ?? "-";

  const normalized = options.input === "ratio" ? numericValue : numericValue / 100;

  return getNumberFormat(options.locale ?? DEFAULT_LOCALE, {
    style: "percent",
    minimumFractionDigits: options.minimumFractionDigits ?? 2,
    maximumFractionDigits: options.maximumFractionDigits ?? 2,
  }).format(normalized);
}

export function parseDateOnly(value: string | Date | null | undefined) {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : new Date(value.getTime());
  }

  const trimmed = value.trim();
  if (!trimmed) return null;

  if (!DATE_ONLY_PATTERN.test(trimmed)) {
    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const [year, month, day] = trimmed.split("-").map(Number);
  if (!year || !month || !day) return null;
  return buildLocalDate(year, month, day);
}

export function formatDateLocal(value: string | Date | null | undefined) {
  if (!value) return "-";

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return "-";
    const datePart = (trimmed.split("T")[0] ?? trimmed).trim();
    if (DATE_ONLY_PATTERN.test(datePart)) {
      return datePart;
    }
  }

  const parsed = parseDateOnly(value);
  return parsed ? formatLocalDateParts(parsed) : "-";
}

export function formatDate(value: string | Date | null | undefined, locale = DEFAULT_LOCALE) {
  if (!value) return "-";
  const date = parseDateOnly(value);
  if (!date || Number.isNaN(date.getTime())) return String(value);
  return getDateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function formatDateSlash(value: string | Date | null | undefined) {
  if (!value) return "-";

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return "-";
    const day = String(value.getDate()).padStart(2, "0");
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const year = String(value.getFullYear());
    return `${day}/${month}/${year}`;
  }

  if (value.startsWith("9999-")) return "-";

  const datePart = value.split("T")[0] ?? value;
  const [year, month, day] = datePart.split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

export function formatDateTime(
  value: string | Date | null | undefined,
  timeZone = "America/Guayaquil",
  locale = DEFAULT_LOCALE,
) {
  if (!value) return "-";

  const date = parseDateOnly(value);
  if (!date || Number.isNaN(date.getTime())) return String(value);

  const formatter = getDateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone,
  });

  const parts = formatter.formatToParts(date);
  const lookup = new Map(parts.map((part) => [part.type, normalizeIntlText(part.value)]));
  const day = lookup.get("day");
  const month = lookup.get("month");
  const year = lookup.get("year");
  const hour = lookup.get("hour");
  const minute = lookup.get("minute");
  const dayPeriod = lookup.get("dayPeriod");

  if (day && month && year && hour && minute) {
    return `${day} ${month} ${year}, ${hour}:${minute}${dayPeriod ? ` ${dayPeriod}` : ""}`;
  }

  return normalizeIntlText(formatter.format(date));
}

// ── Formatters de mes para filtros ───────────────────────────────────────────

const MONTH_NAMES_ES: Record<string, string> = {
  "1": "Enero", "2": "Febrero", "3": "Marzo", "4": "Abril",
  "5": "Mayo", "6": "Junio", "7": "Julio", "8": "Agosto",
  "9": "Septiembre", "10": "Octubre", "11": "Noviembre", "12": "Diciembre",
};

const MONTH_NAMES_ES_PADDED: Record<string, string> = {
  "01": "Enero", "02": "Febrero", "03": "Marzo", "04": "Abril",
  "05": "Mayo", "06": "Junio", "07": "Julio", "08": "Agosto",
  "09": "Septiembre", "10": "Octubre", "11": "Noviembre", "12": "Diciembre",
};

/** Convierte mes numérico ("1"–"12") al nombre en español. Uso: filtros de productividad. */
export function formatMonthNumeric(value: string): string {
  return MONTH_NAMES_ES[value] ?? MONTH_NAMES_ES_PADDED[value] ?? value;
}

/** Convierte "YYYY-MM" al formato "Nombre Año" (e.g. "2026-04" → "Abril 2026"). Uso: filtros de calidad. */
export function formatYearMonth(value: string): string {
  const [yyyy, mm] = value.split("-");
  return mm && MONTH_NAMES_ES_PADDED[mm] ? `${MONTH_NAMES_ES_PADDED[mm]} ${yyyy}` : value;
}
