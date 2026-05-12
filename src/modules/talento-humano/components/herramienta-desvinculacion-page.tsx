"use client";

import { useMemo, useState } from "react";
import { Activity, X } from "lucide-react";
import useSWR from "swr";

import { fetchJson } from "@/lib/fetch-json";
import { encodeMultiSelectValue } from "@/lib/multi-select";
import type {
  DesvinculacionToolData,
  DesvinculacionToolFilters,
} from "@/lib/talento-humano-herramienta-desvinculacion";
import {
  RULES_CONSTANTS,
  estadoMeta,
  type DesvinculacionEstado,
} from "@/lib/talento-humano-desvinculacion-rules";
import { PersonEvolutionChart } from "@/modules/talento-humano/components/herramienta-desvinculacion-person-chart";
import { DesvinculacionDetailTable } from "@/modules/talento-humano/components/herramienta-desvinculacion-table";
import { EmptyState } from "@/shared/data-display/empty-state";
import { MetricTile } from "@/shared/data-display/metric-tile";
import { MultiSelectField, WeekField } from "@/shared/filters";
import { FilterPanel, KpiGrid } from "@/shared/layout/filter-panel";
import { SectionPageShell } from "@/shared/layout/section-page-shell";
import { formatInteger, formatIsoWeekLabel } from "@/shared/lib/format";
import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";

function desvinculacionFetcher(url: string) {
  return fetchJson<DesvinculacionToolData>(url, "No se pudo cargar la herramienta de desvinculación.");
}

function buildQuery(filters: DesvinculacionToolFilters): string {
  const params = new URLSearchParams();
  if (filters.weekId) params.set("weekId", filters.weekId);
  if (filters.area && filters.area !== "all") params.set("area", filters.area);
  if (filters.jobClassification && filters.jobClassification !== "all") {
    params.set("jobClassification", filters.jobClassification);
  }
  if (filters.estado && filters.estado !== "all") params.set("estado", filters.estado);
  if (filters.q) params.set("q", filters.q);
  return params.toString();
}

const KPI_BUCKETS: Array<{
  key: string;
  label: string;
  emoji: string;
  accent: "danger" | "warning" | "default" | "success";
  states: DesvinculacionEstado[];
}> = [
  {
    key: "salida",
    label: "Candidatos a salida",
    emoji: "🔴",
    accent: "danger",
    states: ["salida"],
  },
  {
    key: "advertencia",
    label: "Advertencia",
    emoji: "🟠",
    accent: "warning",
    states: ["advertencia", "advertencia_nuevo", "bajo_sin_tendencia"],
  },
  {
    key: "caida",
    label: "Cumple con caída",
    emoji: "🔵",
    accent: "default",
    states: ["cumple_con_caida"],
  },
  {
    key: "ok",
    label: "Sin alerta",
    emoji: "🟢",
    accent: "success",
    states: ["ok", "en_observacion_nuevo", "sin_senal_actual"],
  },
];

const ESTADO_OPTIONS: DesvinculacionEstado[] = [
  "salida",
  "advertencia",
  "bajo_sin_tendencia",
  "advertencia_nuevo",
  "cumple_con_caida",
  "en_observacion_nuevo",
  "ok",
  "sin_senal_actual",
];

