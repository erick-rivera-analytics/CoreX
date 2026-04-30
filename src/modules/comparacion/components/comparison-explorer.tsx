"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { ArrowLeftRight, LoaderCircle, ShieldAlert, Swords, Trophy } from "lucide-react";
import useSWR from "swr";
import { toast } from "sonner";

import { ComparisonRadarPanel } from "@/modules/comparacion/components/comparison-radar-panel";
import { formatDate, formatInteger } from "@/shared/lib/format";
import { SectionPageShell } from "@/shared/layout/section-page-shell";
import { Badge } from "@/shared/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
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
  ComparisonFilterOptions,
  ComparisonPairPayload,
} from "@/lib/comparacion";

// ─── Types ────────────────────────────────────────────────────────────────────

type PanelFilters = { q: string; area: string; block: string };
const EMPTY_PANEL_FILTERS: PanelFilters = { q: "", area: "all", block: "" };

// ─── Query builders ───────────────────────────────────────────────────────────

function buildPanelQuery(f: PanelFilters): string {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.area !== "all") p.set("area", f.area);
  if (f.block) p.set("block", f.block);
  p.set("limit", "30");
  return p.toString();
}

function buildPairQuery(left: string | null, right: string | null): string | null {
  if (!left || !right) return null;
  const p = new URLSearchParams();
  p.set("left", left);
  p.set("right", right);
  return p.toString();
}

// ─── Fetchers ─────────────────────────────────────────────────────────────────

const optionsFetcher = (url: string) =>
  fetchJson<ComparisonCycleOption[]>(url, "No se pudo cargar la búsqueda de ciclos.");

const pairFetcher = (url: string) =>
  fetchJson<ComparisonPairPayload>(url, "No se pudo cargar la comparación.");

// ─── ComparisonSlotCard ───────────────────────────────────────────────────────

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
          ? "border-blue-500/25 bg-blue-500/8"
          : "border-amber-500/25 bg-amber-500/8",
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
            <p className="text-xl font-semibold">{cycle.area || "Sin área"}</p>
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
        <p className="mt-4 text-sm text-muted-foreground">Selecciona un ciclo para comparar.</p>
      )}
    </div>
  );
}

// ─── MetricBattleRow ──────────────────────────────────────────────────────────

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
              ? "Sin criterio operativo"
              : leftValue === rightValue
                ? "Empate operativo"
                : winner === "left"
                  ? "Ventaja A"
                  : "Ventaja B"}
          </p>
        </div>
        <Badge
          variant="outline"
          className={cn(
            "rounded-full px-3 py-1",
            winner === "left" && "border-blue-500/40 bg-blue-500/10 text-blue-600 dark:text-blue-400",
            winner === "right" && "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
          )}
        >
          {winner === "neutral" ? "Sin criterio" : winner === "tie" ? "Empate" : winner === "left" ? "Gana A" : "Gana B"}
        </Badge>
      </div>

      <div className="mt-4 grid items-center gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(260px,420px)_minmax(0,1fr)]">
        <div className="text-left lg:text-right">
          <p className={cn("text-2xl font-semibold", winner === "left" && "text-blue-600 dark:text-blue-400")}>
            {leftDisplay}
          </p>
        </div>

        <div className="relative h-12 overflow-hidden rounded-full border border-border/70 bg-card/95">
          <div className="absolute inset-y-0 left-1/2 w-px bg-foreground/14" />
          <div
            className="absolute inset-y-2 right-1/2 rounded-l-full bg-blue-500/30 transition-all"
            style={{ width: `${Math.max((leftShare / 100) * 50, leftValue === null ? 0 : 6)}%` }}
          />
          <div
            className="absolute inset-y-2 left-1/2 rounded-r-full bg-amber-500/40 transition-all"
            style={{ width: `${Math.max((rightShare / 100) * 50, rightValue === null ? 0 : 6)}%` }}
          />
        </div>

        <div className="text-left">
          <p className={cn("text-2xl font-semibold", winner === "right" && "text-amber-600 dark:text-amber-400")}>
            {rightDisplay}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── CycleSelectorPanel ───────────────────────────────────────────────────────

