"use client";

import { useMemo, useState } from "react";
import type React from "react";
import { Activity } from "lucide-react";

import type { CollaboratorDetailPayload } from "@/lib/talento-humano-colaboradores";
import { MetricTile } from "@/shared/data-display/metric-tile";
import { KpiGrid } from "@/shared/layout/filter-panel";
import { formatDate, formatFlexibleNumber, formatPercent } from "@/shared/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";

type PerformanceData = NonNullable<CollaboratorDetailPayload["performance"]>;
type AbsenteeismData = NonNullable<CollaboratorDetailPayload["absenteeism"]>;

function pct(value: number | null | undefined) {
  return value == null ? "-" : formatPercent(value, { input: "ratio" });
}

function dateVal(value: string | null | undefined) {
  return value ? formatDate(value) : "-";
}

function ratio(numerator: number, denominator: number) {
  return denominator > 0 ? numerator / denominator : null;
}

function toggleSet(setter: React.Dispatch<React.SetStateAction<Set<string>>>, key: string) {
  setter((current) => {
    const next = new Set(current);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  });
}

export function MiniBars({ values, tone = "emerald" }: { values: number[]; tone?: "emerald" | "amber" | "rose" | "sky" }) {
  const max = Math.max(...values, 1);
  const color = tone === "amber" ? "bg-amber-400" : tone === "rose" ? "bg-rose-400" : tone === "sky" ? "bg-sky-400" : "bg-emerald-500";
  return (
    <div className="flex h-16 items-end gap-1 rounded-[18px] border border-border/50 bg-background/70 px-3 py-2">
      {values.slice(-18).map((value, index) => (
        <div key={`${value}-${index}`} className={`w-full rounded-t-full ${color}`} style={{ height: `${Math.max(10, (value / max) * 100)}%`, opacity: 0.45 + (index / Math.max(values.length - 1, 1)) * 0.45 }} />
      ))}
    </div>
  );
}

export function GaugeCard({ label, value, hint }: { label: string; value: number | null | undefined; hint: string }) {
  const normalized = Math.max(0, Math.min(1.25, value ?? 0));
  const degrees = (normalized / 1.25) * 360;
  return (
    <div className="rounded-[22px] border border-border/60 bg-gradient-to-br from-card to-emerald-50/35 p-4">
      <div className="flex items-center gap-4">
        <div className="grid size-20 place-items-center rounded-full" style={{ background: `conic-gradient(hsl(var(--primary)) ${degrees}deg, color-mix(in srgb, hsl(var(--muted-foreground)) 22%, transparent) 0deg)` }}>
          <div className="grid size-14 place-items-center rounded-full bg-card text-sm font-semibold">{pct(value)}</div>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
          <p className="mt-1 text-sm text-muted-foreground">{hint}</p>
        </div>
      </div>
    </div>
  );
}

