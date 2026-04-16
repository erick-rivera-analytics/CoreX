const DEFAULT_LOCALE = "es-EC";

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

function normalizeNumber(value: NumericInput): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatNumericValue(value: NumericInput, options: BaseFormatOptions = {}) {
  const numericValue = normalizeNumber(value);
  if (numericValue === null) return options.empty ?? "-";

  return new Intl.NumberFormat(options.locale ?? DEFAULT_LOCALE, {
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

export function formatPercent(value: NumericInput, options: PercentFormatOptions = {}) {
  const numericValue = normalizeNumber(value);
  if (numericValue === null) return options.empty ?? "-";

  const normalized = options.input === "ratio" ? numericValue : numericValue / 100;

  return new Intl.NumberFormat(options.locale ?? DEFAULT_LOCALE, {
    style: "percent",
    minimumFractionDigits: options.minimumFractionDigits ?? 2,
    maximumFractionDigits: options.maximumFractionDigits ?? 2,
  }).format(normalized);
}

export function formatDate(value: string | Date | null | undefined, locale = DEFAULT_LOCALE) {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat(locale, {
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

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  const formatter = new Intl.DateTimeFormat(locale, {
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
