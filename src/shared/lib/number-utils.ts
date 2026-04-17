export function toNumber(value: unknown): number | null;
export function toNumber(value: unknown, fallback: number): number;
export function toNumber(value: unknown, fallback: null): number | null;
export function toNumber(value: unknown, fallback: number | null = null): number | null {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : fallback;
  }

  if (typeof value === "bigint") {
    return Number(value);
  }

  const normalizedValue = typeof value === "string"
    ? value.replace(/,/g, "").trim()
    : String(value).trim();

  if (!normalizedValue) {
    return fallback;
  }

  const numericValue = Number(normalizedValue);
  return Number.isFinite(numericValue) ? numericValue : fallback;
}

export function roundValue(value: number, decimals = 2) {
  return Number(value.toFixed(decimals));
}