export function PerformanceTrendCard({ data }: { data: PerformanceData }) {
  const points = data.weekly.slice().reverse().map((week) => ({
    week: week.isoWeekId,
    value: week.cumplimiento,
  }));
  const max = Math.max(...points.map((point) => point.value ?? 0), 1.4);

  return (
    <div className="rounded-[22px] border border-border/60 bg-gradient-to-br from-card to-emerald-50/35 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Cumplimiento semanal</p>
          <p className="mt-1 text-sm text-muted-foreground">Rendimiento / mínimo</p>
        </div>
        <p className="text-lg font-semibold">{pct(data.totals.cumplimiento)}</p>
      </div>
      <div className="mt-4 flex h-40 items-end gap-1.5 border-b border-dashed border-border/70 pb-2 sm:h-48">
        {points.slice(-26).map((point) => {
          const value = point.value ?? 0;
          const tone = value >= 1 ? "bg-emerald-500" : value >= 0.9 ? "bg-amber-400" : "bg-rose-400";
          return (
            <div key={point.week} className="group relative flex min-w-3 flex-1 items-end">
              <div className={`w-full rounded-t-md ${tone}`} style={{ height: `${Math.max(8, (value / max) * 100)}%` }} />
              <span className="pointer-events-none absolute bottom-full left-1/2 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-full bg-slate-900 px-2 py-1 text-[10px] text-white group-hover:block">
                {point.week}: {pct(point.value)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function absenceTone(value: number | null | undefined) {
  if (value == null) return "border-border/60 bg-card";
  if (value <= 0.05) return "border-emerald-200 bg-emerald-50/70";
  if (value <= 0.1) return "border-amber-200 bg-amber-50/70";
  return "border-rose-200 bg-rose-50/70";
}

export function AbsenceSummaryCard({ absenteeism }: { absenteeism: AbsenteeismData }) {
  const absencePct = absenteeism.metrics?.pctAbsTotal ?? null;
  return (
    <div className={`rounded-[22px] border p-4 ${absenceTone(absencePct)}`}>
      <div className="space-y-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">% Ausentismo</p>
          <p className="mt-2 text-2xl font-semibold">{pct(absencePct)}</p>
          <p className="text-xs text-muted-foreground">Solo faltas, atrasos y permisos.</p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <MetricChip label="% Rend." value={pct(absenteeism.metrics?.pctActualHoursRend)} />
          <MetricChip label="% HN" value={pct(absenteeism.metrics?.pctActualHoursHn)} />
        </div>
      </div>
    </div>
  );
}

function MetricChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[14px] border border-border/50 bg-card/70 px-2 py-2">
      <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}

export function PerformanceSection({ data }: { data: PerformanceData }) {
  const initialWeek = data.weekly[0]?.isoWeekId;
  const [openWeeks, setOpenWeeks] = useState<Set<string>>(() => new Set(initialWeek ? [initialWeek] : []));
  const [openActivities, setOpenActivities] = useState<Set<string>>(() => new Set());
  const activitiesByWeek = useMemo(() => {
    const byWeek = new Map<string, Array<{ name: string; actual: number; effective: number; dates: PerformanceData["detail"] }>>();
    for (const row of data.detail) {
      const list = byWeek.get(row.isoWeekId) ?? [];
      const existing = list.find((item) => item.name === row.activityName);
      const item = existing ?? { name: row.activityName, actual: 0, effective: 0, dates: [] };
      item.actual += row.actualHours;
      item.effective += row.effectiveHours;
      item.dates.push(row);
      if (!existing) list.push(item);
      byWeek.set(row.isoWeekId, list);
    }
    return byWeek;
  }, [data.detail]);

  return (
    <div className="space-y-4">
      <KpiGrid className="grid-cols-[repeat(auto-fit,minmax(190px,1fr))]">
        <MetricTile label="Horas presenciales" value={formatFlexibleNumber(data.totals.actualHoursHn)} />
        <MetricTile label="Horas trabajadas" value={formatFlexibleNumber(data.totals.actualHoursRend)} />
        <MetricTile label="Rendimiento" value={pct(data.totals.rendimiento)} />
        <MetricTile label="Cumplimiento" value={pct(data.totals.cumplimiento)} />
      </KpiGrid>
      <Card className="border-border/70 bg-card/84">
        <CardHeader><CardTitle className="text-base">Rendimiento desplegable</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-auto rounded-[20px] border border-border/60 bg-background/70">
            <div className="min-w-[900px]">
              <div className="grid grid-cols-[32px_1fr_repeat(3,minmax(130px,150px))] items-center gap-3 border-b border-border/60 bg-muted/60 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                <span />
                <span>Descripción</span>
                <span>H. presenciales</span>
                <span>H. trabajadas</span>
                <span>Rendimiento</span>
              </div>
              {data.weekly.map((week) => (
                <div key={week.isoWeekId} className="border-b border-border/40 last:border-b-0">
                  <button type="button" onClick={() => toggleSet(setOpenWeeks, week.isoWeekId)} className="grid w-full grid-cols-[32px_1fr_repeat(3,minmax(130px,150px))] items-center gap-3 px-4 py-3 text-left text-sm hover:bg-muted/35">
                    <span className="text-muted-foreground">{openWeeks.has(week.isoWeekId) ? "⌄" : "›"}</span>
                    <span className="font-semibold">Semana {week.isoWeekId}</span>
                    <span>{formatFlexibleNumber(week.actualHoursHn)}</span>
                    <span>{formatFlexibleNumber(week.actualHoursRend)}</span>
                    <span className="font-semibold">{pct(week.rendimiento)}</span>
                  </button>
                  {openWeeks.has(week.isoWeekId) ? (activitiesByWeek.get(week.isoWeekId) ?? []).map((activity) => {
                    const key = `${week.isoWeekId}::${activity.name}`;
                    return (
                      <div key={key}>
                        <button type="button" onClick={() => toggleSet(setOpenActivities, key)} className="grid w-full grid-cols-[56px_1fr_repeat(3,minmax(130px,150px))] items-center gap-3 border-t border-border/30 bg-muted/18 px-4 py-2 text-left text-xs">
                          <span className="pl-6 text-muted-foreground">{openActivities.has(key) ? "⌄" : "›"}</span>
                          <span>{activity.name}</span>
                          <span>{formatFlexibleNumber(activity.actual)}</span>
                          <span>{formatFlexibleNumber(activity.effective)}</span>
                          <span className="font-semibold">{pct(ratio(activity.effective, activity.actual))}</span>
                        </button>
                        {openActivities.has(key) ? activity.dates.map((row, index) => (
                          <div key={`${key}-${row.eventDate}-${index}`} className="grid grid-cols-[84px_1fr_repeat(3,minmax(130px,150px))] items-center gap-3 border-t border-border/20 px-4 py-2 text-xs text-muted-foreground">
                            <span />
                            <span>{dateVal(row.eventDate)} · {row.unitOfMeasure ?? "-"}</span>
                            <span>{formatFlexibleNumber(row.actualHours)}</span>
                            <span>{formatFlexibleNumber(row.effectiveHours)}</span>
                            <span>{pct(row.rendimiento)}</span>
                          </div>
                        )) : null}
                      </div>
                    );
                  }) : null}
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function AbsenteeismSection({ data }: { data: AbsenteeismData }) {
  const grouped = useMemo(() => {
    const map = new Map<string, { hours: number; rows: AbsenteeismData["rows"] }>();
    for (const row of data.rows) {
      const key = row.activityId ?? "Sin actividad";
      const item = map.get(key) ?? { hours: 0, rows: [] };
      item.hours += row.absenceHours;
      item.rows.push(row);
      map.set(key, item);
    }
    return Array.from(map.entries()).map(([activityId, item]) => ({ activityId, ...item })).sort((a, b) => b.hours - a.hours);
  }, [data.rows]);
  const [selectedActivity, setSelectedActivity] = useState(grouped[0]?.activityId ?? null);
  const active = grouped.find((item) => item.activityId === selectedActivity) ?? grouped[0] ?? null;

  return (
    <Card className="border-border/70 bg-card/84">
      <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Activity className="size-4" />Ausentismo</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <KpiGrid className="grid-cols-[repeat(auto-fit,minmax(190px,1fr))]">
          <MetricTile label="% Ausentismo" value={pct(data.metrics?.pctAbsTotal)} hint="faltas, atrasos y permisos" />
          <MetricTile label="% H. rendimiento" value={pct(data.metrics?.pctActualHoursRend)} />
          <MetricTile label="% HN" value={pct(data.metrics?.pctActualHoursHn)} />
          <MetricTile label="Horas ausentes" value={formatFlexibleNumber(data.totalHours)} />
        </KpiGrid>
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="space-y-3">
            {grouped.map((item) => (
              <button key={item.activityId} type="button" onClick={() => setSelectedActivity(item.activityId)} className={`w-full rounded-[18px] border p-3 text-left ${active?.activityId === item.activityId ? "border-sky-300 bg-sky-50" : "border-border/60 bg-background/70"}`}>
                <div className="flex justify-between gap-3 text-sm">
                  <span className="font-semibold">{item.activityId}</span>
                  <span>{formatFlexibleNumber(item.hours)} h</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-sky-500" style={{ width: `${Math.min(100, (item.hours / Math.max(data.totalHours, 1)) * 100)}%` }} />
                </div>
              </button>
            ))}
          </div>
          <SimpleTable headers={["Fecha", "Horas"]}>
            {active?.rows.map((row, index) => (
              <tr key={`${row.eventDate}-${row.workDate}-${index}`} className="border-t border-border/40">
                <td className="px-3 py-2">{dateVal(row.workDate ?? row.eventDate)}</td>
                <td className="px-3 py-2 text-right font-semibold">{formatFlexibleNumber(row.absenceHours)}</td>
              </tr>
            ))}
          </SimpleTable>
        </div>
      </CardContent>
    </Card>
  );
}

function SimpleTable({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-auto rounded-[18px] border border-border/60 bg-background/70">
      <table className="w-full min-w-[520px] text-xs">
        <thead className="sticky top-0 z-10 bg-muted/70 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          <tr>{headers.map((header) => <th key={header} className="px-3 py-2 text-left font-semibold">{header}</th>)}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
