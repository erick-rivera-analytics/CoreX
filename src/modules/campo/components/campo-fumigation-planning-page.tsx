"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, ChevronDown, RefreshCcw, Save, SprayCan } from "lucide-react";
import useSWR from "swr";
import { toast } from "sonner";

import type {
  CampoFumigationPlanningApplication,
  CampoFumigationPlanningFilters,
  CampoFumigationPlanningOptions,
  CampoFumigationPlanningRow,
  FumigationPlanKind,
} from "@/lib/campo-fumigation-planning";
import { fetchJson } from "@/lib/fetch-json";
import { EmptyState } from "@/shared/data-display/empty-state";
import { MetricTile } from "@/shared/data-display/metric-tile";
import { SingleSelectField } from "@/shared/filters/single-select-field";
import { FilterPanel, KpiGrid } from "@/shared/layout/filter-panel";
import { SectionPageShell } from "@/shared/layout/section-page-shell";
import { formatCount, formatDate, formatDecimal, formatFlexibleNumber, formatInteger, formatIsoWeekLabel } from "@/shared/lib/format";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";

type ExplorerResponse = {
  rows: CampoFumigationPlanningRow[];
  options: CampoFumigationPlanningOptions;
  appliedFilters: CampoFumigationPlanningFilters;
};

type DraftState = Record<string, FumigationPlanKind>;

const fetcher = (url: string) =>
  fetchJson<ExplorerResponse>(url, "No se pudo cargar la planificacion operativa de fumigacion.");

function weekLabel(option: CampoFumigationPlanningOptions["isoWeeks"][number]) {
  return `${formatIsoWeekLabel(option.isoWeekId)} · ${formatDate(option.weekStartDate)} - ${formatDate(option.weekEndDate)}`;
}

function kindLabel(value: FumigationPlanKind) {
  if (value === "REGULAR") return "Normal";
  if (value === "DRON") return "Dron";
  return "Lanzas eficientes";
}

function buildQueryString(filters: CampoFumigationPlanningFilters) {
  const search = new URLSearchParams();
  if (filters.isoWeekId) search.set("isoWeekId", filters.isoWeekId);
  if (filters.variety) search.set("variety", filters.variety);
  if (filters.areaId) search.set("areaId", filters.areaId);
  return search.toString();
}

