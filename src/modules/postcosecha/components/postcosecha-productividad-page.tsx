"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Clock, LoaderCircle, RefreshCcw } from "lucide-react";
import useSWR from "swr";
import { toast } from "sonner";

import { fetchJson } from "@/lib/fetch-json";
import {
  type PostharvestProductivityDashboardData,
  type PostharvestProductivityFilters,
} from "@/lib/postcosecha-productividad";
import { EmptyState } from "@/shared/data-display/empty-state";
import { MetricTile } from "@/shared/data-display/metric-tile";
import { DateField } from "@/shared/filters/date-field";
import { MultiSelectField } from "@/shared/filters/multi-select-field";
import { SingleSelectField } from "@/shared/filters/single-select-field";
import { FilterPanel, KpiGrid } from "@/shared/layout/filter-panel";
import { SectionPageShell } from "@/shared/layout/section-page-shell";
import { formatDecimal, formatHours, formatMonthNumeric } from "@/shared/lib/format";
import { Button } from "@/shared/ui/button";
import { ScrollFadeTable } from "@/shared/tables/scroll-fade-table";

const dashboardFetcher = (url: string) =>
  fetchJson<PostharvestProductivityDashboardData>(
    url,
    "No se pudo cargar el dashboard de productividad de postcosecha.",
  );

function buildQueryString(filters: PostharvestProductivityFilters) {
  const params = new URLSearchParams();
  params.set("year", filters.year);
  params.set("month", filters.month);
  params.set("area", filters.area);
  params.set("pathPost", filters.pathPost);
  params.set("finalDestination", filters.finalDestination);
  params.set("variety", filters.variety);
  if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) params.set("dateTo", filters.dateTo);
  return params.toString();
}

