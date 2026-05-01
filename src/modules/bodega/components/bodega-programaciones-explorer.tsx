"use client";

import { Fragment, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { CalendarClock, ChevronDown, ChevronRight, Package2, RefreshCcw } from "lucide-react";
import useSWR from "swr";

import type {
  DrenchWeekCalendarFilters,
  DrenchWeekCalendarOptions,
  DrenchWeekCalendarRow,
} from "@/lib/drench-week-calendar";
import { fetchJson } from "@/lib/fetch-json";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/shared/data-display/empty-state";
import { MetricTile } from "@/shared/data-display/metric-tile";
import { SingleSelectField } from "@/shared/filters/single-select-field";
import { FilterPanel, KpiGrid } from "@/shared/layout/filter-panel";
import { SectionPageShell } from "@/shared/layout/section-page-shell";
import { formatCount, formatDate, formatInteger, formatIsoWeekLabel } from "@/shared/lib/format";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { ExportButton } from "@/shared/ui/export-button";

type ExplorerResponse = {
  rows: DrenchWeekCalendarRow[];
  options: DrenchWeekCalendarOptions;
  appliedFilters: DrenchWeekCalendarFilters;
};

type GroupSummary = {
  key: string;
  label: string;
  cycleCount: number;
  blockCount: number;
  minWeek: number;
  maxWeek: number;
};

type ProductBlockRow = {
  key: string;
  productCode: string;
  productName: string;
  blockId: string;
  quantityTotal: number;
  unitCode: string | null;
  drenchGroupKey: string;
  drenchGroupLabel: string;
};

type ProductSummaryRow = {
  key: string;
  productCode: string;
  productName: string;
  unitCode: string | null;
  quantityTotal: number;
  blockCount: number;
  drenchGroupLabels: string[];
  blocks: ProductBlockRow[];
};

type ViewMode = "by-block" | "by-product-block";

type ExplorerProps = {
  initialRows: DrenchWeekCalendarRow[];
  initialOptions: DrenchWeekCalendarOptions;
  initialFilters: DrenchWeekCalendarFilters;
  icon?: LucideIcon;
};

const EMPTY_ROWS: DrenchWeekCalendarRow[] = [];

const weekLabel = (option: DrenchWeekCalendarOptions["isoWeeks"][number]) =>
  `${formatIsoWeekLabel(option.isoWeekId)} · ${formatDate(option.weekStartDate)} - ${formatDate(option.weekEndDate)}`;

const fetcher = (url: string) =>
  fetchJson<ExplorerResponse>(url, "No se pudo cargar la calendarizacion semanal de drench.");

function formatDecimal(value: number | null | undefined, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  return new Intl.NumberFormat("es-EC", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

function buildQueryString(filters: DrenchWeekCalendarFilters) {
  const search = new URLSearchParams();
  if (filters.isoWeekId) search.set("isoWeekId", filters.isoWeekId);
  if (filters.cycleType) search.set("cycleType", filters.cycleType);
  if (filters.variety) search.set("variety", filters.variety);
  if (filters.areaId) search.set("areaId", filters.areaId);
  return search.toString();
}

function getCycleTypeLabel(value: string) {
  return value === "P" ? "Poda" : value === "S" ? "Siembra" : value;
}

export function BodegaProgramacionesExplorer({
  initialRows = EMPTY_ROWS,
  initialOptions,
  initialFilters,
  icon: Icon = CalendarClock,
}: ExplorerProps) {
  const [filters, setFilters] = useState<DrenchWeekCalendarFilters>(initialFilters);
  const [selectedGroupKey, setSelectedGroupKey] = useState<string>("");
  const [viewMode, setViewMode] = useState<ViewMode>("by-block");
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
  const queryString = useMemo(() => buildQueryString(filters), [filters]);

  const { data, isLoading } = useSWR<ExplorerResponse>(
    `/api/bodega/planificacion/programaciones?${queryString}`,
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

  const visibleRows = useMemo(() => {
    if (!selectedGroupKey) return rows;
    return rows.filter((row) => row.drenchGroupKey === selectedGroupKey);
  }, [rows, selectedGroupKey]);

  const productBlockRows = useMemo<ProductBlockRow[]>(() => {
    const grouped = new Map<string, ProductBlockRow>();

    for (const row of visibleRows) {
      for (const line of row.recipeLines) {
        if (!line.productCode || !line.productName) continue;
        if (line.productQuantityTotal === null || Number.isNaN(line.productQuantityTotal)) continue;

        const key = [row.drenchGroupKey, line.productCode, row.blockId, line.unitCode ?? ""].join("|");
        const current = grouped.get(key) ?? {
          key,
          productCode: line.productCode,
          productName: line.productName,
          blockId: row.blockId,
          quantityTotal: 0,
          unitCode: line.unitCode ?? null,
          drenchGroupKey: row.drenchGroupKey,
          drenchGroupLabel: row.drenchGroupLabel,
        };

        current.quantityTotal += line.productQuantityTotal;
        grouped.set(key, current);
      }
    }

    return Array.from(grouped.values()).sort((left, right) => {
      const codeCompare = left.productCode.localeCompare(right.productCode, "es");
      if (codeCompare !== 0) return codeCompare;
      return left.blockId.localeCompare(right.blockId, "es", { numeric: true });
    });
  }, [visibleRows]);

  const productSummaryRows = useMemo<ProductSummaryRow[]>(() => {
    const grouped = new Map<string, ProductSummaryRow>();

    for (const row of productBlockRows) {
      const key = [row.productCode, row.unitCode ?? ""].join("|");
      const current = grouped.get(key) ?? {
        key,
        productCode: row.productCode,
        productName: row.productName,
        unitCode: row.unitCode,
        quantityTotal: 0,
        blockCount: 0,
        drenchGroupLabels: [],
        blocks: [],
      };

      current.quantityTotal += row.quantityTotal;
      current.blocks.push(row);
      current.blockCount += 1;
      if (!current.drenchGroupLabels.includes(row.drenchGroupLabel)) {
        current.drenchGroupLabels.push(row.drenchGroupLabel);
      }
      grouped.set(key, current);
    }

    return Array.from(grouped.values())
      .map((group) => ({
        ...group,
        blocks: group.blocks.sort((left, right) =>
          left.blockId.localeCompare(right.blockId, "es", { numeric: true })),
        drenchGroupLabels: group.drenchGroupLabels.sort((left, right) => left.localeCompare(right, "es")),
      }))
      .sort((left, right) => left.productCode.localeCompare(right.productCode, "es"));
  }, [productBlockRows]);

  const selectedWeek = useMemo(
    () => options.isoWeeks.find((option) => option.isoWeekId === filters.isoWeekId) ?? null,
    [options.isoWeeks, filters.isoWeekId],
  );

  const kpis = useMemo(() => {
    const cycleCount = new Set(visibleRows.map((row) => row.cycleKey)).size;
    const blockCount = new Set(visibleRows.map((row) => row.blockId)).size;
    const groupCount = new Set(visibleRows.map((row) => row.drenchGroupKey)).size;
    const recipeResolvedCount = visibleRows.filter((row) => row.recipeLines.length > 0).length;
    const phenologicalWeeks = visibleRows.map((row) => row.phenologicalWeek);
    const minWeek = phenologicalWeeks.length ? Math.min(...phenologicalWeeks) : 0;
    const maxWeek = phenologicalWeeks.length ? Math.max(...phenologicalWeeks) : 0;

    return {
      cycleCount,
      blockCount,
      groupCount,
      recipeResolvedCount,
      minWeek,
      maxWeek,
    };
  }, [visibleRows]);

  const groupedSummaries = useMemo<GroupSummary[]>(() => {
    const groups = new Map<string, GroupSummary & { cycleKeys: Set<string>; blockIds: Set<string> }>();

    for (const row of rows) {
      const existing = groups.get(row.drenchGroupKey) ?? {
        key: row.drenchGroupKey,
        label: row.drenchGroupLabel,
        cycleCount: 0,
        blockCount: 0,
        minWeek: row.phenologicalWeek,
        maxWeek: row.phenologicalWeek,
        cycleKeys: new Set<string>(),
        blockIds: new Set<string>(),
      };

      existing.cycleKeys.add(row.cycleKey);
      existing.blockIds.add(row.blockId);
      existing.minWeek = Math.min(existing.minWeek, row.phenologicalWeek);
      existing.maxWeek = Math.max(existing.maxWeek, row.phenologicalWeek);
      groups.set(row.drenchGroupKey, existing);
    }

    return Array.from(groups.values())
      .map((group) => ({
        key: group.key,
        label: group.label,
        cycleCount: group.cycleKeys.size,
        blockCount: group.blockIds.size,
        minWeek: group.minWeek,
        maxWeek: group.maxWeek,
      }))
      .sort((left, right) => left.label.localeCompare(right.label, "es"));
  }, [rows]);

  const defaultIsoWeekId = options.defaultIsoWeekId || options.isoWeeks[0]?.isoWeekId || "";

  function resetFilters() {
    setFilters({
      isoWeekId: defaultIsoWeekId,
      cycleType: "",
      variety: "",
      areaId: "",
    });
    setSelectedGroupKey("");
    setExpandedProducts(new Set());
  }

  function toggleProduct(productKey: string) {
    setExpandedProducts((current) => {
      const next = new Set(current);
      if (next.has(productKey)) {
        next.delete(productKey);
      } else {
        next.add(productKey);
      }
      return next;
    });
  }

  async function handleExportPdf() {
    const response = await fetch("/api/bodega/planificacion/programaciones/pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filters,
        selectedGroupKey,
        viewMode,
      }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({})) as { message?: string };
      throw new Error(data.message ?? "No se pudo generar el PDF.");
    }

    const disposition = response.headers.get("content-disposition") ?? "";
    const match = /filename="([^"]+)"/.exec(disposition);
    const filename = match?.[1] ?? `programacion_drench_${filters.isoWeekId || "semana"}.pdf`;
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <SectionPageShell
      eyebrow="Gestion / Bodega / Planificacion"
      title="Programaciones"
      subtitle="Salida semanal de drench por bloque. La vista usa la semana ISO objetivo para calendarizar y muestra la receta resuelta del bloque en formato operativo."
      icon={<Icon className="size-6" aria-hidden="true" />}
    >
      <FilterPanel>
        <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-[1.7fr_1fr_1fr_1fr_auto]">
          <SingleSelectField
            id="drench-calendar-iso-week"
            label="Semana ISO objetivo"
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
            id="drench-calendar-cycle-type"
            label="Tipo SP"
            value={filters.cycleType}
            options={options.cycleTypes}
            onChange={(value) => setFilters((current) => ({ ...current, cycleType: value }))}
            emptyLabel="Todos"
            displayValue={getCycleTypeLabel}
          />
          <SingleSelectField
            id="drench-calendar-variety"
            label="Variedad"
            value={filters.variety}
            options={options.varieties}
            onChange={(value) => setFilters((current) => ({ ...current, variety: value }))}
            emptyLabel="Todas"
          />
          <SingleSelectField
            id="drench-calendar-area"
            label="Area"
            value={filters.areaId}
            options={options.areas}
            onChange={(value) => setFilters((current) => ({ ...current, areaId: value }))}
            emptyLabel="Todas"
          />
          <Button
            type="button"
            variant="outline"
            className="h-11 rounded-[16px] px-4"
            onClick={resetFilters}
          >
            <RefreshCcw className="mr-2 size-4" aria-hidden="true" />
            Restablecer
          </Button>
        </div>

        <KpiGrid columns={4}>
          <MetricTile
            label="Semana ISO objetivo"
            value={selectedWeek ? formatIsoWeekLabel(selectedWeek.isoWeekId) : "-"}
            hint={selectedWeek ? `${formatDate(selectedWeek.weekStartDate)} al ${formatDate(selectedWeek.weekEndDate)}` : "Sin semana seleccionada"}
            accent="default"
          />
          <MetricTile
            label="Fecha de publicacion"
            value={rows[0]?.publicationDate ? formatDate(rows[0].publicationDate) : "-"}
            hint={rows[0]?.publicationIsoWeekId ? `Publica desde ${formatIsoWeekLabel(rows[0].publicationIsoWeekId)}` : "Se publica el jueves de la semana anterior"}
            accent="success"
          />
          <MetricTile
            label="Bloques programados"
            value={formatInteger(kpis.blockCount)}
            hint={`${formatCount(kpis.cycleCount, "ciclo", "ciclos")} calendarizados para la semana`}
            accent="default"
          />
          <MetricTile
            label="Recetas resueltas"
            value={formatInteger(kpis.recipeResolvedCount)}
            hint={rows.length ? `${formatCount(kpis.groupCount, "grupo base", "grupos base")} visibles en esta semana` : "Sin bloques proyectados"}
            accent="warning"
          />
        </KpiGrid>
      </FilterPanel>

      <Card className="border-border/70 bg-card/90">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Pendiente del proyecto</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 text-sm text-muted-foreground">
          <p>
            Anclar esta proyeccion a la base de vegetativo, que ya trae la calendarizacion operativa. Por ahora,
            la vista semanal usa calendario ISO oficial + regla fenologica semanal. La migracion a planificacion
            diaria queda reservada para una fase futura.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.35fr]">
        <Card className="border-border/70 bg-card/90">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Resumen por grupo base</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {groupedSummaries.length ? (
              groupedSummaries.map((group) => {
                const isSelected = selectedGroupKey === group.key;
                return (
                <div
                  key={group.key}
                  className={cn(
                    "cursor-pointer rounded-[18px] border px-4 py-3 transition-colors",
                    isSelected
                      ? "border-emerald-400 bg-emerald-50/70 dark:border-emerald-700 dark:bg-emerald-950/30"
                      : "border-border/70 bg-background/70 hover:border-emerald-300 hover:bg-emerald-50/40 dark:hover:border-emerald-800 dark:hover:bg-emerald-950/20",
                  )}
                  onClick={() => setSelectedGroupKey((current) => (current === group.key ? "" : group.key))}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelectedGroupKey((current) => (current === group.key ? "" : group.key));
                    }
                  }}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-foreground">{group.label}</p>
                      <p className="text-xs text-muted-foreground">Variedad / Tipo SP</p>
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      <p>{formatCount(group.cycleCount, "ciclo", "ciclos")}</p>
                      <p>{formatCount(group.blockCount, "bloque", "bloques")}</p>
                    </div>
                  </div>
                  <div className="mt-3 rounded-[14px] bg-slate-900/5 px-3 py-2 text-xs text-muted-foreground dark:bg-white/5">
                    Semana fenologica resuelta:{" "}
                    <span className="font-medium text-foreground">
                      {group.minWeek === group.maxWeek
                        ? `Semana ${group.minWeek}`
                        : `Semanas ${group.minWeek} a ${group.maxWeek}`}
                    </span>
                  </div>
                </div>
              )})
            ) : (
              <EmptyState label="No hay grupos base para la semana ISO seleccionada." />
            )}
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/90">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="text-base font-semibold">
                {viewMode === "by-block" ? "Programacion semanal por bloque" : "Programacion semanal por producto / bloque"}
              </CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex rounded-[16px] border border-border/70 bg-background/80 p-1">
                  <Button
                    type="button"
                    size="sm"
                    variant={viewMode === "by-block" ? "default" : "ghost"}
                    className="rounded-[12px]"
                    onClick={() => setViewMode("by-block")}
                  >
                    Por bloque
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={viewMode === "by-product-block" ? "default" : "ghost"}
                    className="rounded-[12px]"
                    onClick={() => setViewMode("by-product-block")}
                  >
                    Por producto / bloque
                  </Button>
                </div>
                <ExportButton
                  formats={["pdf"]}
                  label="Exportar PDF"
                  onExport={async () => handleExportPdf()}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {selectedGroupKey ? (
              <div className="mb-3 rounded-[16px] border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">
                Mostrando solo {visibleRows[0]?.drenchGroupLabel ?? selectedGroupKey}. Haz click otra vez en el grupo para quitar el filtro.
              </div>
            ) : null}
            {viewMode === "by-block" ? (
              visibleRows.length ? (
              <div className="overflow-hidden rounded-[20px] border border-border/70">
                <div className="max-h-[640px] overflow-auto">
                  <table className="min-w-full divide-y divide-border text-sm">
                    <thead className="sticky top-0 z-10 bg-background/95 backdrop-blur">
                      <tr className="text-left text-xs uppercase tracking-[0.18em] text-muted-foreground">
                        <th className="px-4 py-3 font-medium">Cycle ID</th>
                        <th className="px-4 py-3 font-medium">Bloque</th>
                        <th className="px-4 py-3 font-medium">Semana ISO</th>
                        <th className="px-4 py-3 font-medium">Categoria fenologica</th>
                        <th className="px-4 py-3 font-medium"># Camas 30m2</th>
                        <th className="px-4 py-3 font-medium">Receta por bloque</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {visibleRows.map((row) => (
                        <tr key={`${row.isoWeekId}:${row.cycleKey}`} className={cn(isLoading ? "animate-pulse" : "")}>
                          <td className="px-4 py-3 align-top">
                            <div className="space-y-1">
                              <p className="font-medium text-foreground">{row.cycleKey}</p>
                              <p className="text-xs text-muted-foreground">{row.parentBlock ?? "Sin bloque padre"}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3 align-top">
                            <div className="space-y-1">
                              <p className="font-medium text-foreground">{row.blockId}</p>
                              <p className="text-xs text-muted-foreground">{row.variety} / {row.cycleTypeLabel}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3 align-top">
                            <div className="space-y-1">
                              <p className="font-medium text-foreground">{formatIsoWeekLabel(row.isoWeekId)}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3 align-top">
                            <div className="space-y-1">
                              <p className="text-base font-semibold tracking-tight text-foreground">{formatInteger(row.phenologicalWeek)}</p>
                              <p className="text-xs text-muted-foreground">{row.recipeRuleCode}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3 align-top text-foreground">
                            {row.bedCount !== null ? formatDecimal(row.bedCount, 2) : "-"}
                          </td>
                          <td className="px-4 py-3 align-top">
                            {row.recipeLines.length ? (
                              <div className="min-w-[360px] space-y-2">
                                {row.recipeLines.map((line) => (
                                  <div
                                    key={`${row.cycleKey}:${line.lineId}`}
                                    className="rounded-[16px] border border-border/70 bg-background/80 px-3 py-2"
                                  >
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                          <span className="rounded-full border border-border/70 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                                            {line.applicationMethod ?? "Metodo"}
                                          </span>
                                          <span className="text-xs text-muted-foreground">
                                            {line.dosageBasis === "PER_BED"
                                              ? "N/A litros/cama"
                                              : line.dosageBasis === "PER_1000_LITERS"
                                                ? `${formatDecimal(line.litersPerBed, 1)} L/cama · tanque 1000L`
                                              : `${formatDecimal(line.litersPerBed, 1)} L/cama`}
                                          </span>
                                          {line.productOrigin === "LABORATORIO" ? (
                                            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-amber-700 dark:text-amber-200">
                                              Lab
                                            </span>
                                          ) : null}
                                        </div>
                                        <p className="font-medium text-foreground">
                                          {line.productCode ? `${line.productCode} - ` : ""}
                                          {line.productName ?? "Producto sin homologar"}
                                        </p>
                                      </div>
                                      <Package2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                                    </div>
                                    <div className="mt-2 grid gap-2 text-xs text-muted-foreground md:grid-cols-3">
                                      <div>
                                        <p className="uppercase tracking-[0.12em]">Cantidad producto</p>
                                        <p className="font-medium text-foreground">
                                          {formatDecimal(line.productQuantityDose, 2)} {line.unitCode ?? ""}
                                        </p>
                                      </div>
                                      <div>
                                        <p className="uppercase tracking-[0.12em]">Litros bloque</p>
                                        <p className="font-medium text-foreground">
                                          {line.dosageBasis === "PER_BED"
                                            ? "N/A"
                                            : `${formatDecimal(line.litersPerBlock, 0)} L`}
                                        </p>
                                      </div>
                                      <div>
                                        <p className="uppercase tracking-[0.12em]">Cantidad bloque</p>
                                        <p className="font-medium text-foreground">
                                          {formatDecimal(line.productQuantityTotal, 2)} {line.unitCode ?? ""}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="rounded-[16px] border border-dashed border-amber-300 bg-amber-50 px-3 py-3 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                                No hay receta homologada para {row.recipeRuleCode}. La calendarizacion existe, pero la receta de Drench todavia no esta resuelta.
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <EmptyState label="No hay ciclos calendarizados para esta combinacion de filtros." />
            )
            ) : productSummaryRows.length ? (
              <div className="overflow-hidden rounded-[20px] border border-border/70">
                <div className="max-h-[640px] overflow-auto">
                  <table className="min-w-full divide-y divide-border text-sm">
                    <thead className="sticky top-0 z-10 bg-background/95 backdrop-blur">
                      <tr className="text-left text-xs uppercase tracking-[0.18em] text-muted-foreground">
                        <th className="px-4 py-3 font-medium">Codigo</th>
                        <th className="px-4 py-3 font-medium">Producto</th>
                        <th className="px-4 py-3 font-medium">Bloques</th>
                        <th className="px-4 py-3 font-medium">Cantidad</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {productSummaryRows.map((row) => {
                        const isExpanded = expandedProducts.has(row.key);
                        return (
                          <Fragment key={row.key}>
                            <tr
                              className="cursor-pointer bg-background hover:bg-muted/20"
                              onClick={() => toggleProduct(row.key)}
                            >
                              <td className="px-4 py-3 align-top font-medium text-foreground">
                                <span className="inline-flex items-center gap-2">
                                  {isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                                  {row.productCode}
                                </span>
                              </td>
                              <td className="px-4 py-3 align-top">
                                <div className="space-y-1">
                                  <p className="font-medium text-foreground">{row.productName}</p>
                                  <p className="text-xs text-muted-foreground">{row.drenchGroupLabels.join(" · ")}</p>
                                </div>
                              </td>
                              <td className="px-4 py-3 align-top text-foreground">
                                {formatCount(row.blockCount, "bloque", "bloques")}
                              </td>
                              <td className="px-4 py-3 align-top font-semibold text-foreground">
                                {formatDecimal(row.quantityTotal, 2)} {row.unitCode ?? ""}
                              </td>
                            </tr>
                            {isExpanded
                              ? row.blocks.map((block) => (
                                <tr key={block.key} className="bg-muted/10">
                                  <td className="px-4 py-2 align-top text-xs text-muted-foreground" />
                                  <td className="px-4 py-2 align-top">
                                    <div className="space-y-1 pl-6">
                                      <p className="text-sm font-medium text-foreground">Bloque {block.blockId}</p>
                                      <p className="text-xs text-muted-foreground">{block.drenchGroupLabel}</p>
                                    </div>
                                  </td>
                                  <td className="px-4 py-2 align-top text-sm text-muted-foreground">1 bloque</td>
                                  <td className="px-4 py-2 align-top text-sm text-foreground">
                                    {formatDecimal(block.quantityTotal, 2)} {block.unitCode ?? ""}
                                  </td>
                                </tr>
                              ))
                              : null}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <EmptyState label="No hay productos agregados para esta combinacion de filtros." />
            )}
          </CardContent>
        </Card>
      </div>
    </SectionPageShell>
  );
}
