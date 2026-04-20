/**
 * Utilidades de fecha compartidas para loaders y módulos.
 * No confundir con formatters en `@/shared/lib/format` (que son para UI).
 */

export function toIso(date: Date): string {
  return date.toISOString();
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

export function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}
