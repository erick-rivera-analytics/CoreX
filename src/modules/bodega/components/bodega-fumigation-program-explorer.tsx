"use client";

import { Fragment, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  CalendarClock,
  ChevronDown,
  ChevronRight,
  Droplets,
  Leaf,
  Package2,
  RefreshCcw,
  SprayCan,
} from "lucide-react";
import useSWR from "swr";
import { toast } from "sonner";

import type {
  FumigationWeekProgramApplication,
  FumigationWeekProgramFilters,
  FumigationWeekProgramLine,
  FumigationWeekProgramOptions,
  FumigationWeekProgramRow,
} from "@/lib/fumigation-week-program";
import { fetchJson } from "@/lib/fetch-json";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/shared/data-display/empty-state";
import { MetricTile } from "@/shared/data-display/metric-tile";
import { SingleSelectField } from "@/shared/filters/single-select-field";
import { FilterPanel, KpiGrid } from "@/shared/layout/filter-panel";
import { SectionPageShell } from "@/shared/layout/section-page-shell";
import { formatCount, formatDate, formatDecimal, formatFlexibleNumber, formatInteger, formatIsoWeekLabel } from "@/shared/lib/format";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { ExportButton } from "@/shared/ui/export-button";

type ExplorerResponse = {
  rows: FumigationWeekProgramRow[];
  options: FumigationWeekProgramOptions;
  appliedFilters: FumigationWeekProgramFilters;
};

type MethodSummary = {
  kind: FumigationWeekProgramOptions["kinds"][number];
  label: string;
  blockCount: number;
  litersTotal: number;
  recipeResolvedCount: number;
};

type ProductBlockRow = {
  key: string;
  productCode: string;
  productName: string;
  unitCode: string | null;
  blockId: string;
  quantityTotal: number;
  methodLabel: string;
  applicationNumber: number;
  variety: string;
};

type ProductSummaryRow = {
  key: string;
  productCode: string;
  productName: string;
  unitCode: string | null;
  quantityTotal: number;
  blockCount: number;
  labels: string[];
  blocks: ProductBlockRow[];
};

type ViewMode = "by-block" | "by-product-block";

type ExplorerProps = {
  initialRows: FumigationWeekProgramRow[];
  initialOptions: FumigationWeekProgramOptions;
  initialFilters: FumigationWeekProgramFilters;
  icon?: LucideIcon;
};

const EMPTY_ROWS: FumigationWeekProgramRow[] = [];

const fetcher = (url: string) =>
  fetchJson<ExplorerResponse>(url, "No se pudo cargar la programacion de aplicaciones fitosanitarias.");

function weekLabel(option: FumigationWeekProgramOptions["isoWeeks"][number]) {
  return `${formatIsoWeekLabel(option.isoWeekId)} · ${formatDate(option.weekStartDate)} - ${formatDate(option.weekEndDate)}`;
}

function kindLabel(value: FumigationWeekProgramOptions["kinds"][number] | "") {
  if (value === "REGULAR") return "Normal";
  if (value === "DRON") return "Dron";
  if (value === "LANZAS") return "Lanzas eficientes";
  return value;
}

function buildQueryString(filters: FumigationWeekProgramFilters) {
  const search = new URLSearchParams();
  if (filters.isoWeekId) search.set("isoWeekId", filters.isoWeekId);
  if (filters.variety) search.set("variety", filters.variety);
  if (filters.areaId) search.set("areaId", filters.areaId);
  return search.toString();
}

function summarizeApplication(application: FumigationWeekProgramApplication | undefined) {
  if (!application) return null;
  return {
    applicationNumber: application.applicationNumber,
    lineCount: application.lineCount,
    quantityTotal: application.lines.reduce((sum, line) => sum + (line.quantityTotal ?? 0), 0),
  };
}

