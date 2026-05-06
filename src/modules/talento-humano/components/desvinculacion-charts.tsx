"use client";

import { cn } from "@/lib/utils";
import type { TalentoExitRecord } from "@/lib/talento-humano";
import { ChartSurface } from "@/shared/data-display/chart-surface";
import { EmptyState } from "@/shared/data-display/empty-state";
import { formatInteger, formatPercent } from "@/shared/lib/format";
import { BAR_COLORS } from "@/modules/talento-humano/components/talento-view-utils";

export type ExitGroup = {
  label: string;
  count: number;
  rows: TalentoExitRecord[];
  avgCompliance: number | null;
};

export type CrossGroup = ExitGroup & {
  buckets: Array<{ label: string; count: number; ratio: number; rows: TalentoExitRecord[] }>;
};

export function getComplianceTone(value: number | null) {
  if (value === null) return "neutral";
  if (value > 1) return "success";
  if (value >= 0.9) return "warning";
  return "danger";
}

export function toneClass(tone: ReturnType<typeof getComplianceTone>) {
  if (tone === "success") return "text-[var(--color-chart-success-bold)]";
  if (tone === "warning") return "text-[var(--color-chart-warning)]";
  if (tone === "danger") return "text-[var(--color-chart-danger)]";
  return "text-muted-foreground";
}