function TH({ children, right = false }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th
      scope="col"
      className={`border-b border-border/60 bg-background/95 px-3 py-2.5 text-xs font-semibold text-muted-foreground whitespace-nowrap ${
        right ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

function TD({ children, right = false }: { children: React.ReactNode; right?: boolean }) {
  return (
    <td className={`border-b border-border/40 px-3 py-2 text-sm whitespace-nowrap ${right ? "text-right" : ""}`}>
      {children}
    </td>
  );
}

export function PostcosechaProductividadPage({
  initialData,
}: {
  initialData: PostharvestProductivityDashboardData;
}) {
  const [filters, setFilters] = useState<PostharvestProductivityFilters>(initialData.filters);
  const deferredFilters = useDeferredValue(filters);
  const initialFilterKey = useMemo(() => buildQueryString(initialData.filters), [initialData.filters]);
  const filterKey = useMemo(() => buildQueryString(deferredFilters), [deferredFilters]);

  const { data: dashboardData, error, isValidating, mutate } = useSWR(
    `/api/postcosecha/productividad?${filterKey}`,
    dashboardFetcher,
    {
      fallbackData: filterKey === initialFilterKey ? initialData : undefined,
      keepPreviousData: true,
      revalidateOnFocus: false,
      dedupingInterval: 15000,
    },
  );

  const data = dashboardData ?? initialData;
  const hasVarietyDimension = data.options.varieties.length > 0;

  useEffect(() => {
    if (error) {
      toast.error(error.message || "Error al cargar productividad de postcosecha");
    }
  }, [error]);

  function update<K extends keyof PostharvestProductivityFilters>(key: K, value: PostharvestProductivityFilters[K]) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function resetFilters() {
    setFilters(initialData.filters);
  }

  return (
    <SectionPageShell
      eyebrow="Analítica / Postcosecha / Indicadores & KPI"
      title="Productividad"
      subtitle="Horas trabajadas por caja 10kg con base en fecha_post, camino, destino y área operativa de postcosecha."
      icon={<Clock className="size-6" />}
      actions={(
        <Button variant="outline" size="sm" onClick={() => void mutate()} disabled={isValidating}>
          {isValidating ? <LoaderCircle className="mr-2 size-4 animate-spin" /> : <RefreshCcw className="mr-2 size-4" />}
          Actualizar
        </Button>
      )}
    >
      <FilterPanel>
        <div className={`grid gap-3 md:grid-cols-2 ${hasVarietyDimension ? "xl:grid-cols-8" : "xl:grid-cols-7"}`}>
          <DateField id="post-date-from" label="Fecha post desde" value={filters.dateFrom} onChange={(value) => update("dateFrom", value)} />
          <DateField id="post-date-to" label="Fecha post hasta" value={filters.dateTo} onChange={(value) => update("dateTo", value)} />
          <SingleSelectField
            id="post-year"
            label="Año"
            value={filters.year}
            options={data.options.years}
            onChange={(value) => update("year", value)}
          />
          <SingleSelectField
            id="post-month"
            label="Mes"
            value={filters.month}
            options={data.options.months}
            onChange={(value) => update("month", value)}
            displayValue={formatMonthNumeric}
          />
          <MultiSelectField
            id="post-area"
            label="Área"
            value={filters.area}
            options={data.options.areas}
            onChange={(value) => update("area", value)}
          />
          <MultiSelectField
            id="post-path"
            label="Camino"
            value={filters.pathPost}
            options={data.options.paths}
            onChange={(value) => update("pathPost", value)}
          />
          <MultiSelectField
            id="post-destination"
            label="Destino"
            value={filters.finalDestination}
            options={data.options.finalDestinations}
            onChange={(value) => update("finalDestination", value)}
          />
          {hasVarietyDimension ? (
            <MultiSelectField
              id="post-variety"
              label="Variedad"
              value={filters.variety}
              options={data.options.varieties}
              onChange={(value) => update("variety", value)}
            />
          ) : null}
        </div>

        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={resetFilters}>
            Restablecer filtros
          </Button>
        </div>

        <KpiGrid columns={6}>
          <MetricTile label="Fechas post" value={formatDecimal(data.summary.postDateCount, 0)} />
          <MetricTile label="Horas asignadas" value={formatHours(data.summary.totalHours)} />
          <MetricTile label="Cajas 10kg" value={formatDecimal(data.summary.totalBoxes10, 2)} />
          <MetricTile label="Horas / caja" value={formatDecimal(data.summary.weightedHoursPerBox, 4)} />
          <MetricTile label="Horas upstream" value={formatHours(data.summary.totalHoursUpstream)} />
          <MetricTile label="Horas downstream" value={formatHours(data.summary.totalHoursDownstream)} />
        </KpiGrid>

        {data.rows.length ? (
          <ScrollFadeTable topScrollbar className="rounded-[18px] border border-border/60 bg-card/70">
            <table className={`${hasVarietyDimension ? "min-w-[1540px]" : "min-w-[1440px]"} w-full border-collapse`}>
              <thead>
                <tr>
                  <TH>Fecha post</TH>
                  <TH>Área</TH>
                  <TH>Camino</TH>
                  <TH>Destino</TH>
                  {hasVarietyDimension ? <TH>Variedad</TH> : null}
                  <TH right>Kg</TH>
                  <TH right>Cajas10</TH>
                  <TH right>Horas</TH>
                  <TH right>H/Caja</TH>
                  <TH right>H/Caja Up</TH>
                  <TH right>H/Caja Down</TH>
                  <TH right>H específicas</TH>
                  <TH right>H período</TH>
                  <TH right>H fb macro</TH>
                  <TH right>H fb day</TH>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr key={`${row.postDate}-${row.pathPost}-${row.finalDestination}-${row.varietyCanon}-${row.areaId}`}>
                    <TD>{row.postDate}</TD>
                    <TD>{row.areaId}</TD>
                    <TD>{row.pathPost}</TD>
                    <TD>{row.finalDestination}</TD>
                    {hasVarietyDimension ? <TD>{row.varietyCanon}</TD> : null}
                    <TD right>{formatDecimal(row.weightKg, 2)}</TD>
                    <TD right>{formatDecimal(row.boxes10, 2)}</TD>
                    <TD right>{formatHours(row.effectiveHoursAssigned)}</TD>
                    <TD right>{formatDecimal(row.hoursPerBox, 4)}</TD>
                    <TD right>{formatDecimal(row.hoursPerBoxUpstream, 4)}</TD>
                    <TD right>{formatDecimal(row.hoursPerBoxDownstream, 4)}</TD>
                    <TD right>{formatHours(row.effectiveHoursSpecific)}</TD>
                    <TD right>{formatHours(row.effectiveHoursSpecificPeriod)}</TD>
                    <TD right>{formatHours(row.effectiveHoursFallbackMacro)}</TD>
                    <TD right>{formatHours(row.effectiveHoursFallbackDay)}</TD>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollFadeTable>
        ) : (
          <EmptyState
            label="No hay datos para los filtros seleccionados. Ajusta el rango de fecha post, área, camino o destino para volver a consultar."
          />
        )}
      </FilterPanel>
    </SectionPageShell>
  );
}