function RecipeLineCard({ line }: { line: FumigationWeekProgramLine }) {
  return (
    <div className="rounded-[16px] border border-border/70 bg-background/80 px-3 py-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="font-medium text-foreground">
            {line.productCode ? `${line.productCode} - ` : ""}
            {line.productName}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {line.unitCode ?? "Sin unidad"} · {formatFlexibleNumber(line.dosePerLiter)} / L
          </p>
        </div>
        <Package2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </div>
      <div className="mt-2 grid gap-2 text-xs text-muted-foreground md:grid-cols-2">
        <div>
          <p className="uppercase tracking-[0.12em]">Litros bloque</p>
          <p className="font-medium text-foreground">{formatDecimal(line.litersTotal, 2)} L</p>
        </div>
        <div>
          <p className="uppercase tracking-[0.12em]">Cantidad bloque</p>
          <p className="font-medium text-foreground">
            {formatDecimal(line.quantityTotal, 2)} {line.unitCode ?? ""}
          </p>
        </div>
      </div>
    </div>
  );
}

export function BodegaFumigationProgramExplorer({
  initialRows = EMPTY_ROWS,
  initialOptions,
  initialFilters,
  icon: Icon = SprayCan,
}: ExplorerProps) {
  const [filters, setFilters] = useState<FumigationWeekProgramFilters>(initialFilters);
  const [viewMode, setViewMode] = useState<ViewMode>("by-block");
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
  const queryString = useMemo(() => buildQueryString(filters), [filters]);

  const { data, isLoading } = useSWR<ExplorerResponse>(
    `/api/bodega/planificacion/aplicaciones-fitosanitarias?${queryString}`,
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
  const selectedWeek = useMemo(
    () => options.isoWeeks.find((option) => option.isoWeekId === filters.isoWeekId) ?? null,
    [options.isoWeeks, filters.isoWeekId],
  );

  const methodSummaries = useMemo<MethodSummary[]>(() => {
    return options.kinds.map((kind) => {
      const methodRows = rows.filter((row) => row.fumigationKind === kind);
      return {
        kind,
        label: kindLabel(kind),
        blockCount: new Set(methodRows.map((row) => row.blockId)).size,
        litersTotal: methodRows.reduce((sum, row) => sum + (row.litersTotal ?? 0), 0),
        recipeResolvedCount: methodRows.filter((row) => row.recipeResolved).length,
      };
    });
  }, [options.kinds, rows]);

  const visibleRows = useMemo(() => {
    if (!filters.kind) return rows;
    return rows.filter((row) => row.fumigationKind === filters.kind);
  }, [filters.kind, rows]);

  const productBlockRows = useMemo<ProductBlockRow[]>(() => {
    const grouped = new Map<string, ProductBlockRow>();

    for (const row of visibleRows) {
      for (const application of row.applications) {
        for (const line of application.lines) {
          if (!line.productCode || !line.productName) continue;
          if (line.quantityTotal === null || Number.isNaN(line.quantityTotal)) continue;

          const key = [
            line.productCode,
            application.applicationNumber,
            row.blockId,
            line.unitCode ?? "",
            row.fumigationKind,
          ].join("|");

          const current = grouped.get(key) ?? {
            key,
            productCode: line.productCode,
            productName: line.productName,
            unitCode: line.unitCode ?? null,
            blockId: row.blockId,
            quantityTotal: 0,
            methodLabel: kindLabel(row.fumigationKind),
            applicationNumber: application.applicationNumber,
            variety: row.variety,
          };

          current.quantityTotal += line.quantityTotal;
          grouped.set(key, current);
        }
      }
    }

    return Array.from(grouped.values()).sort((left, right) => {
      const codeCompare = left.productCode.localeCompare(right.productCode, "es");
      if (codeCompare !== 0) return codeCompare;
      return left.blockId.localeCompare(right.blockId, "es", { numeric: true });
    });
  }, [visibleRows]);

  const productSummaryRows = useMemo<ProductSummaryRow[]>(() => {
    type Accumulator = Omit<ProductSummaryRow, "labels"> & { labelSet: Set<string> };
    const grouped = new Map<string, Accumulator>();

    for (const row of productBlockRows) {
      const key = [row.productCode, row.unitCode ?? ""].join("|");
      const current = grouped.get(key) ?? {
        key,
        productCode: row.productCode,
        productName: row.productName,
        unitCode: row.unitCode,
        quantityTotal: 0,
        blockCount: 0,
        labelSet: new Set<string>(),
        blocks: [],
      };

      current.quantityTotal += row.quantityTotal;
      current.blocks.push(row);
      current.blockCount += 1;
      current.labelSet.add(`${row.methodLabel} · ${row.variety} · Ap ${row.applicationNumber}`);
      grouped.set(key, current);
    }

    return Array.from(grouped.values())
      .map(({ labelSet, ...group }) => ({
        ...group,
        labels: [...labelSet].sort((left, right) => left.localeCompare(right, "es")),
        blocks: group.blocks.sort((left, right) => left.blockId.localeCompare(right.blockId, "es", { numeric: true })),
      }))
      .sort((left, right) => left.productCode.localeCompare(right.productCode, "es"));
  }, [productBlockRows]);

  const kpis = useMemo(() => {
    const blockCount = new Set(visibleRows.map((row) => row.blockId)).size;
    const methodCount = new Set(visibleRows.map((row) => row.fumigationKind)).size;
    const recipeResolvedCount = visibleRows.filter((row) => row.recipeResolved).length;
    const litersTotal = visibleRows.reduce((sum, row) => sum + (row.litersTotal ?? 0), 0);

    return {
      blockCount,
      methodCount,
      recipeResolvedCount,
      litersTotal,
    };
  }, [visibleRows]);

  function resetFilters() {
    setFilters({
      isoWeekId: defaultIsoWeekId,
      kind: "",
      variety: "",
      areaId: "",
    });
    setExpandedProducts(new Set());
  }

  function toggleProduct(productKey: string) {
    setExpandedProducts((current) => {
      const next = new Set(current);
      if (next.has(productKey)) next.delete(productKey);
      else next.add(productKey);
      return next;
    });
  }

  async function handleExportPdf() {
    try {
      const response = await fetch("/api/bodega/planificacion/aplicaciones-fitosanitarias/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filters,
          viewMode,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({})) as { message?: string };
        const message = data.message ?? `No se pudo generar el PDF (HTTP ${response.status}).`;
        toast.error(message);
        return;
      }

      const disposition = response.headers.get("content-disposition") ?? "";
      const match = /filename="([^"]+)"/.exec(disposition);
      const filename = match?.[1] ?? `aplicaciones_fitosanitarias_${filters.isoWeekId || "semana"}.pdf`;
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
      const message = error instanceof Error ? error.message : "No se pudo generar el PDF.";
      toast.error(message);
    }
  }

  return (
    <SectionPageShell
      eyebrow="Gestion / Bodega / Planificacion"
      title="Aplicaciones fitosanitarias"
      subtitle="Salida operativa para despacho de fumigacion. Todos los bloques nacen en Normal y solo cambian a Dron o Lanzas cuando Campo confirma esa planificacion."
      icon={<Icon className="size-6" aria-hidden="true" />}
    >
      <FilterPanel>
        <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-[1.6fr_1fr_1fr_1fr_auto]">
          <SingleSelectField
            id="fumigation-iso-week"
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
            id="fumigation-kind"
            label="Metodo"
            value={filters.kind}
            options={options.kinds}
            onChange={(value) => setFilters((current) => ({ ...current, kind: value as FumigationWeekProgramFilters["kind"] }))}
            emptyLabel="Todos"
            emptyValue=""
            displayValue={(value) => kindLabel(value as FumigationWeekProgramOptions["kinds"][number])}
          />
          <SingleSelectField
            id="fumigation-variety"
            label="Variedad"
            value={filters.variety}
            options={options.varieties}
            onChange={(value) => setFilters((current) => ({ ...current, variety: value }))}
            emptyLabel="Todas"
            emptyValue=""
          />
          <SingleSelectField
            id="fumigation-area"
            label="Area"
            value={filters.areaId}
            options={options.areas}
            onChange={(value) => setFilters((current) => ({ ...current, areaId: value }))}
            emptyLabel="Todas"
            emptyValue=""
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
          />
          <MetricTile
            label="Metodos visibles"
            value={formatInteger(kpis.methodCount)}
            hint="Todos nacen en Normal hasta que Campo confirme otro metodo."
          />
          <MetricTile
            label="Bloques programados"
            value={formatInteger(kpis.blockCount)}
            hint={`${formatInteger(kpis.recipeResolvedCount)} con receta resuelta`}
            accent={kpis.recipeResolvedCount ? "success" : "warning"}
          />
          <MetricTile
            label="Litros totales"
            value={formatDecimal(kpis.litersTotal, 2)}
            hint="Calculado con 4 litros por cama."
          />
        </KpiGrid>

        <Card className="border-border/70 bg-slate-950/[0.03]">
          <CardContent className="flex flex-wrap items-center gap-3 px-4 py-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <CalendarClock className="size-4" aria-hidden="true" />
              <span>Se filtra por semana ISO operativa y usa la planificacion confirmada desde Campo.</span>
            </div>
            <div className="flex items-center gap-2">
              <Leaf className="size-4" aria-hidden="true" />
              <span>La receta se resuelve por semana fenologica, variedad y metodo.</span>
            </div>
            <div className="flex items-center gap-2">
              <Droplets className="size-4" aria-hidden="true" />
              <span>Salida preparada para despacho por bloque y consolidado por producto. PDF queda como siguiente fase homologada a Drench.</span>
            </div>
          </CardContent>
        </Card>
      </FilterPanel>

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.4fr]">
      <Card className="border-border/70 bg-card/90">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Catalogo por metodo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {methodSummaries.map((method) => {
            const isSelected = filters.kind === method.kind;
            return (
              <button
                key={method.kind}
                type="button"
                onClick={() => setFilters((current) => ({
                  ...current,
                  kind: current.kind === method.kind ? "" : method.kind,
                }))}
                className={cn(
                  "w-full rounded-[18px] border px-4 py-3 text-left transition-colors",
                  isSelected
                    ? "border-emerald-400 bg-emerald-50/70 dark:border-emerald-700 dark:bg-emerald-950/30"
                    : "border-border/70 bg-background/70 hover:border-emerald-300 hover:bg-emerald-50/40 dark:hover:border-emerald-800 dark:hover:bg-emerald-950/20",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">{method.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatCount(method.blockCount, "bloque", "bloques")} · {formatInteger(method.recipeResolvedCount)} recetas
                    </p>
                  </div>
                  <Badge variant={isSelected ? "default" : "outline"} className="rounded-full px-3 py-1 text-[11px] font-medium">
                    {formatDecimal(method.litersTotal, 2)} L
                  </Badge>
                </div>
              </button>
            );
          })}
          <div className="rounded-[16px] border border-border/70 bg-background/60 px-3 py-3 text-xs text-muted-foreground">
            Bodega puede revisar por separado el catalogo `Normal`, `Dron` y `Lanzas eficientes`. Si Campo cambia el metodo y guarda, este panel debe reflejarlo aqui.
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/90">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-base font-semibold">
              {viewMode === "by-block"
                ? "Programacion semanal por bloque"
                : "Programacion semanal por producto / bloque"}
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
                ariaLabel="Exportar PDF de aplicaciones fitosanitarias"
                onExport={async () => handleExportPdf()}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {viewMode === "by-block" ? (
            rows.length ? (
              <div className="overflow-hidden rounded-[20px] border border-border/70">
                <div className="max-h-[640px] overflow-auto">
                  <table className="min-w-full divide-y divide-border text-sm">
                    <thead className="sticky top-0 z-10 bg-background/95 backdrop-blur">
                      <tr className="text-left text-xs uppercase tracking-[0.18em] text-muted-foreground">
                        <th className="px-4 py-3 font-medium">Bloque</th>
                        <th className="px-4 py-3 font-medium">Variedad</th>
                        <th className="px-4 py-3 font-medium">Semana fenologica</th>
                        <th className="px-4 py-3 font-medium">Metodo</th>
                        <th className="px-4 py-3 font-medium"># Camas 30m</th>
                        <th className="px-4 py-3 font-medium">Litros bloque</th>
                        <th className="px-4 py-3 font-medium">Despacho por aplicaciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {rows.map((row) => {
                        const applicationSummaries = [1, 2, 3].map((applicationNumber) =>
                          summarizeApplication(row.applications.find((item) => item.applicationNumber === applicationNumber)),
                        );

                        return (
                          <tr key={`${row.fumigationKind}:${row.cycleKey}`} className={cn(isLoading ? "animate-pulse" : "")}>
                            <td className="px-4 py-3 align-top">
                              <div className="space-y-1">
                                <p className="font-medium text-foreground">{row.blockId}</p>
                                <p className="text-xs text-muted-foreground">{row.areaId ? `Area ${row.areaId}` : "Sin area"}</p>
                              </div>
                            </td>
                            <td className="px-4 py-3 align-top">
                              <div className="space-y-1">
                                <p className="font-medium text-foreground">{row.variety}</p>
                                <p className="text-xs text-muted-foreground">{row.programTitle ?? "Programa base"}</p>
                              </div>
                            </td>
                            <td className="px-4 py-3 align-top">
                              <div className="space-y-1">
                                <p className="text-base font-semibold tracking-tight text-foreground">{formatInteger(row.phenologicalWeek)}</p>
                                <p className="text-xs text-muted-foreground">{formatIsoWeekLabel(row.isoWeekId)}</p>
                              </div>
                            </td>
                            <td className="px-4 py-3 align-top">
                              <div className="space-y-1">
                                <p className="font-medium text-foreground">{kindLabel(row.fumigationKind)}</p>
                                <p className="text-xs text-muted-foreground">{formatDate(row.weekStartDate)} - {formatDate(row.weekEndDate)}</p>
                              </div>
                            </td>
                            <td className="px-4 py-3 align-top text-foreground">
                              {row.bedCount !== null ? formatDecimal(row.bedCount, 2) : "-"}
                            </td>
                            <td className="px-4 py-3 align-top text-foreground">
                              {row.litersTotal !== null ? `${formatDecimal(row.litersTotal, 2)} L` : "-"}
                            </td>
                            <td className="px-4 py-3 align-top">
                              {row.recipeResolved ? (
                                <div className="min-w-[420px] space-y-3">
                                  {applicationSummaries.map((summary, index) => (
                                    <div
                                      key={`${row.cycleKey}:application:${index + 1}`}
                                      className="rounded-[16px] border border-border/70 bg-background/80 px-3 py-3"
                                    >
                                      <div className="flex flex-wrap items-start justify-between gap-3">
                                        <div className="space-y-1">
                                          <div className="flex items-center gap-2">
                                            <span className="rounded-full border border-border/70 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                                              Aplicacion {index + 1}
                                            </span>
                                          </div>
                                          <p className="text-xs text-muted-foreground">
                                            {summary
                                              ? `${formatCount(summary.lineCount, "producto", "productos")} · ${formatDecimal(summary.quantityTotal, 2)} total`
                                              : "Sin receta en esta aplicacion"}
                                          </p>
                                        </div>
                                      </div>
                                      {summary ? (
                                        <div className="mt-3 space-y-2">
                                          {row.applications
                                            .find((item) => item.applicationNumber === index + 1)
                                            ?.lines.map((line) => (
                                              <RecipeLineCard key={`${row.cycleKey}:${index + 1}:${line.lineOrder}`} line={line} />
                                            ))}
                                        </div>
                                      ) : null}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="rounded-[16px] border border-dashed border-amber-300 bg-amber-50 px-3 py-3 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                                  No hay receta homologada para este bloque y metodo. La planificacion existe, pero el despacho todavia no esta resuelto.
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <EmptyState label="No hay bloques programados para esta combinacion de filtros." />
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
                                <p className="text-xs text-muted-foreground">{row.labels.join(" · ")}</p>
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
                                      <p className="text-xs text-muted-foreground">
                                        {block.methodLabel} · {block.variety} · Ap {block.applicationNumber}
                                      </p>
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