export function BarListCard({
  title,
  subtitle,
  groups,
  onSelect,
  showCompliance = false,
}: {
  title: string;
  subtitle?: string;
  groups: ExitGroup[];
  onSelect: (group: ExitGroup) => void;
  showCompliance?: boolean;
}) {
  const total = groups.reduce((sum, group) => sum + group.count, 0);

  return (
    <ChartSurface title={title} subtitle={subtitle}>
      {groups.length ? (
        <div className="space-y-3">
          {groups.map((group, index) => {
            const ratio = total ? group.count / total : 0;
            const tone = getComplianceTone(group.avgCompliance);
            return (
              <button key={group.label} type="button" className="grid w-full grid-cols-[minmax(110px,0.95fr)_minmax(150px,1.25fr)_auto] items-center gap-3 rounded-[14px] px-2 py-1.5 text-left text-xs transition hover:bg-muted/55" onClick={() => onSelect(group)}>
                <span className="min-w-0 truncate font-medium">{group.label}</span>
                <span className="h-2.5 overflow-hidden rounded-full bg-muted">
                  <span className="block h-full rounded-full" style={{ width: `${Math.max(2, ratio * 100)}%`, background: BAR_COLORS[index % BAR_COLORS.length] }} />
                </span>
                <span className="shrink-0 text-right font-semibold tabular-nums">
                  {formatPercent(ratio, { input: "ratio", minimumFractionDigits: 0, maximumFractionDigits: 0 })} ({formatInteger(group.count)})
                  {showCompliance ? <span className={cn("ml-2", toneClass(tone))}>{formatPercent(group.avgCompliance, { input: "ratio", minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span> : null}
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <EmptyState label="Sin datos disponibles para los filtros seleccionados." />
      )}
    </ChartSurface>
  );
}

export function DonutBreakdownCard({
  title,
  groups,
  onSelect,
}: {
  title: string;
  groups: ExitGroup[];
  onSelect: (group: ExitGroup) => void;
}) {
  const total = groups.reduce((sum, group) => sum + group.count, 0);
  const topGroups = groups.slice(0, 7);
  let cursor = 0;
  const gradient = topGroups.length
    ? topGroups.map((group, index) => {
      const start = cursor;
      cursor += total ? (group.count / total) * 100 : 0;
      return `${BAR_COLORS[index % BAR_COLORS.length]} ${start}% ${cursor}%`;
    }).join(", ")
    : "var(--muted) 0 100%";

  return (
    <ChartSurface title={title} subtitle="Porcentaje y cantidad por respuesta. Click para ver personas.">
      {groups.length ? (
        <div className="grid gap-6 2xl:grid-cols-[220px_minmax(0,1fr)]">
          <div className="mx-auto grid size-52 place-items-center rounded-full border border-border/70 shadow-inner" style={{ background: `conic-gradient(${gradient})` }}>
            <div className="grid size-32 place-items-center rounded-full bg-card text-center text-sm font-semibold shadow-sm">
              {formatInteger(total)}
              <span className="block text-xs font-normal text-muted-foreground">salidas</span>
            </div>
          </div>
          <div className="grid content-start gap-2.5">
            {topGroups.map((group, index) => {
              const ratio = total ? group.count / total : 0;
              return (
                <button key={group.label} type="button" onClick={() => onSelect(group)} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-[16px] border border-border/60 bg-background/70 px-4 py-3 text-left transition hover:border-primary/35 hover:bg-muted/45">
                  <span className="size-2.5 rounded-full" style={{ background: BAR_COLORS[index % BAR_COLORS.length] }} />
                  <span className="min-w-0 truncate text-sm font-medium">{group.label}</span>
                  <span className="text-sm font-semibold tabular-nums">{formatPercent(ratio, { input: "ratio", minimumFractionDigits: 0, maximumFractionDigits: 0 })} · {formatInteger(group.count)}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <EmptyState label="Sin datos disponibles para los filtros seleccionados." />
      )}
    </ChartSurface>
  );
}

export function ContingencyTableCard({
  title,
  subtitle,
  groups,
  onSelect,
}: {
  title: string;
  subtitle?: string;
  groups: CrossGroup[];
  onSelect: (group: ExitGroup) => void;
}) {
  const columns = buildColumns(groups);

  return (
    <ChartSurface title={title} subtitle={subtitle}>
      {groups.length && columns.length ? (
        <div className="overflow-x-auto rounded-[20px] border border-border/60 bg-background/55 p-3">
          <table className="w-full min-w-[760px] border-separate border-spacing-0 text-xs">
            <thead>
              <tr>
                <Th>Grupo</Th>
                {columns.map((column) => <Th key={column} align="right">{column}</Th>)}
                <Th align="right">Total</Th>
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => (
                <tr key={group.label} className="cursor-pointer hover:bg-muted/35" onClick={() => onSelect(group)}>
                  <Td strong>{group.label}</Td>
                  {columns.map((column) => {
                    const bucket = group.buckets.find((entry) => entry.label === column);
                    return (
                      <HeatTd key={column} bucket={bucket}>
                        {bucket ? (
                          <>
                            <span className="font-semibold text-foreground">{formatInteger(bucket.count)}</span>
                            <span className="ml-1 text-muted-foreground">{formatPercent(bucket.ratio, { input: "ratio", minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                          </>
                        ) : "-"}
                      </HeatTd>
                    );
                  })}
                  <Td align="right" strong>{formatInteger(group.count)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState label="Sin datos para cruzar variables." />
      )}
    </ChartSurface>
  );
}

export function SocialWorkerContingencyCard({
  groups,
  onSelect,
}: {
  groups: Array<CrossGroup & { complianceBuckets: CrossGroup["buckets"]; tenureBuckets: CrossGroup["buckets"] }>;
  onSelect: (group: ExitGroup) => void;
}) {
  return (
    <ChartSurface title="Trabajadora social vs motivo, cumplimiento y antigüedad" subtitle="Tablas de contingencia por TS asignada. Cada celda muestra cantidad y peso dentro de la fila.">
      {groups.length ? (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,560px),1fr))] gap-4">
          <WorkerHeatMatrix title="TS x motivo" groups={groups.map((group) => ({ ...group, buckets: group.buckets }))} onSelect={onSelect} />
          <WorkerHeatMatrix title="TS x cumplimiento" groups={groups.map((group) => ({ ...group, buckets: group.complianceBuckets }))} onSelect={onSelect} />
          <WorkerHeatMatrix title="TS x antigüedad" groups={groups.map((group) => ({ ...group, buckets: group.tenureBuckets }))} onSelect={onSelect} />
        </div>
      ) : (
        <EmptyState label="Sin TS asignadas para los filtros seleccionados." />
      )}
    </ChartSurface>
  );
}

function WorkerHeatMatrix({
  title,
  groups,
  onSelect,
}: {
  title: string;
  groups: CrossGroup[];
  onSelect: (group: ExitGroup) => void;
}) {
  const columns = buildColumns(groups, 7);
  return (
    <div className="min-w-0 rounded-[20px] border border-border/60 bg-background/70 p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] text-muted-foreground">{formatInteger(groups.reduce((sum, group) => sum + group.count, 0))} salidas</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-separate border-spacing-0 text-xs">
          <thead>
            <tr>
              <Th>TS</Th>
              {columns.map((column) => <Th key={column} align="right">{column}</Th>)}
              <Th align="right">Total</Th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => (
              <tr key={group.label} className="cursor-pointer hover:bg-muted/35" onClick={() => onSelect(group)}>
                <Td strong>{group.label}</Td>
                {columns.map((column) => {
                  const bucket = group.buckets.find((entry) => entry.label === column);
                  return (
                    <HeatTd key={column} bucket={bucket}>
                      {bucket ? (
                        <span className="inline-flex flex-col items-end leading-tight">
                          <span className="font-semibold text-foreground">{formatInteger(bucket.count)}</span>
                          <span className="text-[10px] text-muted-foreground">{formatPercent(bucket.ratio, { input: "ratio", minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                        </span>
                      ) : "-"}
                    </HeatTd>
                  );
                })}
                <Td align="right" strong>{formatInteger(group.count)}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return <th className={cn("border-b border-border/70 px-3 py-2 font-semibold uppercase tracking-[0.14em] text-muted-foreground", align === "right" && "text-right")}>{children}</th>;
}

function Td({ children, align = "left", strong = false }: { children: React.ReactNode; align?: "left" | "right"; strong?: boolean }) {
  return <td className={cn("border-b border-border/45 px-3 py-2.5 text-muted-foreground", align === "right" && "text-right tabular-nums", strong && "font-medium text-foreground")}>{children}</td>;
}

function HeatTd({ children, bucket }: { children: React.ReactNode; bucket?: CrossGroup["buckets"][number] }) {
  const alpha = bucket ? 0.08 + Math.min(bucket.ratio, 1) * 0.22 : 0;
  return (
    <td className="border-b border-border/45 px-3 py-2.5 text-right tabular-nums" style={{ background: bucket ? `color-mix(in oklab, var(--color-chart-info-bold) ${Math.round(alpha * 100)}%, transparent)` : undefined }}>
      {children}
    </td>
  );
}

function buildColumns(groups: CrossGroup[], limit = 6) {
  const counts = new Map<string, number>();
  for (const group of groups) {
    for (const bucket of group.buckets) {
      counts.set(bucket.label, (counts.get(bucket.label) ?? 0) + bucket.count);
    }
  }
  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], "es-EC"))
    .slice(0, limit)
    .map(([label]) => label);
}