export function HerramientaDesvinculacionPage({ initialData }: { initialData: DesvinculacionToolData }) {
  const [filters, setFilters] = useState<DesvinculacionToolFilters>(initialData.filters);
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);

  const query = buildQuery(filters);
  const url = `/api/talento-humano/herramienta-desvinculacion?${query}`;

  const { data, error, isValidating, mutate } = useSWR<DesvinculacionToolData>(url, desvinculacionFetcher, {
    fallbackData: initialData,
    revalidateOnFocus: false,
    keepPreviousData: true,
    dedupingInterval: 30_000,
  });

  const payload = data ?? initialData;
  const rows = payload.rows;
  const summary = payload.summary;

  const optionsAreas = useMemo(() => payload.options?.areas ?? [], [payload.options?.areas]);
  const optionsClassifications = useMemo(
    () => payload.options?.jobClassifications ?? [],
    [payload.options?.jobClassifications],
  );
  const optionsWeeks = useMemo(
    () => payload.options?.weeks ?? [],
    [payload.options?.weeks],
  );

  const updateFilter = <K extends keyof DesvinculacionToolFilters>(key: K, value: DesvinculacionToolFilters[K]) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const handleReset = () => {
    setFilters({ ...initialData.filters, estado: "all" });
    setSelectedPersonId(null);
  };

  const handleSelectPerson = (personId: string) => {
    setSelectedPersonId((current) => (current === personId ? null : personId));
  };

  const handleKpiClick = (bucketStates: DesvinculacionEstado[]) => {
    const encoded = encodeMultiSelectValue(bucketStates);
    setFilters((current) => ({
      ...current,
      estado: current.estado === encoded ? "all" : encoded,
    }));
  };

  const selectedRow = useMemo(
    () => rows.find((row) => row.personId === selectedPersonId) ?? null,
    [rows, selectedPersonId],
  );

  const weekOptions = useMemo(
    () => optionsWeeks.map((week) => ({ value: week, label: formatIsoWeekLabel(week) })),
    [optionsWeeks],
  );

  const areaOptions = useMemo(() => optionsAreas.map((entry) => entry.id), [optionsAreas]);
  const areaLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const entry of optionsAreas) {
      map.set(entry.id, entry.name);
    }
    return map;
  }, [optionsAreas]);

  return (
    <div className="space-y-4">
      <SectionPageShell
        eyebrow="Analítica / Talento Humano / Explorador"
        title="Herramienta de Desvinculación"
        subtitle={`Rendimiento por colaborador activo en la semana seleccionada. Estado calculado sobre ventana de ${RULES_CONSTANTS.WINDOW_WEEKS} semanas con Mann-Kendall + Theil-Sen.`}
        icon={<Activity className="size-6" aria-hidden="true" />}
      >
        <FilterPanel>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <WeekField
              id="hd-week"
              label="Semana"
              value={filters.weekId}
              options={weekOptions}
              onChange={(value) => updateFilter("weekId", value)}
            />
            <MultiSelectField
              id="hd-area"
              label="Área"
              value={filters.area}
              options={areaOptions}
              displayValue={(id) => areaLabelMap.get(id) ?? id}
              onChange={(value) => updateFilter("area", value)}
            />
            <MultiSelectField
              id="hd-clasif"
              label="Clasificación"
              value={filters.jobClassification}
              options={optionsClassifications}
              onChange={(value) => updateFilter("jobClassification", value)}
            />
            <MultiSelectField
              id="hd-estado"
              label="Estado"
              value={filters.estado}
              options={ESTADO_OPTIONS}
              displayValue={(value) => {
                const meta = estadoMeta(value as DesvinculacionEstado);
                return `${meta.emoji} ${meta.label}`;
              }}
              onChange={(value) => updateFilter("estado", value)}
            />
            <div className="flex items-end">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleReset}
                aria-label="Restablecer filtros"
              >
                <X className="size-4" aria-hidden="true" />
                Restablecer
              </Button>
            </div>
          </div>

          <KpiGrid columns={4}>
            {KPI_BUCKETS.map((bucket) => {
              const count = bucket.states.reduce(
                (sum, estado) => sum + (summary.estadoCounts[estado] ?? 0),
                0,
              );
              const isActive = filters.estado === encodeMultiSelectValue(bucket.states);
              return (
                <button
                  key={bucket.key}
                  type="button"
                  onClick={() => handleKpiClick(bucket.states)}
                  aria-pressed={isActive}
                  className={`min-w-0 text-left transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 rounded-[16px] ${
                    isActive ? "ring-2 ring-primary/60" : ""
                  }`}
                >
                  <MetricTile
                    label={`${bucket.emoji} ${bucket.label}`}
                    value={formatInteger(count)}
                    hint={isActive ? "Filtrando por este grupo" : "Clic para filtrar"}
                    accent={bucket.accent}
                  />
                </button>
              );
            })}
          </KpiGrid>
        </FilterPanel>
      </SectionPageShell>

      {error ? (
        <Card className="border-amber-300/60 bg-amber-500/10">
          <CardContent className="px-4 py-3 text-sm">
            <p className="font-medium">No se pudo cargar la herramienta.</p>
            <p className="opacity-90">{error instanceof Error ? error.message : "Error desconocido."}</p>
            <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => mutate()}>
              Reintentar
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {selectedRow ? (
        <PersonEvolutionChart row={selectedRow} onClose={() => setSelectedPersonId(null)} />
      ) : null}

      {rows.length === 0 ? (
        <EmptyState label="Sin colaboradores que coincidan con los filtros seleccionados." />
      ) : (
        <DesvinculacionDetailTable
          rows={rows}
          weekId={summary.weekId}
          searchValue={filters.q}
          onSearchChange={(value) => updateFilter("q", value)}
          isValidating={isValidating}
          selectedPersonId={selectedPersonId}
          onSelectPerson={handleSelectPerson}
        />
      )}

      <details className="rounded-[20px] border border-border/60 bg-card/70 px-5 py-4 text-sm text-muted-foreground">
        <summary className="cursor-pointer font-medium text-foreground">
          ¿Cómo se calcula el estado? · Auditoría del cohorte filtrado
        </summary>
        <div className="mt-3 space-y-3 leading-relaxed">
          <div className="rounded-[14px] border border-border/50 bg-background/60 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-foreground">
              Auditoría del embudo
            </p>
            <ul className="grid gap-1 text-xs sm:grid-cols-2">
              <li><strong>{formatInteger(summary.audit.totalActive)}</strong> colaboradores activos en el filtro actual.</li>
              <li><strong>{formatInteger(summary.audit.withInsufficientValid)}</strong> con menos de {RULES_CONSTANTS.MIN_VALID_FOR_ESTABLISHED} semanas válidas (no establecidos).</li>
              <li><strong>{formatInteger(summary.audit.withLastWeekInvalid)}</strong> establecidos pero con la semana actual no-válida.</li>
              <li><strong>{formatInteger(summary.audit.withLowCumplimiento)}</strong> con cumplimiento &lt; {(RULES_CONSTANTS.CUMPLIMIENTO_LOW * 100).toFixed(0)}% en la semana actual.</li>
              <li><strong>{formatInteger(summary.audit.withDecliningTrend)}</strong> con tendencia decreciente (MK Z &lt; {RULES_CONSTANTS.MK_Z_DECLINE_THRESHOLD} o slope &lt; {RULES_CONSTANTS.SLOPE_DECLINE_THRESHOLD}).</li>
              <li><strong>{formatInteger(summary.audit.salidaCandidates)}</strong> candidatos finales a 🔴 Salida (intersección de filtros).</li>
            </ul>
          </div>
          <p>
            <strong>Semana válida</strong>: aquella en la que el colaborador trabajó al menos
            {" "}{RULES_CONSTANTS.MIN_HOURS_PRESENCIALES} horas presenciales y dedicó más del
            {" "}{(RULES_CONSTANTS.MIN_H_REND_RATIO * 100).toFixed(0)}% de su tiempo a actividades
            con rendimiento (no permisos, no horas normales). Las demás semanas se ignoran porque
            su cumplimiento no es representativo.
          </p>
          <p>
            <strong>Ventana de análisis</strong>: las últimas {RULES_CONSTANTS.WINDOW_WEEKS} semanas
            ISO contadas hasta la semana filtrada. Se necesitan al menos
            {" "}{RULES_CONSTANTS.MIN_VALID_FOR_ESTABLISHED} semanas válidas para emitir un veredicto
            &laquo;establecido&raquo;; entre {RULES_CONSTANTS.MIN_VALID_FOR_NEWBIE} y {RULES_CONSTANTS.MIN_VALID_FOR_ESTABLISHED - 1}
            {" "}se trata al colaborador como &laquo;nuevo&raquo;.
          </p>
          <p>
            <strong>Tendencia decreciente</strong>: doble señal (OR) sobre los cumplimientos de las
            semanas válidas: <code>Mann-Kendall Z &lt; {RULES_CONSTANTS.MK_Z_DECLINE_THRESHOLD}</code>
            {" "}(~ 70 % de confianza one-sided, captura consistencia direccional) o pendiente
            {" "}<code>Theil-Sen &lt; {RULES_CONSTANTS.SLOPE_DECLINE_THRESHOLD}</code> (≥ 0.5 pp/sem,
            captura magnitud aún con ruido).
          </p>
          <p>
            <strong>🔴 Salida</strong> requiere las TRES condiciones simultáneas: ≥ {RULES_CONSTANTS.MIN_VALID_FOR_ESTABLISHED} semanas válidas,
            la semana actual válida con cumplimiento &lt; {(RULES_CONSTANTS.CUMPLIMIENTO_LOW * 100).toFixed(0)}%, y tendencia decreciente.
            El doble filtro mantiene la rigurosidad incluso con MK relajado.
          </p>
          <p>
            <strong>🟢 Sin alerta</strong> agrupa OK, en observación nuevo y sin señal actual —
            todos los casos que no levantan ninguna bandera roja, naranja o azul.
          </p>
          <p className="rounded-[12px] border border-amber-300/60 bg-amber-500/10 px-3 py-2 text-amber-900 dark:text-amber-200">
            <strong>Esta es una herramienta de apoyo a la decisión.</strong> El veredicto final lo toma
            Talento Humano con la información completa del colaborador (contexto, historia, plan de
            mejora, conversaciones previas). Los estados son señales, no sentencias.
          </p>
        </div>
      </details>
    </div>
  );
}
