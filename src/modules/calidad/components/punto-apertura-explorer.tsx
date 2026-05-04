"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { Activity, LoaderCircle, RefreshCcw } from "lucide-react";
import useSWR from "swr";
import { toast } from "sonner";

import { PuntoAperturaControlChart } from "@/modules/calidad/components/punto-apertura-control-chart";
import { PuntoAperturaRecordOverlay } from "@/modules/calidad/components/punto-apertura-record-overlay";
import {
  buildStatusComposition,
  StatusCompositionDialog,
} from "@/modules/calidad/components/punto-apertura-status-composition";
import { fetchJson } from "@/lib/fetch-json";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { Card, CardContent } from "@/shared/ui/card";
import { EmptyState } from "@/shared/data-display/empty-state";
import { MetricTile } from "@/shared/data-display/metric-tile";
import { ExportButton } from "@/shared/ui/export-button";
import { DateField } from "@/shared/filters/date-field";
import { MultiSelectField } from "@/shared/filters/multi-select-field";
import { ScrollFadeTable } from "@/shared/tables/scroll-fade-table";
import { ChartSection, DetailSection, FilterPanel, KpiGrid } from "@/shared/layout/filter-panel";
import { SectionPageShell } from "@/shared/layout/section-page-shell";
import { formatInteger, formatIsoWeekLabel, formatMonthNumeric, formatPercent } from "@/shared/lib/format";
import type {
  PuntoAperturaDashboardData,
  PuntoAperturaFilters,
  PuntoAperturaRecord,
} from "@/lib/calidad-punto-apertura";

const fetcher = (url: string) =>
  fetchJson<PuntoAperturaDashboardData>(url, "No se pudo cargar punto de apertura.");

const APERTURE_COMPOSITION = [
  { key: "boton", label: "Botón" },
  { key: "unoTres", label: "1 a 3" },
  { key: "cuatroNueve", label: "4 a 9" },
  { key: "diezVeinte", label: "10 a 20" },
  { key: "masVeinte", label: "Más de 20" },
] as const;

function buildQueryString(filters: PuntoAperturaFilters) {
  const params = new URLSearchParams();
  params.set("isoWeek", filters.isoWeek);
  params.set("area", filters.area);
  params.set("spType", filters.spType);
  params.set("month", filters.month);
  params.set("year", filters.year);
  params.set("date", filters.date);
  params.set("dominantClass", filters.dominantClass);
  params.set("bloque", filters.bloque);
  return params.toString();
}