function CycleSelectorPanel({
  label,
  tone,
  selectedKey,
  onSelect,
  filterOptions,
  initialOptions,
}: {
  label: string;
  tone: "left" | "right";
  selectedKey: string | null;
  onSelect: (option: ComparisonCycleOption) => void;
  filterOptions: ComparisonFilterOptions;
  initialOptions: ComparisonCycleOption[];
}) {
  const [panelFilters, setPanelFilters] = useState<PanelFilters>(EMPTY_PANEL_FILTERS);
  const deferred = useDeferredValue(panelFilters);
  const query = useMemo(() => buildPanelQuery(deferred), [deferred]);

  const { data, isValidating } = useSWR(
    `/api/comparacion/options?${query}`,
    optionsFetcher,
    {
      fallbackData: initialOptions,
      keepPreviousData: true,
      revalidateOnFocus: false,
      dedupingInterval: 15000,
      onError: (err) => toast.error(err?.message || "Error al cargar ciclos"),
    },
  );

  const options = data ?? initialOptions;

  function update<K extends keyof PanelFilters>(key: K, value: PanelFilters[K]) {
    setPanelFilters((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <p
        className={cn(
          "text-xs font-bold uppercase tracking-[0.28em]",
          tone === "left" ? "text-blue-600 dark:text-blue-400" : "text-amber-600 dark:text-amber-400",
        )}
      >
        {label}
      </p>

      <div className="grid gap-2 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Buscar</Label>
          <SearchInput
            id={`panel-q-${tone}`}
            value={panelFilters.q}
            onChange={(v) => update("q", v)}
            placeholder="Ciclo, bloque, variedad..."
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Bloque</Label>
          <Input
            id={`panel-block-${tone}`}
            value={panelFilters.block}
            onChange={(e) => update("block", e.target.value)}
            placeholder="Ej. 329"
          />
        </div>
        <div className="sm:col-span-2">
          <MultiSelectField
            id={`panel-area-${tone}`}
            label="Área"
            value={panelFilters.area}
            options={filterOptions.areas}
            onChange={(v) => update("area", v)}
            emptyLabel="Todas las áreas"
          />
        </div>
      </div>

      {isValidating ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
          Buscando...
        </div>
      ) : null}

      <div className="h-[420px] overflow-y-auto rounded-[20px] border border-border/70 bg-background/50 p-2">
        {options.length === 0 ? (
          <EmptyState label="Sin resultados." />
        ) : (
          <div className="space-y-2">
            {options.map((opt) => {
              const isSelected = opt.cycleKey === selectedKey;
              return (
                <button
                  key={`${opt.cycleKey}-${opt.block}-${opt.spDate ?? ""}`}
                  type="button"
                  onClick={() => onSelect(opt)}
                  className={cn(
                    "w-full rounded-[18px] border border-border/70 bg-background/72 px-3 py-2.5 text-left transition-colors hover:bg-background/95",
                    isSelected && tone === "left" && "border-blue-500/40 bg-blue-500/8",
                    isSelected && tone === "right" && "border-amber-500/40 bg-amber-500/8",
                  )}
                >
                  <div className="mb-1 flex flex-wrap items-center gap-1">
                    <Badge className="rounded-full px-2 py-0.5 text-[10px]">{opt.cycleKey}</Badge>
                    {opt.block ? (
                      <Badge variant="outline" className="rounded-full px-2 py-0.5 text-[10px]">
                        Bl. {opt.block}
                      </Badge>
                    ) : null}
                    {isSelected ? (
                      <Badge
                        variant="secondary"
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px]",
                          tone === "left" ? "bg-blue-500/15 text-blue-600 dark:text-blue-400" : "bg-amber-500/15 text-amber-600 dark:text-amber-400",
                        )}
                      >
                        ✓ Seleccionado
                      </Badge>
                    ) : null}
                  </div>
                  <p className="truncate text-sm font-semibold">{opt.area || "Sin área"}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {opt.variety || "Sin variedad"} / {opt.spType || "—"}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-x-3 text-[10px] text-muted-foreground">
                    <span>SP: {formatDate(opt.spDate)}</span>
                    <span>Cos: {formatDate(opt.harvestStartDate)}</span>
                    <span>Tallos: {formatInteger(opt.totalStems)}</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── ComparisonExplorer ───────────────────────────────────────────────────────

export function ComparisonExplorer({ initialData }: { initialData: ComparisonDashboardData }) {
  const [leftCycleKey,  setLeftCycleKey]  = useState(initialData.leftCycleKey);
  const [rightCycleKey, setRightCycleKey] = useState(initialData.rightCycleKey);
  const [leftCycleInfo,  setLeftCycleInfo]  = useState<ComparisonCycleOption | null>(
    () => initialData.options.find((o) => o.cycleKey === initialData.leftCycleKey)  ?? null,
  );
  const [rightCycleInfo, setRightCycleInfo] = useState<ComparisonCycleOption | null>(
    () => initialData.options.find((o) => o.cycleKey === initialData.rightCycleKey) ?? null,
  );

  const initialPairQuery = useMemo(
    () => buildPairQuery(initialData.leftCycleKey, initialData.rightCycleKey),
    [initialData.leftCycleKey, initialData.rightCycleKey],
  );
  const pairQuery = useMemo(
    () => buildPairQuery(leftCycleKey, rightCycleKey),
    [leftCycleKey, rightCycleKey],
  );

  const {
    data: comparisonData,
    isLoading: comparisonLoading,
    error: comparisonError,
  } = useSWR(
    pairQuery ? `/api/comparacion/pair?${pairQuery}` : null,
    pairFetcher,
    {
      fallbackData: pairQuery && pairQuery === initialPairQuery
        ? (initialData.comparison ?? undefined)
        : undefined,
      revalidateOnFocus: false,
      onError: (err) => toast.error(err?.message || "Error al cargar comparación"),
    },
  );

  const comparison = pairQuery
    ? comparisonData ?? (pairQuery === initialPairQuery ? initialData.comparison : null)
    : null;

  function handleSelectLeft(option: ComparisonCycleOption) {
    setLeftCycleKey(option.cycleKey);
    setLeftCycleInfo(option);
  }

  function handleSelectRight(option: ComparisonCycleOption) {
    setRightCycleKey(option.cycleKey);
    setRightCycleInfo(option);
  }

  const leftDisplay  = (comparison?.left  ?? leftCycleInfo)  as ComparisonCycleOption | null;
  const rightDisplay = (comparison?.right ?? rightCycleInfo) as ComparisonCycleOption | null;

  const leftWins  = comparison?.metrics.filter((m) => m.winner === "left").length  ?? 0;
  const rightWins = comparison?.metrics.filter((m) => m.winner === "right").length ?? 0;
  const ties      = comparison?.metrics.filter((m) => m.winner === "tie" || m.winner === "neutral").length ?? 0;

  return (
    <div className="space-y-4">
      <SectionPageShell
        eyebrow="Indicadores / Producción / Campo"
        title="Comparación"
        subtitle="Selecciona un ciclo por cada lado para enfrentarlos métrica a métrica y visualizar sus diferencias operativas."
        icon={<Swords className="size-6" aria-hidden="true" />}
      >
        <></>
      </SectionPageShell>

      {/* Selector dual ─────────────────────────────────────────────────────── */}
      <Card className="starter-panel overflow-hidden border-border/70 bg-card/82">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-slate-900/10 dark:bg-slate-900/20 p-2.5 text-slate-700 dark:text-white">
              <Swords className="size-4" aria-hidden="true" />
            </div>
            <div>
              <CardTitle>Selección de ciclos</CardTitle>
              <p className="text-sm text-muted-foreground">
                Usa los buscadores para filtrar y haz clic en un ciclo para asignarlo al duelo.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-2">
          <div className="grid gap-6 xl:grid-cols-[1fr_auto_1fr]">
            <CycleSelectorPanel
              label="Ciclo A"
              tone="left"
              selectedKey={leftCycleKey}
              onSelect={handleSelectLeft}
              filterOptions={initialData.filterOptions}
              initialOptions={initialData.options}
            />

            <div className="flex items-center justify-center py-2 xl:py-0">
              <div className="rounded-full border border-border/70 bg-background/90 px-4 py-4 text-center">
                <Swords className="mx-auto size-5 text-slate-700 dark:text-white" aria-hidden="true" />
                <p className="mt-1.5 text-xs uppercase tracking-[0.28em] text-muted-foreground">VS</p>
              </div>
            </div>

            <CycleSelectorPanel
              label="Ciclo B"
              tone="right"
              selectedKey={rightCycleKey}
              onSelect={handleSelectRight}
              filterOptions={initialData.filterOptions}
              initialOptions={initialData.options}
            />
          </div>
        </CardContent>
      </Card>

      {/* Tarjetas del duelo activo ──────────────────────────────────────────── */}
      {(leftDisplay || rightDisplay) ? (
        <Card className="starter-panel overflow-hidden border-border/70 bg-card/82">
          <CardContent className="grid gap-4 p-6 xl:grid-cols-[1.2fr_auto_1.2fr]">
            <ComparisonSlotCard label="Ciclo A" cycle={leftDisplay} tone="left" />
            <div className="flex items-center justify-center">
              <div className="rounded-full border border-border/70 bg-background/90 px-4 py-4 text-center">
                <Swords className="mx-auto size-6 text-slate-700 dark:text-white" aria-hidden="true" />
                <p className="mt-2 text-xs uppercase tracking-[0.28em] text-muted-foreground">VS</p>
              </div>
            </div>
            <ComparisonSlotCard label="Ciclo B" cycle={rightDisplay} tone="right" />
          </CardContent>
        </Card>
      ) : null}

      {/* Estado de carga / error ────────────────────────────────────────────── */}
      {comparisonLoading ? (
        <div className="flex items-center gap-3 rounded-[24px] border border-border/70 bg-card/82 px-5 py-4 text-sm text-muted-foreground">
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          Calculando comparación…
        </div>
      ) : null}

      {comparisonError ? (
        <div className="rounded-[24px] border border-destructive/30 bg-destructive/8 px-5 py-4 text-sm text-destructive">
          {comparisonError.message}
        </div>
      ) : null}

      {/* Resultados ─────────────────────────────────────────────────────────── */}
      {comparison?.left && comparison?.right ? (
        comparison.metrics.length === 0 ? (
          <EmptyState label="No hay métricas disponibles para la comparación." />
        ) : (
          <>
            <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
              {/* Radar */}
              <Card className="starter-panel border-border/70 bg-card/82">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="rounded-full bg-slate-900/10 dark:bg-slate-900/20 p-3 text-slate-700 dark:text-white">
                      <Trophy className="size-5" aria-hidden="true" />
                    </div>
                    <div>
                      <CardTitle>Radar comparativo</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        Magnitud relativa entre ambos ciclos para las métricas clave.
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

              {/* Marcador */}
              <Card className="starter-panel border-border/70 bg-card/82">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="rounded-full bg-slate-900/10 dark:bg-slate-900/20 p-3 text-slate-700 dark:text-white">
                      <ArrowLeftRight className="size-5" aria-hidden="true" />
                    </div>
                    <div>
                      <CardTitle>Marcador del duelo</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        Resumen de victorias por métrica.
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Score banner */}
                  <div className="grid grid-cols-3 divide-x divide-border/70 rounded-[20px] border border-border/70 bg-background/72 text-center">
                    <div className="px-4 py-5">
                      <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Ciclo A gana</p>
                      <p className="mt-2 text-4xl font-bold text-blue-600 dark:text-blue-400">{leftWins}</p>
                    </div>
                    <div className="px-4 py-5">
                      <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Empates</p>
                      <p className="mt-2 text-4xl font-bold text-muted-foreground">{ties}</p>
                    </div>
                    <div className="px-4 py-5">
                      <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Ciclo B gana</p>
                      <p className="mt-2 text-4xl font-bold text-amber-600 dark:text-amber-400">{rightWins}</p>
                    </div>
                  </div>

                  {/* Cycle summaries */}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[20px] border border-blue-500/20 bg-blue-500/8 p-4">
                      <p className="text-xs uppercase tracking-[0.24em] text-blue-600/70 dark:text-blue-400/70">Ciclo A</p>
                      <p className="mt-2 text-lg font-semibold">{comparison.left.cycleKey}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {comparison.left.area || "Sin área"} · Bloque {comparison.left.block || "—"}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {comparison.left.variety || "Sin variedad"} / {comparison.left.spType || "—"}
                      </p>
                    </div>
                    <div className="rounded-[20px] border border-amber-500/20 bg-amber-500/8 p-4">
                      <p className="text-xs uppercase tracking-[0.24em] text-amber-600/70 dark:text-amber-400/70">Ciclo B</p>
                      <p className="mt-2 text-lg font-semibold">{comparison.right.cycleKey}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {comparison.right.area || "Sin área"} · Bloque {comparison.right.block || "—"}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {comparison.right.variety || "Sin variedad"} / {comparison.right.spType || "—"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Duelos por métrica */}
            <Card className="starter-panel border-border/70 bg-card/82">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-slate-900/10 dark:bg-slate-900/20 p-3 text-slate-700 dark:text-white">
                    <ShieldAlert className="size-5" aria-hidden="true" />
                  </div>
                  <div>
                    <CardTitle>Duelos por métrica</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      La barra crece del lado que sale mejor según el criterio operativo de cada métrica.
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
        )
      ) : !comparisonLoading ? (
        <Card className="starter-panel border-border/70 bg-card/82">
          <CardContent className="px-6 py-8 text-sm text-muted-foreground">
            {leftCycleKey && rightCycleKey && leftCycleKey === rightCycleKey
              ? "Elige dos ciclos distintos para activar la comparación."
              : "Elige un ciclo en cada panel para activar la comparación."}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
