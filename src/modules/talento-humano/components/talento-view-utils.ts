"use client";

import { parseDateOnly } from "@/shared/lib/format";
import { formatWeekLabel, generateAvailableWeeks } from "@/lib/talento-humano-utils";
import type { TalentoFilters, TalentoPersonRecord } from "@/lib/talento-humano";

export const TALENTO_WEEKS = generateAvailableWeeks(2024);

export const TALENTO_WEEK_OPTIONS = TALENTO_WEEKS.map((week) => ({
  value: week,
  label: formatWeekLabel(week),
}));

export const BAR_COLORS = [
  "var(--chart-line-primary)",
  "var(--color-chart-success-bold)",
  "var(--color-chart-info-bold)",
  "var(--color-chart-warning)",
  "var(--chart-line-secondary)",
  "var(--color-chart-success)",
  "var(--color-chart-info)",
  "var(--color-chart-danger)",
];

export const TALENTO_COLORS = BAR_COLORS;

export type TalentoGroup<T extends TalentoPersonRecord = TalentoPersonRecord> = {
  label: string;
  count: number;
  people: T[];
};

type CompositionBucket = {
  label: string;
  value: number;
};

export type CompositionRow = {
  label: string;
  people: TalentoPersonRecord[];
  tenure: CompositionBucket[];
  gender: CompositionBucket[];
  age: CompositionBucket[];
};

export function buildTalentoQueryString(filters: TalentoFilters): string {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => params.set(key, value));
  return params.toString();
}

export function groupTalentoRows<T extends TalentoPersonRecord>(
  rows: T[],
  key: keyof T,
  limit = 20,
): TalentoGroup<T>[] {
  const grouped = new Map<string, T[]>();

  for (const row of rows) {
    const value = row[key];
    const label = typeof value === "string" && value.trim() ? value : "Sin dato";
    const people = grouped.get(label) ?? [];
    people.push(row);
    grouped.set(label, people);
  }

  return Array.from(grouped.entries())
    .map(([label, people]) => ({ label, count: people.length, people }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label, "es-EC"))
    .slice(0, limit);
}

export function buildCompositionRows(
  rows: TalentoPersonRecord[],
  key: keyof TalentoPersonRecord,
  asOfDate: string,
): CompositionRow[] {
  const asOfTime = new Date(`${asOfDate}T12:00:00`).getTime();
  const groups = groupTalentoRows(rows, key, 9999);
  return groups.map((group) => ({
    label: group.label,
    people: group.people,
    tenure: buildShareBuckets(group.people, (row) => getTenureBucket(row, asOfTime), ["1-30 dias", "31-90 dias", "91-180 dias", "181-360 dias", ">360 dias"]),
    gender: buildShareBuckets(group.people, getGenderBucket, ["Femenino", "Masculino"]),
    age: buildShareBuckets(group.people, (row) => getAgeBucket(row, asOfTime), ["<24", "24-30", "31-37", "38-42", "43-49", "50-56", ">56"]),
  }));
}

export function buildCompositionSummaryRow(
  rows: TalentoPersonRecord[],
  asOfDate: string,
): CompositionRow {
  const asOfTime = new Date(`${asOfDate}T12:00:00`).getTime();

  return {
    label: "TOTAL",
    people: rows,
    tenure: buildShareBuckets(rows, (row) => getTenureBucket(row, asOfTime), ["1-30 dias", "31-90 dias", "91-180 dias", "181-360 dias", ">360 dias"]),
    gender: buildShareBuckets(rows, getGenderBucket, ["Femenino", "Masculino"]),
    age: buildShareBuckets(rows, (row) => getAgeBucket(row, asOfTime), ["<24", "24-30", "31-37", "38-42", "43-49", "50-56", ">56"]),
  };
}

export function heatmapColor(value: number, hue: number) {
  const percent = Math.max(0, Math.min(1, value));
  const isDark = typeof document !== "undefined" && document.documentElement.classList.contains("dark");
  const saturation = isDark ? 28 : 34;
  const lightness = isDark ? 21 + percent * 25 : 97 - percent * 28;
  const alpha = isDark ? 0.34 + percent * 0.28 : 0.42 + percent * 0.26;
  return `hsl(${hue} ${saturation}% ${lightness}% / ${alpha})`;
}

function buildShareBuckets<T extends TalentoPersonRecord>(
  rows: T[],
  bucketFn: (row: T) => string | null,
  order: string[],
): CompositionBucket[] {
  const counts = new Map<string, number>(order.map((label) => [label, 0]));
  rows.forEach((row) => {
    const bucket = bucketFn(row);
    if (!bucket) return;
    counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
  });
  const total = rows.length || 1;
  return order.map((label) => ({ label, value: (counts.get(label) ?? 0) / total }));
}

function getAgeBucket(row: TalentoPersonRecord, asOfTime: number) {
  if (!row.birthDate) return null;
  const birthDate = parseDateOnly(row.birthDate);
  if (!birthDate) return null;
  const birth = birthDate.getTime();
  if (!Number.isFinite(birth)) return null;
  const age = (asOfTime - birth) / 31557600000;
  if (age < 24) return "<24";
  if (age <= 30) return "24-30";
  if (age <= 37) return "31-37";
  if (age <= 42) return "38-42";
  if (age <= 49) return "43-49";
  if (age <= 56) return "50-56";
  return ">56";
}

function getTenureBucket(row: TalentoPersonRecord, asOfTime: number) {
  if (!row.lastEntryDate) return null;
  const entryDate = parseDateOnly(row.lastEntryDate);
  if (!entryDate) return null;
  const days = Math.floor((asOfTime - entryDate.getTime()) / 86400000);
  if (!Number.isFinite(days)) return null;
  if (days <= 30) return "1-30 dias";
  if (days <= 90) return "31-90 dias";
  if (days <= 180) return "91-180 dias";
  if (days <= 360) return "181-360 dias";
  return ">360 dias";
}

function getGenderBucket(row: TalentoPersonRecord) {
  const value = row.gender?.trim().toUpperCase();
  if (!value) return null;
  if (value.startsWith("F")) return "Femenino";
  if (value.startsWith("M")) return "Masculino";
  return null;
}