export function PuntoAperturaExplorer({ initialData }: { initialData: PuntoAperturaDashboardData }) {
  const [filters, setFilters] = useState<PuntoAperturaFilters>(initialData.filters);
  const [selectedRecord, setSelectedRecord] = useState<PuntoAperturaRecord | null>(null);
  const [selectedStatusComposition, setSelectedStatusComposition] = useState<"homogeneous" | "nonHomogeneous" | null>(null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const deferredFilters = useDeferredValue(filters);

  const initialFilterKey = useMemo(() => buildQueryString(initialData.filters), [initialData.filters]);
  const filterKey = useMemo(() => buildQueryString(deferredFilters), [deferredFilters]);

  const { data: dashboardData, error, isValidating, mutate } = useSWR(
    `/api/calidad/punto-apertura?${filterKey}`,
    fetcher,
    {
      fallbackData: filterKey === initialFilterKey ? initialData : undefined,
      keepPreviousData: true,
      revalidateOnFocus: false,
      dedupingInterval: 15000,
      onError: (err) => toast.error(err?.message || "Error al cargar punto de apertura"),
    },
  );

  const data = dashboardData ?? initialData;
  const criticalRecords = useMemo(
    () => data.records.filter((record) => record.estado === "No homogeneo").slice(-12).reverse(),
    [data.records],
  );
  const visibleComposition = useMemo(() => buildVisibleComposition(data.records), [data.records]);
  const statusCompositions = useMemo(() => ({
    homogeneous: buildStatusComposition(data.records, "Homogeneo"),
    nonHomogeneous: buildStatusComposition(data.records, "No homogeneo"),
  }), [data.records]);

  function updateFilter<K extends keyof PuntoAperturaFilters>(key: K, value: PuntoAperturaFilters[K]) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function resetFilters() {
    setFilters(initialData.filters);
  }

  async function handleExportPdf() {
    if (isExportingPdf) return;
    setIsExportingPdf(true);

    try {
      const response = await fetch("/api/calidad/punto-apertura/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filters: deferredFilters }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({})) as { message?: string };
        throw new Error(data.message ?? "Error al generar el PDF");
      }

      const disposition = response.headers.get("content-disposition") ?? "";
      const match = /filename="([^"]+)"/.exec(disposition);
      const filename = match?.[1] ?? `reporte_gerencial_punto_apertura_${Date.now()}.pdf`;

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al generar el PDF");
    } finally {
      setIsExportingPdf(false);
    }
  }

  return (
    <div className="min-w-0 space-y-4">
      <SectionPageShell
        eyebrow="Dashboard / Indicadores / Calidad"
        title="Punto de apertura"
        subtitle="Carta de control por registro para medir homogeneidad de apertura."
        icon={<Activity className="size-6" aria-hidden="true" />}
      >
        <FilterPanel>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-9">
            <MultiSelectField id="pa-week" label="Semana" value={filters.isoWeek} options={data.options.isoWeeks} onChange={(value) => updateFilter("isoWeek", value)} displayValue={formatIsoWeekLabel} />
            <MultiSelectField id="pa-year" label="Año" value={filters.year} options={data.options.years} onChange={(value) => updateFilter("year", value)} />
            <MultiSelectField id="pa-month" label="Mes" value={filters.month} options={data.options.months} onChange={(value) => updateFilter("month", value)} displayValue={formatMonthNumeric} />
            <DateField id="pa-date" label="Día" value={filters.date} onChange={(value) => updateFilter("date", value)} />
            <MultiSelectField id="pa-area" label="Área" value={filters.area} options={data.options.areas} onChange={(value) => updateFilter("area", value)} />
            <MultiSelectField id="pa-sp-type" label="Tipo SP" value={filters.spType} options={data.options.spTypes} onChange={(value) => updateFilter("spType", value)} />
            <MultiSelectField id="pa-dominant" label="Dominante" value={filters.dominantClass} options={data.options.dominantClasses} onChange={(value) => updateFilter("dominantClass", value)} />
            <MultiSelectField id="pa-bloque" label="Bloque" value={filters.bloque} options={data.options.bloques} onChange={(value) => updateFilter("bloque", value)} />
            <div className="flex items-end">
              <Button variant="outline" className="w-full" onClick={resetFilters}>
                <RefreshCcw className="size-4" aria-hidden="true" />
                Restablecer
              </Button>
            </div>
          </div>

          <KpiGrid columns={4}>
            <MetricTile label="Registros visibles" value={formatInteger(data.summary.totalRecords)} hint={`${formatInteger(data.summary.totalCycles)} ciclos`} />
            <MetricTile label="Dominante general" value={data.summary.dominantClass} hint={`Media visible: ${formatPercent(data.summary.visibleMeanPct)}`} />
            <button type="button" className="text-left" aria-label="Ver distribución de homogéneos" onClick={() => setSelectedStatusComposition("homogeneous")}>
              <MetricTile label="Homogéneos" value={formatPercent(data.summary.homogeneousPct)} hint={`${formatInteger(data.summary.homogeneousRecords)} registros | Ver distribución`} />
            </button>
            <button type="button" className="text-left" aria-label="Ver distribución de no homogéneos" onClick={() => setSelectedStatusComposition("nonHomogeneous")}>
              <MetricTile
                label="No homogéneos"
                value={formatPercent(100 - data.summary.homogeneousPct)}
                hint={`${formatInteger(data.summary.nonHomogeneousRecords)} registros | Ver distribución`}
                accent={data.summary.nonHomogeneousRecords ? "warning" : "success"}
              />
            </button>
          </KpiGrid>

          <p className="rounded-[18px] border border-border/70 bg-background/70 px-4 py-3 text-xs text-muted-foreground">
            Criterio de homogeneidad: un registro cumple cuando la participación de su punto dominante es mayor o igual a {formatPercent(data.summary.lowerLimitPct)}.
          </p>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">Composicion visible por punto de apertura</p>
                <p className="text-xs text-muted-foreground">
                  Participacion sobre el total de tallos de apertura de los registros filtrados.
                </p>
              </div>
              <Badge variant="secondary" className="rounded-full px-3 py-1">
                Total apertura: {formatInteger(visibleComposition.total)}
              </Badge>
            </div>
            <KpiGrid columns={5}>
              {visibleComposition.items.map((item) => (
                <MetricTile
                  key={item.key}
                  label={item.label}
                  value={formatPercent(item.pct)}
                  hint={`${formatInteger(item.count)} tallos`}
                  accent={item.pct >= 50 ? "success" : "default"}
                />
              ))}
            </KpiGrid>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="outline" className="rounded-full px-3 py-1">
              Dominante general: {data.summary.dominantClass}
            </Badge>
            <Badge variant="secondary" className="rounded-full px-3 py-1">
              Ciclos: {formatInteger(data.summary.totalCycles)}
            </Badge>
            <Badge variant="outline" className="rounded-full px-3 py-1">
              Media visible: {formatPercent(data.summary.visibleMeanPct)}
            </Badge>
            {data.records.length > data.chartRecords.length ? (
              <span>
                El gráfico muestra los últimos {formatInteger(data.summary.chartRecordLimit)} registros del filtro para mantener fluidez; los KPIs se calculan con todos.
              </span>
            ) : null}
            {isValidating ? (
              <span className="inline-flex items-center gap-2" role="status" aria-live="polite">
                <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                Actualizando.
              </span>
            ) : null}
          </div>

          {error ? (
            <div className="flex items-center gap-3 text-sm text-destructive">
              {error.message}
              <button type="button" className="underline underline-offset-2" onClick={() => mutate()}>Reintentar</button>
            </div>
          ) : null}

          <div className="flex justify-end">
            <ExportButton
              formats={["pdf"]}
              disabled={isExportingPdf}
              label={isExportingPdf ? "Exportando..." : "Exportar PDF"}
              ariaLabel="Exportar PDF de punto de apertura"
              onExport={() => handleExportPdf()}
            />
          </div>
        </FilterPanel>
      </SectionPageShell>

      <ChartSection>
        <Card className="starter-panel border-border/70 bg-card/86">
          <CardContent className="space-y-4 pt-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold tracking-tight">Carta de control por registro</h2>
                <p className="text-sm text-muted-foreground">
                  Haz click en un punto para ver la mezcla: botón, 1 a 3, 4 a 9, 10 a 20 y más de 20.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge className="bg-emerald-500 text-white hover:bg-emerald-500">Homogéneo</Badge>
                <Badge className="bg-amber-500 text-white hover:bg-amber-500">No homogéneo</Badge>
              </div>
            </div>
            <PuntoAperturaControlChart
              records={data.chartRecords}
              meanPct={data.summary.meanPct}
              lowerLimitPct={data.summary.lowerLimitPct}
              onRecordClick={setSelectedRecord}
            />
          </CardContent>
        </Card>
      </ChartSection>

      <DetailSection>
        <Card className="starter-panel border-border/70 bg-card/86">
          <CardContent className="space-y-4 pt-6">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Registros no homogéneos recientes</h2>
              <p className="text-sm text-muted-foreground">Lista operativa para revisar los puntos bajo el límite inferior.</p>
            </div>
            <CriticalRecordsTable records={criticalRecords} onRecordClick={setSelectedRecord} />
          </CardContent>
        </Card>
      </DetailSection>

      <PuntoAperturaRecordOverlay
        record={selectedRecord}
        lowerLimitPct={data.summary.lowerLimitPct}
        onClose={() => setSelectedRecord(null)}
      />

      {selectedStatusComposition === "homogeneous" ? (
        <StatusCompositionDialog
          title="Distribución de homogéneos"
          composition={statusCompositions.homogeneous}
          emptyLabel="No hay registros homogéneos para el filtro actual."
          onClose={() => setSelectedStatusComposition(null)}
        />
      ) : null}

      {selectedStatusComposition === "nonHomogeneous" ? (
        <StatusCompositionDialog
          title="Distribución de no homogéneos"
          composition={statusCompositions.nonHomogeneous}
          emptyLabel="No hay registros no homogéneos para el filtro actual."
          onClose={() => setSelectedStatusComposition(null)}
        />
      ) : null}
    </div>
  );
}

