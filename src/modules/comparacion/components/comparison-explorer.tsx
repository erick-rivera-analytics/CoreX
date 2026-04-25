"use client";

import { useEffect, useDeferredValue, useMemo, useState } from "react";
import { ArrowLeftRight, ShieldAlert, Swords, Trophy } from "lucide-react";
import useSWR from "swr";
import { toast } from "sonner";

import { ComparisonRadarPanel } from "@/modules/comparacion/components/comparison-radar-panel";
import { formatDate, formatInteger } from "@/shared/lib/format";
import { SectionPageShell } from "@/shared/layout/section-page-shell";
import { FilterPanel } from "@/shared/layout/filter-panel";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { MultiSelectField } from "@/shared/filters/multi-select-field";
import { SearchInput } from "@/shared/forms/search-input";
import { EmptyState } from "@/shared/data-display/empty-state";
import { fetchJson } from "@/lib/fetch-json";
import { cn } from "@/lib/utils";
import type {
  ComparisonCycleOption,
  ComparisonDashboardData,
  ComparisonPairPayload,
  ComparisonSearchFilters,
} from "@/lib/comparacion";


function buildOptionsQuery(filters: ComparisonSearchFilters) {
  const params = new URLSearchParams();
  if (filters.q) {
    params.set("q", filters.q);
  }
  if (filters.area !== "all") {
    params.set("area", filters.area);
  }
  if (filters.block) {
    params.set("block", filters.block);
  }
  if (filters.variety !== "all") {
    params.set("variety", filters.variety);
  }
  params.set("limit", String(filters.limit));
  return params.toString();
}

const comparisonOptionsFetcher = (url: string) =>
  fetchJson<ComparisonCycleOption[]>(url, "No se pudo cargar la busqueda de ciclos.");

const comparisonPairFetcher = (url: string) =>
  fetchJson<ComparisonPairPayload>(url, "No se pudo cargar la comparacion.");

function ComparisonSlotCard({
  label,
  cycle,
  tone,
}: {
  label: string;
  cycle: ComparisonCycleOption | null;
  tone: "left" | "right";
}) {
  return (
    <div
      className={cn(
        "rounded-[26px] border px-5 py-5",
        tone === "left"
          ? "border-slate-700/25 bg-slate-900/8 dark:bg-slate-900/12"
          : "border-accent/25 bg-accent/8",
      )}
    >
      <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">{label}</p>
      {cycle ? (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            <Badge className="rounded-full px-3 py-1">{cycle.cycleKey}</Badge>
            {cycle.block ? (
              <Badge variant="outline" className="rounded-full px-3 py-1">
                Bloque {cycle.block}
              </Badge>
            ) : null}
          </div>
          <div>
            <p className="text-xl font-semibold">{cycle.area || "Sin area"}</p>
            <p className="text-sm text-muted-foreground">
              {cycle.variety || "Sin variedad"} / {cycle.spType || "Sin SP"}
            </p>
          </div>
          <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
            <p>SP: {formatDate(cycle.spDate)}</p>
            <p>Inicio cos: {formatDate(cycle.harvestStartDate)}</p>
          </div>
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">
          Selecciona un ciclo para comparar.
        </p>
      )}
    </div>
  );
}

function MetricBattleRow({
  label,
  leftValue,
  rightValue,
  leftDisplay,
  rightDisplay,
  leftShare,
  rightShare,
  winner,
}: ComparisonPairPayload["metrics"][number]) {
  return (
    <div className="rounded-[24px] border border-border/70 bg-background/72 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">{label}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {winner === "neutral"
              ? "Sin criterio operativo de ganador"
              : leftValue === rightValue
                ? "Empate operativo"
                : winner === "left"
                  ? "Ventaja izquierda"
                  : "Ventaja derecha"}
          </p>
        </div>
        <Badge
          variant={winner === "tie" || winner === "neutral" ? "outline" : "secondary"}
          className="rounded-full px-3 py-1"
        >
          {winner === "neutral" ? "Sin criterio" : winner === "tie" ? "Empate" : winner === "left" ? "Gana A" : "Gana B"}
        </Badge>
      </div>

      <div className="mt-4 grid items-center gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(260px,420px)_minmax(0,1fr)]">
        <div className="text-left lg:text-right">
          <p className={cn("text-2xl font-semibold", winner === "left" && "text-slate-700 dark:text-white")}>
            {leftDisplay}
          </p>
        </div>

        <div className="relative h-12 overflow-hidden rounded-full border border-border/70 bg-card/95">
          <div className="absolute inset-y-0 left-1/2 w-px bg-foreground/14" />
          <div
            className="absolute inset-y-2 right-1/2 rounded-l-full bg-slate-900/8 dark:bg-slate-900/125 transition-all"
            style={{ width: `${Math.max((leftShare / 100) * 50, leftValue === null ? 0 : 6)}%` }}
          />
          <div
            className="absolute inset-y-2 left-1/2 rounded-r-full bg-accent transition-all"
            style={{ width: `${Math.max((rightShare / 100) * 50, rightValue === null ? 0 : 6)}%` }}
          />
        </div>

        <div className="text-left">
          <p className={cn("text-2xl font-semibold", winner === "right" && "text-accent-foreground")}>
            {rightDisplay}
          </p>
        </div>
      </div>
    </div>
  );
}