function ApplicationSummary({ application }: { application: CampoFumigationPlanningApplication }) {
  const quantityTotal = application.lines.reduce((sum, line) => sum + (line.quantityTotal ?? 0), 0);
  const litersPerBed = application.lines[0]?.litersPerBed ?? 4;
  const litersTotal = application.lines[0]?.litersTotal ?? null;

  return (
    <div className="space-y-2 rounded-[18px] border border-border/60 bg-background/85 p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-foreground">Aplicacion {application.applicationNumber}</p>
        <Badge variant="outline" className="rounded-full px-3 py-1 text-[11px] font-medium">
          {formatCount(application.lineCount, "producto", "productos")} · {formatFlexibleNumber(quantityTotal)} total
        </Badge>
      </div>
      <div className="space-y-2">
        {application.lines.map((line) => (
          <div key={`${application.applicationNumber}-${line.lineOrder}-${line.productName}`} className="flex items-start justify-between gap-3 text-sm">
            <div className="min-w-0">
              <p className="truncate font-medium text-foreground">{line.productName}</p>
              <p className="truncate text-[11px] text-muted-foreground">
                {line.productCode ? `${line.productCode} · ${line.unitCode ?? "Sin unidad"}` : "Sin vinculo confirmado"}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="font-semibold tabular-nums text-foreground">{formatFlexibleNumber(line.quantityTotal)}</p>
              <p className="text-[11px] text-muted-foreground">{line.unitCode ?? "-"}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
        <span>Dosis expresada por litro.</span>
        <span>{formatFlexibleNumber(litersPerBed)} L por cama · {formatFlexibleNumber(litersTotal)} L bloque</span>
      </div>
    </div>
  );
}

export function CampoFumigationPlanningPage({
  initialRows,
  initialOptions,
  initialFilters,
  initialError,
}: {
  initialRows: CampoFumigationPlanningRow[];
  initialOptions: CampoFumigationPlanningOptions;
  initialFilters: CampoFumigationPlanningFilters;
  initialError?: string | null;
}) {
  const [filters, setFilters] = useState<CampoFumigationPlanningFilters>(initialFilters);
  const [draftKinds, setDraftKinds] = useState<DraftState>({});
  const [isSaving, setIsSaving] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const queryString = useMemo(() => buildQueryString(filters), [filters]);

  const { data, isLoading, mutate } = useSWR<ExplorerResponse>(
    `/api/campo/planificacion/programacion-fumigacion?${queryString}`,
    fetcher,
    {
      fallbackData: {
        rows: initialRows,
        options: initialOptions,
        appliedFilters: initialFilters,
      },
      keepPreviousData: true,
      dedupingInterval: 60_000,
    },
  );

  const rows = data?.rows ?? initialRows;
  const options = data?.options ?? initialOptions;
  const defaultIsoWeekId = options.defaultIsoWeekId || options.isoWeeks[0]?.isoWeekId || "";
  const selectedWeek = options.isoWeeks.find((option) => option.isoWeekId === filters.isoWeekId) ?? null;

  const effectiveRows = useMemo(() => (
    rows.map((row) => ({
      ...row,
      selectedKind: draftKinds[row.cycleKey] ?? row.selectedKind,
    }))
  ), [rows, draftKinds]);

  const rowsToPersist = useMemo(() => (
    effectiveRows.filter((row) => row.savedKind === null || row.selectedKind !== (row.savedKind ?? row.defaultKind))
  ), [effectiveRows]);

  useEffect(() => {
    setDraftKinds({});
    setExpandedRows({});
  }, [queryString]);

  const kpis = useMemo(() => {
    const blockCount = new Set(effectiveRows.map((row) => row.blockId)).size;
    const savedCount = effectiveRows.filter((row) => row.savedKind !== null).length;
    const recipeResolvedCount = effectiveRows.filter((row) => (row.recipesByKind[row.selectedKind] ?? []).length > 0).length;
    const litersTotal = effectiveRows.reduce((sum, row) => sum + (row.litersTotal ?? 0), 0);
    return {
      blockCount,
      savedCount,
      recipeResolvedCount,
      litersTotal,
      dirtyCount: rowsToPersist.length,
    };
  }, [effectiveRows, rowsToPersist.length]);

  function resetFilters() {
    setFilters({
      isoWeekId: defaultIsoWeekId,
      variety: "",
      areaId: "",
    });
  }

  function resetDrafts() {
    setDraftKinds({});
  }

  function toggleExpanded(cycleKey: string) {
    setExpandedRows((current) => ({
      ...current,
      [cycleKey]: !current[cycleKey],
    }));
  }

  async function saveChanges() {
    if (!rowsToPersist.length) {
      toast.message("No hay planificaciones pendientes por guardar.");
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch("/api/campo/planificacion/programacion-fumigacion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isoWeekId: filters.isoWeekId,
          changes: rowsToPersist.map((row) => ({
            cycleKey: row.cycleKey,
            blockId: row.blockId,
            parentBlock: row.parentBlock,
            areaId: row.areaId,
            variety: row.variety,
            phenologicalWeek: row.phenologicalWeek,
            selectedKind: row.selectedKind,
          })),
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({})) as { message?: string; error?: string };
        throw new Error(payload.message ?? payload.error ?? "No se pudo guardar la planificacion.");
      }

      toast.success("Planificacion guardada. Bodega ya puede consumir esta seleccion.");
      setDraftKinds({});
      await mutate();
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo guardar la planificacion.";
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {initialError ? (
        <div className="rounded-[24px] border border-amber-300/60 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <div className="min-w-0">
              <p className="font-medium">Estado del origen</p>
              <p className="mt-1 opacity-90">{initialError}</p>
            </div>
          </div>
        </div>
      ) : null}

      <SectionPageShell
        eyebrow="Gestion / Campo / Planificacion"
        title="Programacion Fumigacion"
        subtitle="Planificador operativo por bloque. Aqui se decide si cada bloque de la semana corre con programa Normal, Dron o Lanzas eficientes; esa seleccion es la que luego debe reflejarse en Bodega."
        icon={<SprayCan className="size-6" aria-hidden="true" />}
        actions={(
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" className="rounded-full" onClick={resetDrafts} disabled={!rowsToPersist.length || isSaving}>
              Reiniciar cambios
            </Button>
            <Button type="button" className="rounded-full" onClick={saveChanges} disabled={!rowsToPersist.length || isSaving}>
              <Save className="mr-2 size-4" aria-hidden="true" />
              {isSaving ? "Guardando..." : "Guardar planificacion"}
            </Button>
          </div>
        )}
      >
        <FilterPanel>
          <div className="grid gap-3 lg:grid-cols-3">
            <SingleSelectField
              id="campo-fumigation-iso-week"
              label="Semana ISO"
              value={filters.isoWeekId}
              options={options.isoWeeks.map((option) => option.isoWeekId)}
              onChange={(value) => setFilters((current) => ({ ...current, isoWeekId: value }))}
              omitEmpty
              displayValue={(value) => {
                const option = options.isoWeeks.find((item) => item.isoWeekId === value);
                return option ? weekLabel(option) : value;
              }}
            />
            <SingleSelectField
              id="campo-fumigation-variety"
              label="Variedad"
              value={filters.variety}
              options={options.varieties}
              onChange={(value) => setFilters((current) => ({ ...current, variety: value }))}
              emptyLabel="Todas las variedades"
              emptyValue=""
            />
            <SingleSelectField
              id="campo-fumigation-area"
              label="Area"
              value={filters.areaId}
              options={options.areas}
              onChange={(value) => setFilters((current) => ({ ...current, areaId: value }))}
              emptyLabel="Todas las areas"
              emptyValue=""
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" variant="outline" className="rounded-full" onClick={resetFilters}>
              <RefreshCcw className="mr-2 size-4" aria-hidden="true" />
              Reiniciar filtros
            </Button>
            {selectedWeek ? (
              <Badge variant="outline" className="rounded-full px-3 py-1 text-[11px] font-medium">
                {weekLabel(selectedWeek)}
              </Badge>
            ) : null}
            <Badge variant="outline" className="rounded-full px-3 py-1 text-[11px] font-medium">
              Default: Normal
            </Badge>
          </div>

          <KpiGrid columns={4}>
            <MetricTile
              label="Bloques visibles"
              value={formatInteger(kpis.blockCount)}
              hint="Bloques proyectados para la semana operativa."
            />
            <MetricTile
              label="Planificaciones guardadas"
              value={formatInteger(kpis.savedCount)}
              hint="Bloques que ya tienen seleccion persistida."
              accent={kpis.savedCount ? "success" : "default"}
            />
            <MetricTile
              label="Recetas resueltas"
              value={formatInteger(kpis.recipeResolvedCount)}
              hint={`${formatInteger(effectiveRows.length)} bloques visibles`}
              accent={kpis.recipeResolvedCount ? "success" : "warning"}
            />
            <MetricTile
              label="Litros proyectados"
              value={formatDecimal(kpis.litersTotal, 2)}
              hint="Calculado con 4 litros por cama."
            />
            <MetricTile
              label="Cambios pendientes"
              value={formatInteger(kpis.dirtyCount)}
              hint="Selecciona modo y luego guarda la semana."
              accent={kpis.dirtyCount ? "warning" : "default"}
            />
          </KpiGrid>
        </FilterPanel>

        {effectiveRows.length ? (
          <div className="space-y-4">
            {effectiveRows.map((row) => {
              const selectedKind = row.selectedKind;
              const applications = row.recipesByKind[selectedKind] ?? [];
              const isDirty = rowsToPersist.some((dirty) => dirty.cycleKey === row.cycleKey);
              const isExpanded = expandedRows[row.cycleKey] ?? false;

              return (
                <Card key={row.cycleKey} className="border-border/70 bg-card/92">
                  <CardHeader className="gap-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <CardTitle className="text-lg font-semibold tracking-tight">Bloque {row.blockId}</CardTitle>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {row.variety} · Semana fenologica {formatInteger(row.phenologicalWeek)} · {row.areaId ? `Area ${row.areaId}` : "Sin area"}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {row.savedKind ? (
                          <Badge variant="outline" className="rounded-full px-3 py-1 text-[11px] font-medium">
                            Guardado: {kindLabel(row.savedKind)}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="rounded-full px-3 py-1 text-[11px] font-medium">
                            Sin guardar
                          </Badge>
                        )}
                        {isDirty ? (
                          <Badge className="rounded-full px-3 py-1 text-[11px] font-medium">Pendiente</Badge>
                        ) : null}
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                      <button
                        type="button"
                        onClick={() => toggleExpanded(row.cycleKey)}
                        className="grid gap-3 rounded-[18px] border border-border/60 bg-background/70 p-4 text-left text-sm text-muted-foreground transition hover:border-border hover:bg-background md:grid-cols-4"
                      >
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.18em]">Semana fenologica</p>
                          <p className="mt-1 font-medium text-foreground">{formatInteger(row.phenologicalWeek)}</p>
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.18em]">Rango</p>
                          <p className="mt-1 font-medium text-foreground">{formatDate(row.weekStartDate)} - {formatDate(row.weekEndDate)}</p>
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.18em]">Plan actual</p>
                          <p className="mt-1 font-medium text-foreground">{kindLabel(selectedKind)}</p>
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.18em]">Camas / litros</p>
                          <p className="mt-1 font-medium text-foreground">
                            {formatFlexibleNumber(row.bedCount)} camas · {formatDecimal(row.litersTotal, 2)} L
                          </p>
                        </div>
                        <div className="md:col-span-4 flex items-center justify-between border-t border-border/50 pt-3">
                          <span className="text-xs text-muted-foreground">Haz click para ver el detalle de aplicaciones.</span>
                          <ChevronDown className={`size-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} aria-hidden="true" />
                        </div>
                      </button>

                      <div className="min-w-[220px]">
                        <SingleSelectField
                          id={`fumigation-kind-${row.cycleKey}`}
                          label="Metodo planificado"
                          value={selectedKind}
                          options={options.kinds}
                          onChange={(value) => setDraftKinds((current) => ({
                            ...current,
                            [row.cycleKey]: value as FumigationPlanKind,
                          }))}
                          omitEmpty
                          displayValue={(value) => kindLabel(value as FumigationPlanKind)}
                        />
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent>
                    {isExpanded ? (
                      applications.length ? (
                      <div className="grid gap-4 xl:grid-cols-3">
                        {applications.map((application) => (
                          <ApplicationSummary
                            key={`${row.cycleKey}-${selectedKind}-${application.applicationNumber}`}
                            application={application}
                          />
                        ))}
                      </div>
                    ) : (
                      <EmptyState label="No se encontro receta para esta combinacion de semana fenologica, variedad y modo." />
                    )
                    ) : null}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <EmptyState
            label={isLoading
              ? "Cargando planificacion operativa de fumigacion..."
              : "No hay bloques disponibles para la semana y filtros seleccionados."}
          />
        )}
      </SectionPageShell>
    </div>
  );
}