function CriticalRecordsTable({
  records,
  onRecordClick,
}: {
  records: PuntoAperturaRecord[];
  onRecordClick: (record: PuntoAperturaRecord) => void;
}) {
  if (!records.length) {
    return <EmptyState label="No hay registros no homogéneos para los filtros seleccionados." />;
  }

  return (
    <ScrollFadeTable className="rounded-[24px] border border-border/70">
      <table className="min-w-[900px] w-full text-sm">
          <thead>
            <tr className="bg-muted/50 text-left text-xs text-muted-foreground">
              <th className="px-3 py-2 font-semibold">Fecha</th>
              <th className="px-3 py-2 font-semibold">Bloque</th>
              <th className="px-3 py-2 font-semibold">Área</th>
              <th className="px-3 py-2 font-semibold">Tipo SP</th>
              <th className="px-3 py-2 font-semibold">Dominante</th>
              <th className="px-3 py-2 text-right font-semibold">% dominante</th>
              <th className="px-3 py-2 text-right font-semibold">Total apertura</th>
            </tr>
          </thead>
          <tbody>
            {records.map((record) => (
              <tr
                key={record.id}
                className="cursor-pointer border-t border-border/50 transition-colors hover:bg-primary/5"
                onClick={() => onRecordClick(record)}
              >
                <td className="px-3 py-2">{record.fecha}</td>
                <td className="px-3 py-2">{record.bloque}</td>
                <td className="px-3 py-2 text-muted-foreground">{record.area}</td>
                <td className="px-3 py-2 text-muted-foreground">{record.spType}</td>
                <td className="px-3 py-2">{record.dominanteClase}</td>
                <td className="px-3 py-2 text-right font-medium">{formatPercent(record.dominantePct)}</td>
                <td className="px-3 py-2 text-right">{formatInteger(record.totalApertura)}</td>
              </tr>
            ))}
          </tbody>
      </table>
    </ScrollFadeTable>
  );
}

function buildVisibleComposition(records: PuntoAperturaRecord[]) {
  const totals = {
    boton: 0,
    unoTres: 0,
    cuatroNueve: 0,
    diezVeinte: 0,
    masVeinte: 0,
  };

  for (const record of records) {
    totals.boton += record.apertura.boton;
    totals.unoTres += record.apertura.unoTres;
    totals.cuatroNueve += record.apertura.cuatroNueve;
    totals.diezVeinte += record.apertura.diezVeinte;
    totals.masVeinte += record.apertura.masVeinte;
  }

  const total = Object.values(totals).reduce((sum, value) => sum + value, 0);

  return {
    total,
    items: APERTURE_COMPOSITION.map((entry) => ({
      key: entry.key,
      label: entry.label,
      count: totals[entry.key],
      pct: total > 0 ? (totals[entry.key] / total) * 100 : 0,
    })),
  };
}