export function ComparisonExplorer({ initialData }: { initialData: ComparisonDashboardData }) {
  const [filters, setFilters] = useState(initialData.filters);
  const deferredFilters = useDeferredValue(filters);
  const [leftCycleKey, setLeftCycleKey] = useState(initialData.leftCycleKey);
  const [rightCycleKey, setRightCycleKey] = useState(initialData.rightCycleKey);
  const optionsQuery = useMemo(() => buildOptionsQuery(deferredFilters), [deferredFilters]);
  const initialOptionsQuery = useMemo(() => buildOptionsQuery(initialData.filters), [initialData.filters]);
  const pairQuery = useMemo(() => {
    if (!leftCycleKey || !rightCycleKey) {
      return null;
    }

    const params = new URLSearchParams();
    params.set("left", leftCycleKey);
    params.set("right", rightCycleKey);
    return params.toString();
  }, [leftCycleKey, rightCycleKey]);
  const initialPairQuery = useMemo(() => {
    if (!initialData.leftCycleKey || !initialData.rightCycleKey) {
      return null;
    }

    const params = new URLSearchParams();
    params.set("left", initialData.leftCycleKey);
    params.set("right", initialData.rightCycleKey);
    return params.toString();
  }, [initialData.leftCycleKey, initialData.rightCycleKey]);
  const {
    data: optionsData,
    error: optionsError,
    isValidating: optionsLoading,
    mutate: mutateOptions,
  } = useSWR(
    `/api/comparacion/options?${optionsQuery}`,
    comparisonOptionsFetcher,
    {
      fallbackData: optionsQuery === initialOptionsQuery ? initialData.options : undefined,
      keepPreviousData: true,
      revalidateOnFocus: false,
      dedupingInterval: 15000,
    },
  );
  const {
    data: comparisonData,
    error: comparisonError,
    isLoading: comparisonLoading,
  } = useSWR(
    pairQuery ? `/api/comparacion/pair?${pairQuery}` : null,
    comparisonPairFetcher,
    {
      fallbackData: pairQuery && pairQuery === initialPairQuery ? initialData.comparison ?? undefined : undefined,
      revalidateOnFocus: false,
    },
  );
  useEffect(() => { if (optionsError) toast.error(optionsError.message || "Error al cargar datos"); }, [optionsError]);
  useEffect(() => { if (comparisonError) toast.error(comparisonError.message || "Error al cargar datos"); }, [comparisonError]);

  const options = optionsData ?? initialData.options;
  const comparison = pairQuery
    ? comparisonData ?? (pairQuery === initialPairQuery ? initialData.comparison : null)
    : null;

  const leftCycle = options.find((option) => option.cycleKey === leftCycleKey)
    ?? comparison?.left
    ?? null;
  const rightCycle = options.find((option) => option.cycleKey === rightCycleKey)
    ?? comparison?.right
    ?? null;

  function updateFilter<Key extends keyof ComparisonSearchFilters>(
    key: Key,
    value: ComparisonSearchFilters[Key],
  ) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function chooseCycle(side: "left" | "right", cycleKey: string) {
    if (side === "left") {
      setLeftCycleKey(cycleKey);
      return;
    }

    setRightCycleKey(cycleKey);
  }

  return (
    <div className="space-y-4">
      <SectionPageShell
        eyebrow="Indicadores / Producción / Campo"
        title="Comparación"
        subtitle="Selecciona dos ciclos reales para enfrentarlos metrica a metrica y visualizar sus diferencias operativas."
        icon={<Swords className="size-6" aria-hidden="true" />}
        actions={
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="rounded-full px-3 py-1">
              {options.length} opciones visibles
            </Badge>
            <Badge variant="outline" className="rounded-full px-3 py-1">
              {comparison?.metrics.length ?? 0} metricas
            </Badge>
          </div>
        }
      >
        <FilterPanel>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="comparison-q">Buscar</Label>
              <SearchInput
                id="comparison-q"
                value={filters.q}
                onChange={(value) => updateFilter("q", value)}
                placeholder="Area, bloque, ciclo, variedad..."
              />
            </div>

            <MultiSelectField
              id="comparison-area"
              label="Áreas"
              value={filters.area}
              options={initialData.filterOptions.areas}
              onChange={(value) => updateFilter("area", value)}
            />

            <div className="space-y-2">
              <Label htmlFor="comparison-block">Bloque</Label>
              <Input
                id="comparison-block"
                value={filters.block}
                onChange={(event) => updateFilter("block", event.target.value)}
                placeholder="Ej. 329"
              />
            </div>

            <MultiSelectField
              id="comparison-variety"
              label="Variedades"
              value={filters.variety}
              options={initialData.filterOptions.varieties}
              onChange={(value) => updateFilter("variety", value)}
            />
          </div>
        </FilterPanel>
      </SectionPageShell>

      <Card className="starter-panel overflow-hidden border-border/70 bg-card/82">
        <CardContent className="grid gap-4 p-6 xl:grid-cols-[1.2fr_auto_1.2fr]">
          <ComparisonSlotCard label="Ciclo A" cycle={leftCycle} tone="left" />
          <div className="flex items-center justify-center">
            <div className="rounded-full border border-border/70 bg-background/90 px-4 py-4 text-center">
              <Swords className="mx-auto size-6 text-slate-700 dark:text-white" aria-hidden="true" />
              <p className="mt-2 text-xs uppercase tracking-[0.28em] text-muted-foreground">VS</p>
            </div>
          </div>
          <ComparisonSlotCard label="Ciclo B" cycle={rightCycle} tone="right" />
        </CardContent>
      </Card>

      <Card className="starter-panel border-border/70 bg-card/82">
        <CardHeader className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-2">
              <Badge variant="outline" className="rounded-full px-3 py-1">
                Comparacion de ciclos reales
              </Badge>
              <CardTitle className="text-2xl">Seleccion de duelo</CardTitle>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {optionsLoading ? (
            <div className="text-sm text-muted-foreground">Buscando ciclos...</div>
          ) : null}
          {optionsError ? <div className="flex items-center gap-3 text-sm text-destructive">{optionsError.message}<button type="button" className="underline underline-offset-2 hover:text-destructive/80" onClick={() => mutateOptions()}>Reintentar</button></div> : null}

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {options.map((option) => {
              const selectedLeft = leftCycleKey === option.cycleKey;
              const selectedRight = rightCycleKey === option.cycleKey;

              return (
                <div
                  key={`${option.cycleKey}-${option.block}-${option.spDate ?? ""}-${option.harvestStartDate ?? ""}`}
                  className={cn(
                    "rounded-[24px] border border-border/70 bg-background/72 p-4",
                    selectedLeft && "border-slate-700/30",
                    selectedRight && "border-accent/30",
                  )}
                >
                  <div className="flex flex-wrap gap-2">
                    <Badge className="rounded-full px-3 py-1">{option.cycleKey}</Badge>
                    {option.block ? (
                      <Badge variant="outline" className="rounded-full px-3 py-1">
                        Bloque {option.block}
                      </Badge>
                    ) : null}
                  </div>
                  <div className="mt-3">
                    <p className="text-lg font-semibold">{option.area || "Sin area"}</p>
                    <p className="text-sm text-muted-foreground">
                      {option.variety || "Sin variedad"} / {option.spType || "Sin SP"}
                    </p>
                  </div>
                  <div className="mt-4 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                    <p>SP: {formatDate(option.spDate)}</p>
                    <p>Inicio cos: {formatDate(option.harvestStartDate)}</p>
                    <p>Fin cos: {formatDate(option.harvestEndDate)}</p>
                    <p>Tallos: {formatInteger(option.totalStems)}</p>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      variant={selectedLeft ? "secondary" : "outline"}
                      className="rounded-xl"
                      onClick={() => chooseCycle("left", option.cycleKey)}
                    >
                      Competir A
                    </Button>
                    <Button
                      variant={selectedRight ? "secondary" : "outline"}
                      className="rounded-xl"
                      onClick={() => chooseCycle("right", option.cycleKey)}
                    >
                      Competir B
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {comparisonLoading ? (
        <div className="rounded-[24px] border border-border/70 bg-card/82 px-5 py-4 text-sm text-muted-foreground">
          Actualizando comparacion...
        </div>
      ) : null}

      {comparisonError ? (
        <div className="rounded-[24px] border border-destructive/30 bg-destructive/8 px-5 py-4 text-sm text-destructive">
          {comparisonError.message}
        </div>
      ) : null}

      {comparison?.left && comparison?.right ? (
        <>
          {comparison.metrics.length === 0 ? <EmptyState label="No hay métricas disponibles para la comparación." /> :
          (<>
          <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
            <Card className="starter-panel border-border/70 bg-card/82">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-slate-900/10 dark:bg-slate-900/20 p-3 text-slate-700 dark:text-white">
                    <Trophy className="size-5" aria-hidden="true" />
                  </div>
                  <div>
                    <CardTitle>Radar comparativo</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Magnitud relativa entre ambos ciclos para las metricas seleccionadas.
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ComparisonRadarPanel
                  data={comparison.radar}
                  leftLabel={comparison.left.cycleKey}
                  rightLabel={comparison.right.cycleKey}
                />
              </CardContent>
            </Card>

            <Card className="starter-panel border-border/70 bg-card/82">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-slate-900/10 dark:bg-slate-900/20 p-3 text-slate-700 dark:text-white">
                    <ArrowLeftRight className="size-5" aria-hidden="true" />
                  </div>
                  <div>
                    <CardTitle>Lectura rapida</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Perfil del duelo con las cifras clave para decidir cual ciclo va mejor.
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-[24px] border border-slate-700/20 bg-slate-900/7 dark:bg-slate-900/10 p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Ciclo A</p>
                  <p className="mt-2 text-lg font-semibold">{comparison.left.cycleKey}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {comparison.left.area || "Sin area"} / Bloque {comparison.left.block || "-"}
                  </p>
                </div>
                <div className="rounded-[24px] border border-accent/20 bg-accent/8 p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Ciclo B</p>
                  <p className="mt-2 text-lg font-semibold">{comparison.right.cycleKey}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {comparison.right.area || "Sin area"} / Bloque {comparison.right.block || "-"}
                  </p>
                </div>
                <div className="rounded-[24px] border border-border/70 bg-background/72 p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Tallos</p>
                  <p className="mt-2 text-lg font-semibold">{formatInteger(comparison.left.totalStems)}</p>
                  <p className="mt-1 text-sm text-muted-foreground">Ciclo A</p>
                </div>
                <div className="rounded-[24px] border border-border/70 bg-background/72 p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Tallos</p>
                  <p className="mt-2 text-lg font-semibold">{formatInteger(comparison.right.totalStems)}</p>
                  <p className="mt-1 text-sm text-muted-foreground">Ciclo B</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="starter-panel border-border/70 bg-card/82">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-slate-900/10 dark:bg-slate-900/20 p-3 text-slate-700 dark:text-white">
                  <ShieldAlert className="size-5" aria-hidden="true" />
                </div>
                <div>
                  <CardTitle>Duelos por metrica</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    La barra central crece del lado que sale mejor segun el criterio operativo de cada metrica.
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {comparison.metrics.map((metric) => {
                const { key, ...metricProps } = metric;
                return <MetricBattleRow key={key} {...metricProps} />;
              })}
            </CardContent>
          </Card>
          </>
          )}
        </>
      ) : (
        <Card className="starter-panel border-border/70 bg-card/82">
          <CardContent className="px-6 py-8 text-sm text-muted-foreground">
            Elige dos ciclos para activar la comparacion.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
