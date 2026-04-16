"use client";

import { fetchJson } from "@/lib/fetch-json";
import type {
  CycleProfileCard,
} from "@/lib/fenograma";
import type { MortalityCurvePayload } from "@/lib/mortality";
import { formatFlexibleNumber } from "@/shared/lib/format";
import type { SelectedMortalityCurveState } from "@/hooks/use-block-profile-modal";

// Wrapper with custom fallback behavior for domain panels.
export function formatProductivity(value: number | null, fallback = "-") {
  if (value === null) {
    return fallback;
  }

  return formatFlexibleNumber(value);
}

export function getTrailingSegment(value: string) {
  const normalized = value.trim();

  if (!normalized) {
    return "-";
  }

  const parts = normalized.split("-");
  return parts[parts.length - 1] || normalized;
}

export function getValveDisplayName(valveName: string | null | undefined, valveId: string | null | undefined) {
  const normalizedName = valveName?.trim();

  if (normalizedName) {
    return normalizedName;
  }

  return getTrailingSegment(valveId ?? "");
}

// Derive operational status from cycle flags plus raw status.
export function deriveCycleOperationalStatus(cycle: CycleProfileCard): string {
  const rawStatus = cycle.status?.toLowerCase().trim() ?? "";

  if (rawStatus === "planned" || rawStatus === "planificado") {
    return "Planificado";
  }

  if (cycle.isCurrent && cycle.isValid) {
    return "Activo";
  }

  if (!cycle.isCurrent && cycle.isValid) {
    return "Cerrado";
  }

  return "Planificado";
}

// Translate raw status to the user-facing phase label.
export function deriveCyclePhase(cycle: CycleProfileCard): string {
  const rawStatus = cycle.status?.toLowerCase().trim() ?? "";

  if (rawStatus.includes("harvest") || rawStatus.includes("cosecha")) {
    return "Cosecha";
  }

  if (rawStatus === "active" || rawStatus === "activo") {
    return "Vegetativo";
  }

  if (rawStatus === "closed" || rawStatus === "cerrado") {
    return "Cerrado";
  }

  if (rawStatus === "planned" || rawStatus === "planificado") {
    return "Planificado";
  }

  if (cycle.isCurrent) {
    return "Vegetativo";
  }

  if (!cycle.isCurrent && cycle.isValid) {
    return "Cerrado";
  }

  return "Planificado";
}

// Camas 30 m2 = superficie / 30. Return null when area is not reliable.
export function computeCamas30(bedArea: number | null): number | null {
  if (bedArea === null || bedArea <= 0) {
    return null;
  }

  return Math.round((bedArea / 30) * 100) / 100;
}

export function computeHorasCama(effectiveHours: number | null, bedArea: number | null): number | null {
  const camas30 = computeCamas30(bedArea);

  if (effectiveHours === null || camas30 === null || camas30 <= 0) {
    return null;
  }

  return Math.round((effectiveHours / camas30) * 100) / 100;
}

export function buildCycleHoursRequest(cycleKey: string | null) {
  if (!cycleKey) {
    return null;
  }

  return [
    `/api/fenograma/cycle/${encodeURIComponent(cycleKey)}/hours`,
    "No se pudo cargar el detalle de horas del ciclo.",
  ] as const;
}

export function buildCycleHoursPersonRequest(cycleKey: string, personId: string | null) {
  if (!personId) {
    return null;
  }

  return [
    `/api/fenograma/cycle/${encodeURIComponent(cycleKey)}/hours/person/${encodeURIComponent(personId)}`,
    "No se pudo cargar la ficha de horas del personal.",
  ] as const;
}

export async function swrHoursFetcher<T>([url, fallbackMessage]: readonly [string, string]) {
  return fetchJson<T>(url, fallbackMessage);
}

// Programmed plants: macro aggregate over visible cycles.
export function computeProgrammedPlantsAcrossCycles(cycles: CycleProfileCard[]): number | null {
  const values = cycles.map((cycle) => cycle.programmedPlants).filter((value): value is number => value !== null);

  if (!values.length) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0);
}

// Resolve the most useful aggregated current status for the block.
export function resolveAggregatedOperationalStatus(cycles: CycleProfileCard[]): string {
  if (!cycles.length) {
    return "-";
  }

  const statuses = cycles.map(deriveCycleOperationalStatus);

  if (statuses.includes("Activo")) {
    return "Activo";
  }

  if (statuses.includes("Planificado")) {
    return "Planificado";
  }

  return "Cerrado";
}

export function getBedSortValue(bedId: string) {
  const trailingSegment = getTrailingSegment(bedId);
  const numericValue = Number(trailingSegment);
  return Number.isFinite(numericValue) ? numericValue : Number.MAX_SAFE_INTEGER;
}

export function buildMortalityBadge(data: MortalityCurvePayload | null, selectedCurve: SelectedMortalityCurveState) {
  if (data?.label) {
    return data.label;
  }

  if (selectedCurve.entityType === "valve") {
    return selectedCurve.valveId;
  }

  if (selectedCurve.entityType === "bed") {
    return selectedCurve.bedId;
  }

  return selectedCurve.cycleKey;
}
