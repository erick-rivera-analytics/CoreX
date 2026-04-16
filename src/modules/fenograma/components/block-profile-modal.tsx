"use client";

import dynamic from "next/dynamic";
import { Fragment, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, ChevronRight, LineChart, LoaderCircle, Rows3, Sprout, X } from "lucide-react";
import useSWRImmutable from "swr/immutable";

import {
  DetailBadges as DetailBadgesPrimitive,
  HoursPerformanceDonut as HoursPerformanceDonutPrimitive,
  InfoField as InfoFieldPrimitive,
  MetricPill as MetricPillPrimitive,
} from "@/modules/fenograma/components/block-profile-primitives";
import {
  buildCycleHoursPersonRequest as buildCycleHoursPersonRequestHelper,
  buildCycleHoursRequest as buildCycleHoursRequestHelper,
  buildMortalityBadge as buildMortalityBadgeHelper,
  computeHorasCama as computeHorasCamaHelper,
  computeProgrammedPlantsAcrossCycles as computeProgrammedPlantsAcrossCyclesHelper,
  deriveCycleOperationalStatus as deriveCycleOperationalStatusHelper,
  deriveCyclePhase as deriveCyclePhaseHelper,
  formatProductivity as formatProductivityHelper,
  getBedSortValue as getBedSortValueHelper,
  getValveDisplayName as getValveDisplayNameHelper,
  getTrailingSegment as getTrailingSegmentHelper,
  resolveAggregatedOperationalStatus as resolveAggregatedOperationalStatusHelper,
  swrHoursFetcher as swrHoursFetcherHelper,
} from "@/modules/fenograma/components/block-profile-utils";
import { HarvestCurvePanel } from "@/modules/fenograma/components/harvest-curve-panel";
import { MortalityCurvePanel } from "@/modules/mortality/components/mortality-curve-panel";
import { PersonMedicalPanel } from "@/modules/fenograma/components/person-medical-panel";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import {
  formatDateSlash as formatDate,
  formatFlexibleNumber as formatNumber,
  formatPercent,
} from "@/shared/lib/format";

const ProcessViewerOverlay = dynamic(
  () =>
    import("@/modules/fenograma/components/process-viewer-overlay").then(
      (mod) => mod.ProcessViewerOverlay,
    ),
  { ssr: false },
);
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card";
import { cn } from "@/lib/utils";
import type {
  BedProfileCard,
  BedProfilePayload,
  BlockModalRow,
  CycleLaborHoursPayload,
  CycleLaborPersonDetailPayload,
  CycleLaborPersonSummary,
  CycleProfileBlockPayload,
  CycleProfileCard,
  HarvestCurvePayload,
  ValveProfilePayload,
  ValveProfilesByCyclePayload,
} from "@/lib/fenograma";
import type { MortalityCurvePayload } from "@/lib/mortality";
import type { SelectedMortalityCurveState } from "@/hooks/use-block-profile-modal";

// Wrapper with custom fallback behavior
function formatProductivity(value: number | null, fallback = "-") {
  return formatProductivityHelper(value, fallback);
}

function getTrailingSegment(value: string) {
  return getTrailingSegmentHelper(value);
}

function getValveDisplayName(valveName: string | null | undefined, valveId: string | null | undefined) {
  return getValveDisplayNameHelper(valveName, valveId);
}

/**
 * Deriva el estado operativo del ciclo desde isCurrent + isValid + status.
 * Mapping:
 * - isCurrent && isValid → Activo
 * - !isCurrent && isValid → Cerrado
 * - !isValid → Planificado
 * Si el status raw es "planned" o similar, se fuerza Planificado.
 */
function deriveCycleOperationalStatus(cycle: CycleProfileCard): string {
  return deriveCycleOperationalStatusHelper(cycle);
}

/**
 * Traduce el estado raw a Fase en español.
 * Mapping aplicado:
 * - active / activo / harvesting → Vegetativo (ciclo vivo pre-cosecha o en cosecha)
 * - closed / cerrado → Cerrado
 * - planned / planificado → Planificado
 * - harvest / cosecha → Cosecha
 * Si no coincide, se devuelve capitalizado.
 */
function deriveCyclePhase(cycle: CycleProfileCard): string {
  return deriveCyclePhaseHelper(cycle);
}

/** Camas 30 m² = superficie / 30. Retorna null si no hay superficie confiable. */
function computeCamas30(bedArea: number | null): number | null {
  if (bedArea === null || bedArea <= 0) {
    return null;
  }

  return Math.round((bedArea / 30) * 100) / 100;
}

function computeHorasCama(effectiveHours: number | null, bedArea: number | null): number | null {
  return computeHorasCamaHelper(effectiveHours, bedArea);
}

function buildCycleHoursRequest(cycleKey: string | null) {
  return buildCycleHoursRequestHelper(cycleKey);
}

function buildCycleHoursPersonRequest(cycleKey: string, personId: string | null) {
  return buildCycleHoursPersonRequestHelper(cycleKey, personId);
}

async function swrHoursFetcher<T>([url, fallbackMessage]: readonly [string, string]) {
  return swrHoursFetcherHelper<T>([url, fallbackMessage]);
}

/**
 * Plantas del programa: macro-ponderado sobre todos los ciclos visibles.
 * Suma programmedPlants de todos los ciclos.
 */
function computeProgrammedPlantsAcrossCycles(cycles: CycleProfileCard[]): number | null {
  return computeProgrammedPlantsAcrossCyclesHelper(cycles);
}

/**
 * Resuelve el "Estado actual" agregado más útil del bloque/modal.
 * Prioridad: Activo > Cosecha > Vegetativo > Planificado > Cerrado.
 */
function resolveAggregatedOperationalStatus(cycles: CycleProfileCard[]): string {
  return resolveAggregatedOperationalStatusHelper(cycles);
}

function getBedSortValue(bedId: string) {
  return getBedSortValueHelper(bedId);
}

function MetricPill({
  label,
  value,
  onClick,
  hint,
}: {
  label: string;
  value: string;
  onClick?: () => void;
  hint?: string;
}) {
  return <MetricPillPrimitive label={label} value={value} onClick={onClick} hint={hint} />;
}

function DetailBadges({
  items,
}: {
  items: string[];
}) {
  return <DetailBadgesPrimitive items={items} />;
}

function InfoField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return <InfoFieldPrimitive label={label} value={value} />;
}

function HoursPerformanceDonut({
  percentage,
}: {
  percentage: number | null;
}) {
  return <HoursPerformanceDonutPrimitive percentage={percentage} />;
}

function PersonHoursOverlay({
  cycle,
  personId,
  data,
  loading,
  error,
  onClose,
}: {
  cycle: CycleProfileCard;
  personId: string;
  data: CycleLaborPersonDetailPayload | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
}) {
  const [view, setView] = useState<"info" | "performance" | "medical">("info");

  const totalEffectiveHours = data?.summary.totalEffectiveHours ?? 0;
  const totalActualHours = data?.summary.totalActualHours ?? 0;
  const horasCama = computeHorasCama(totalEffectiveHours, cycle.bedArea);
  const profile = data?.profile ?? null;
  const displayName = profile?.fullName ?? `Personal ${personId}`;

  const overlayContent = (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 px-3 py-4 backdrop-blur-sm sm:px-4 sm:py-6 animate-in fade-in duration-150" role="dialog" aria-modal="true" aria-labelledby="modal-title-person-hours">
      <button type="button" className="absolute inset-0 border-0 bg-transparent p-0" onClick={onClose} aria-label="Cerrar ficha del personal" />
      <div className="relative z-10 flex max-h-[min(88dvh,900px)] w-full max-w-sm sm:max-w-2xl md:max-w-3xl lg:max-w-4xl xl:max-w-5xl 2xl:max-w-6xl min-w-0 flex-col overflow-hidden rounded-2xl border border-border/50 bg-card shadow-2xl shadow-slate-950/16 animate-in fade-in slide-in-from-bottom-4 duration-200">
        <div className="flex items-start justify-between gap-4 border-b border-border/50 bg-muted/20 px-4 py-4 sm:px-6">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="rounded-full px-3 py-1">
                Ficha del personal
              </Badge>
              <Badge variant="secondary" className="rounded-full px-3 py-1">
                ID {personId}
              </Badge>
              <Badge variant="outline" className="rounded-full px-3 py-1">
                {cycle.cycleKey}
              </Badge>
            </div>
            <div className="min-w-0">
              <h3 id="modal-title-person-hours" className="text-2xl font-semibold tracking-tight">
                {displayName}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {profile?.jobTitle ?? "Personal de campo"}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>

        <div className="overflow-y-auto px-6 py-8 sm:px-8">
          <div className="space-y-8">
            <div className="inline-flex rounded-full border border-border/60 bg-muted/22 p-1">
              <button
                type="button"
                className={cn(
                  "rounded-full px-4 py-2 text-sm font-medium transition-colors",
                  view === "info"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => setView("info")}
              >
                Informacion
              </button>
              <button
                type="button"
                className={cn(
                  "rounded-full px-4 py-2 text-sm font-medium transition-colors",
                  view === "performance"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => setView("performance")}
              >
                Rendimiento
              </button>
              <button
                type="button"
                className={cn(
                  "rounded-full px-4 py-2 text-sm font-medium transition-colors",
                  view === "medical"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => setView("medical")}
              >
                Ficha medica
              </button>
            </div>

            {loading ? (
              <div className="flex items-center gap-3 py-8 text-sm text-muted-foreground">
                <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                Cargando ficha del personal.
              </div>
            ) : error ? (
              <div className="py-8 text-sm text-destructive">{error}</div>
            ) : data ? (
              view === "info" ? (
                <div className="space-y-5">
                  {/* Datos personales */}
                  <div className="rounded-2xl border border-border/60 bg-muted/14 px-5 py-5">
                    <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/65">
                      Datos personales
                    </p>
                    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
                      <InfoField label="Nombre completo" value={profile?.fullName ?? "Sin dato"} />
                      <InfoField label="Cédula / ID" value={profile?.nationalId ?? "Sin dato"} />
                      <InfoField label="Género" value={profile?.gender ?? "Sin dato"} />
                      <InfoField label="Estado civil" value={profile?.maritalStatus ?? "Sin dato"} />
                      <InfoField label="Fecha de nacimiento" value={profile?.birthDate ?? "Sin dato"} />
                      <InfoField label="Lugar de nacimiento" value={profile?.birthPlace ?? "Sin dato"} />
                      <InfoField label="Nacionalidad" value={profile?.nationality ?? "Sin dato"} />
                      <InfoField label="Nivel educativo" value={profile?.educationTitle ?? "Sin dato"} />
                      <InfoField label="Hijos" value={profile?.childrenCount == null ? "Sin dato" : String(profile.childrenCount)} />
                      <InfoField label="Dependientes" value={profile?.dependentsCount == null ? "Sin dato" : String(profile.dependentsCount)} />
                      <InfoField label="Discapacidad" value={profile?.disabledFlag == null ? "Sin dato" : profile.disabledFlag ? "Sí" : "No"} />
                    </div>
                  </div>

                  {/* Datos laborales */}
                  <div className="rounded-2xl border border-border/60 bg-muted/14 px-5 py-5">
                    <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/65">
                      Datos laborales
                    </p>
                    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
                      <InfoField label="Cargo" value={profile?.jobTitle ?? "Sin dato"} />
                      <InfoField label="Tipo de empleado" value={profile?.employeeType ?? "Sin dato"} />
                      <InfoField label="Tipo de contrato" value={profile?.contractType ?? "Sin dato"} />
                      <InfoField label="Clasificación de cargo" value={profile?.jobClassificationCode ?? "Sin dato"} />
                      <InfoField label="Empleador" value={profile?.employerName ?? "Sin dato"} />
                      <InfoField label="Código de finca" value={profile?.farmCode ?? "Sin dato"} />
                      <InfoField label="Trabajador asociado" value={profile?.associatedWorkerName ?? "Sin dato"} />
                      <InfoField label="Pago por rendimiento" value={profile?.performancePayApplicable == null ? "Sin dato" : profile.performancePayApplicable ? "Sí" : "No"} />
                    </div>
                  </div>

                  {/* Contacto */}
                  <div className="rounded-2xl border border-border/60 bg-muted/14 px-5 py-5">
                    <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/65">
                      Contacto
                    </p>
                    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
                      <InfoField label="Email" value={profile?.email ?? "Sin dato"} />
                      <InfoField label="Teléfono" value={profile?.phoneNumber ?? "Sin dato"} />
                      <InfoField label="Dirección" value={profile?.address ?? "Sin dato"} />
                      <InfoField label="Ciudad" value={profile?.city ?? "Sin dato"} />
                      <InfoField label="Parroquia" value={profile?.parish ?? "Sin dato"} />
                    </div>
                  </div>

                  {/* Acceso */}
                  <div className="rounded-2xl border border-border/60 bg-muted/14 px-5 py-5">
                    <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/65">
                      Acceso a la empresa
                    </p>
                    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
                      <InfoField label="Última entrada" value={profile?.lastEntryDate ?? "Sin dato"} />
                      <InfoField label="Última salida" value={profile?.lastExitDate ?? "Sin dato"} />
                    </div>
                  </div>
                </div>
              ) : view === "performance" ? (
                <div className="space-y-5">
                  <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
                    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
                      <MetricPill
                        label="Horas presenciales"
                        value={formatNumber(totalActualHours)}
                        hint="Actual hours del personal"
                      />
                      <MetricPill
                        label="Horas trabajadas"
                        value={formatNumber(totalEffectiveHours)}
                        hint="Effective hours del personal"
                      />
                      <MetricPill
                        label="Horas cama"
                        value={formatNumber(horasCama)}
                        hint="Horas trabajadas / camas 30 m2 del ciclo"
                      />
                      <MetricPill
                        label="Rendimiento"
                        value={formatPercent(data.summary.rendimientoPct)}
                        hint="Horas trabajadas / horas presenciales"
                      />
                    </div>

                    <HoursPerformanceDonut
                      percentage={data.summary.nonNormalActualHoursPct}
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <DetailBadges
                      items={[
                        `${data.summary.activityCount} actividades`,
                        `${formatNumber(totalActualHours)} horas presenciales`,
                        `${formatNumber(totalEffectiveHours)} horas trabajadas`,
                      ]}
                    />
                    <p className="text-xs text-muted-foreground">
                      Productividad = unidades / horas presenciales. Rendimiento = horas trabajadas / horas presenciales.
                    </p>
                  </div>

                  <div className="max-h-[min(40dvh,460px)] overflow-auto rounded-[24px] border border-border/70">
                    <table className="min-w-full border-separate border-spacing-0 text-sm">
                      <thead className="sticky top-0 z-20 bg-card/95 backdrop-blur">
                        <tr>
                          {[
                            "Actividad",
                            "Horas presenciales",
                            "Horas trabajadas",
                            "Horas cama",
                            "Rendimiento",
                            "Unidades producidas",
                            "Productividad",
                            "Productividad historica",
                            "Productividad ciclo",
                          ].map((label) => (
                            <th
                              key={label}
                              className="border-b border-r border-border/70 bg-card px-3 py-3 text-left font-semibold text-foreground last:border-r-0"
                            >
                              {label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {data.activities.length ? data.activities.map((activity, index) => (
                          <tr key={`${activity.activityId}|${activity.activityName}|${activity.unitOfMeasure}`} className={cn(index % 2 === 0 ? "bg-background/84" : "bg-muted/20")}>
                            <td className="border-b border-r border-border/50 px-3 py-2.5 font-medium text-foreground">
                              <div className="min-w-[16rem]">
                                <p>{activity.activityName}</p>
                                <p className="mt-0.5 text-xs text-muted-foreground">
                                  {activity.unitOfMeasure || "Sin medida"}
                                </p>
                              </div>
                            </td>
                            <td className="border-b border-r border-border/50 px-3 py-2.5 text-right tabular-nums">
                              {formatNumber(activity.actualHours)}
                            </td>
                            <td className="border-b border-r border-border/50 px-3 py-2.5 text-right tabular-nums">
                              {formatNumber(activity.effectiveHours)}
                            </td>
                            <td className="border-b border-r border-border/50 px-3 py-2.5 text-right tabular-nums">
                              {formatNumber(computeHorasCama(activity.effectiveHours, cycle.bedArea))}
                            </td>
                            <td className="border-b border-r border-border/50 px-3 py-2.5 text-right tabular-nums">
                              {formatPercent(activity.rendimientoPct)}
                            </td>
                            <td className="border-b border-r border-border/50 px-3 py-2.5 text-right tabular-nums">
                              {formatNumber(activity.unitsProduced)}
                            </td>
                            <td className="border-b border-r border-border/50 px-3 py-2.5 text-right tabular-nums">
                              {formatProductivity(activity.productivity)}
                            </td>
                            <td className="border-b border-r border-border/50 px-3 py-2.5 text-right tabular-nums">
                              {formatProductivity(activity.historicalProductivity, "Sin historico")}
                            </td>
                            <td className="border-b px-3 py-2.5 text-right tabular-nums">
                              {formatProductivity(activity.cycleProductivity)}
                            </td>
                          </tr>
                        )) : (
                          <tr>
                            <td colSpan={9} className="px-4 py-8 text-center text-sm text-muted-foreground">
                        No hay horas registradas para este personal en el ciclo.
                      </td>
                    </tr>
                  )}
                </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <PersonMedicalPanel
                  personId={personId}
                  fallbackName={displayName}
                />
              )
            ) : (
              <div className="py-8 text-sm text-muted-foreground">
                No se encontro informacion para este personal en el ciclo.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(overlayContent, document.body);
}

function HoursCamaOverlay({
  cycle,
  data,
  loading,
  error,
  onClose,
}: {
  cycle: CycleProfileCard;
  data: CycleLaborHoursPayload | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
}) {
  const [expandedCostAreas, setExpandedCostAreas] = useState<string[]>([]);
  const [expandedSubCostCenters, setExpandedSubCostCenters] = useState<string[]>([]);
  const [expandedTypes, setExpandedTypes] = useState<string[]>([]);
  const [expandedActivities, setExpandedActivities] = useState<string[]>([]);
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const totalEffectiveHours = data?.summary.totalEffectiveHours ?? cycle.effectiveHours;
  const totalActualHours = data?.summary.totalActualHours ?? cycle.actualHours;
  const totalUnitsProduced = data?.summary.totalUnitsProduced ?? cycle.unitsProduced;
  const horasCama = computeHorasCama(totalEffectiveHours, cycle.bedArea);
  const camas30 = computeCamas30(cycle.bedArea) ?? 1;
  const personRequest = buildCycleHoursPersonRequest(cycle.cycleKey, selectedPersonId);
  const {
    data: personData,
    error: personRequestError,
    isLoading: personLoading,
  } = useSWRImmutable<CycleLaborPersonDetailPayload>(personRequest, swrHoursFetcher, {
    revalidateOnFocus: false,
  });

  useEffect(() => {
    if (!selectedPersonId) {
      return;
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      setSelectedPersonId(null);
    }

    window.addEventListener("keydown", handleEscape, true);
    return () => window.removeEventListener("keydown", handleEscape, true);
  }, [selectedPersonId]);

  function toggleCostArea(key: string) {
    setExpandedCostAreas((current) => (
      current.includes(key) ? current.filter((v) => v !== key) : [...current, key]
    ));
  }

  function toggleSubCostCenter(key: string) {
    setExpandedSubCostCenters((current) => (
      current.includes(key) ? current.filter((v) => v !== key) : [...current, key]
    ));
  }

  function toggleType(activityType: string) {
    setExpandedTypes((current) => (
      current.includes(activityType)
        ? current.filter((value) => value !== activityType)
        : [...current, activityType]
    ));
  }

  function toggleActivity(activityKey: string) {
    setExpandedActivities((current) => (
      current.includes(activityKey)
        ? current.filter((value) => value !== activityKey)
        : [...current, activityKey]
    ));
  }

  const overlayContent = (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 px-3 py-4 backdrop-blur-sm sm:px-4 sm:py-6 animate-in fade-in duration-150" role="dialog" aria-modal="true" aria-labelledby="modal-title-hours-cama">
      <button type="button" className="absolute inset-0 border-0 bg-transparent p-0" onClick={onClose} aria-label="Cerrar detalle de horas cama" />
      <div className="relative z-10 flex max-h-[min(90dvh,960px)] w-full max-w-sm sm:max-w-2xl md:max-w-3xl lg:max-w-4xl xl:max-w-5xl 2xl:max-w-6xl min-w-0 flex-col overflow-hidden rounded-2xl border border-border/50 bg-card shadow-2xl shadow-slate-950/14 animate-in fade-in slide-in-from-bottom-4 duration-200">
        <div className="flex items-start justify-between gap-4 border-b border-border/50 bg-muted/20 px-4 py-4 sm:px-6">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="rounded-full px-3 py-1">
                Horas cama
              </Badge>
              <Badge variant="secondary" className="rounded-full px-3 py-1">
                {cycle.cycleKey}
              </Badge>
            </div>
            <div className="min-w-0">
              <h3 id="modal-title-hours-cama" className="text-2xl font-semibold tracking-tight">Detalle de horas por actividad</h3>
              <p className="break-words text-sm text-muted-foreground">
                Resumen por tipo de actividad, con despliegue por actividad y por ID personal.
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>

        <div className="overflow-y-auto px-6 py-8 sm:px-8">
          <div className="space-y-8">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricPill
                label="Horas cama"
                value={formatNumber(horasCama)}
                hint="Horas trabajadas / camas 30 m2"
              />
              <MetricPill
                label="Horas trabajadas"
                value={formatNumber(totalEffectiveHours)}
                hint="Effective hours del ciclo"
              />
              <MetricPill
                label="Horas presenciales"
                value={formatNumber(totalActualHours)}
                hint="Actual hours del ciclo"
              />
              <MetricPill
                label="Camas 30 m2"
                value={formatNumber(camas30)}
                hint="Area del ciclo / 30"
              />
            </div>

            {loading ? (
              <div className="flex items-center gap-3 py-8 text-sm text-muted-foreground">
                <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                Cargando detalle de horas.
              </div>
            ) : error ? (
              <div className="py-8 text-sm text-destructive">{error}</div>
            ) : data ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <DetailBadges
                    items={[
                      `${data.summary.costAreaCount} áreas`,
                      `${data.summary.subCostCenterCount} subcentros`,
                      `${data.summary.activityTypeCount} tipos`,
                      `${data.summary.activityCount} actividades`,
                      `${data.summary.personCount} personas`,
                      `${formatNumber(totalUnitsProduced)} unidades`,
                    ]}
                  />
                  <p className="text-xs text-muted-foreground">
                    Productividad = unidades / horas presenciales. Rendimiento = horas trabajadas / horas presenciales.
                  </p>
                </div>

                <div className="max-h-[56dvh] overflow-auto rounded-[24px] border border-border/70">
                  <table className="min-w-full border-separate border-spacing-0 text-xs">
                    <thead className="sticky top-0 z-20">
                      <tr>
                        <th className="border-b border-r border-border/60 bg-muted/60 px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground min-w-[260px]">Descripción</th>
                        <th className="border-b border-r border-border/60 bg-muted/60 px-2.5 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap">Medida</th>
                        <th className="border-b border-r border-border/60 bg-muted/60 px-2.5 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap">Unidades</th>
                        <th className="border-b border-r border-border/60 bg-muted/60 px-2.5 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap">Hs. presencial</th>
                        <th className="border-b border-r border-border/60 bg-muted/60 px-2.5 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap">Hs. trabajadas</th>
                        <th className="border-b border-r border-border/60 bg-muted/60 px-2.5 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap">Hs. cama</th>
                        <th className="border-b border-r border-border/60 bg-muted/60 px-2.5 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap">Productividad</th>
                        <th className="border-b border-border/60 bg-muted/60 px-2.5 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap">Rendimiento</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.costAreas.length ? data.costAreas.map((costArea) => {
                        const caExpanded = expandedCostAreas.includes(costArea.costArea);
                        return (
                          <Fragment key={`ca-${costArea.costArea}`}>
                            {/* L1: Área de costo */}
                            <tr className="bg-foreground/[0.06] hover:bg-foreground/[0.09] transition-colors">
                              <td className="border-b border-r border-border/40 px-3 py-2">
                                <button type="button" className="flex items-center gap-2 text-left w-full" onClick={() => toggleCostArea(costArea.costArea)}>
                                  {caExpanded ? <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" /> : <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />}
                                  <span className="text-[10px] font-semibold uppercase tracking-wider bg-foreground/10 text-muted-foreground rounded px-1.5 py-0.5">Área</span>
                                  <span className="font-bold text-foreground">{costArea.costArea}</span>
                                  <span className="ml-auto text-[10px] text-muted-foreground/60">{costArea.subCostCenters.length} sub</span>
                                </button>
                              </td>
                              <td className="border-b border-r border-border/40 px-2.5 py-2 text-muted-foreground/40">—</td>
                              <td className="border-b border-r border-border/40 px-2.5 py-2 text-right tabular-nums font-semibold">{formatNumber(costArea.unitsProduced)}</td>
                              <td className="border-b border-r border-border/40 px-2.5 py-2 text-right tabular-nums font-semibold">{formatNumber(costArea.actualHours)}</td>
                              <td className="border-b border-r border-border/40 px-2.5 py-2 text-right tabular-nums font-semibold">{formatNumber(costArea.effectiveHours)}</td>
                              <td className="border-b border-r border-border/40 px-2.5 py-2 text-right tabular-nums font-semibold">{formatNumber(costArea.effectiveHours / camas30)}</td>
                              <td className="border-b border-r border-border/40 px-2.5 py-2 text-right tabular-nums font-semibold">{formatNumber(costArea.productivity)}</td>
                              <td className="border-b px-2.5 py-2 text-right tabular-nums font-semibold">{formatPercent(costArea.rendimientoPct)}</td>
                            </tr>

                            {caExpanded ? costArea.subCostCenters.map((sub) => {
                              const subKey = `${costArea.costArea}|${sub.subCostCenter}`;
                              const subExpanded = expandedSubCostCenters.includes(subKey);
                              return (
                                <Fragment key={`sc-${subKey}`}>
                                  {/* L2: Sub centro */}
                                  <tr className="bg-slate-900/[0.03] dark:bg-slate-900/[0.08] hover:bg-primary/[0.07] transition-colors">
                                    <td className="border-b border-r border-border/40 px-3 py-2 pl-7">
                                      <button type="button" className="flex items-center gap-2 text-left w-full" onClick={() => toggleSubCostCenter(subKey)}>
                                        {subExpanded ? <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" /> : <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />}
                                        <span className="text-[10px] font-semibold uppercase tracking-wider bg-primary/10 text-slate-700 dark:text-white/70 rounded px-1.5 py-0.5">Sub</span>
                                        <span className="font-semibold text-foreground">{sub.subCostCenter}</span>
                                        <span className="ml-auto text-[10px] text-muted-foreground/60">{sub.activityTypes.length} tipos</span>
                                      </button>
                                    </td>
                                    <td className="border-b border-r border-border/40 px-2.5 py-2 text-muted-foreground/40">—</td>
                                    <td className="border-b border-r border-border/40 px-2.5 py-2 text-right tabular-nums font-medium">{formatNumber(sub.unitsProduced)}</td>
                                    <td className="border-b border-r border-border/40 px-2.5 py-2 text-right tabular-nums font-medium">{formatNumber(sub.actualHours)}</td>
                                    <td className="border-b border-r border-border/40 px-2.5 py-2 text-right tabular-nums font-medium">{formatNumber(sub.effectiveHours)}</td>
                                    <td className="border-b border-r border-border/40 px-2.5 py-2 text-right tabular-nums font-medium">{formatNumber(sub.effectiveHours / camas30)}</td>
                                    <td className="border-b border-r border-border/40 px-2.5 py-2 text-right tabular-nums font-medium">{formatNumber(sub.productivity)}</td>
                                    <td className="border-b px-2.5 py-2 text-right tabular-nums font-medium">{formatPercent(sub.rendimientoPct)}</td>
                                  </tr>

                                  {subExpanded ? sub.activityTypes.map((activityType) => {
                                    const typeKey = `${subKey}|${activityType.activityType}`;
                                    const typeExpanded = expandedTypes.includes(typeKey);
                                    return (
                                      <Fragment key={`type-${typeKey}`}>
                                        {/* L3: Tipo actividad */}
                                        <tr className="bg-muted/25 hover:bg-muted/40 transition-colors">
                                          <td className="border-b border-r border-border/40 px-3 py-1.5 pl-12">
                                            <button type="button" className="flex items-center gap-2 text-left w-full" onClick={() => toggleType(typeKey)}>
                                              {typeExpanded ? <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" /> : <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />}
                                              <span className="font-medium text-foreground">{activityType.activityType}</span>
                                              <span className="ml-auto text-[10px] text-muted-foreground/60">{activityType.activities.length} act.</span>
                                            </button>
                                          </td>
                                          <td className="border-b border-r border-border/40 px-2.5 py-1.5 text-muted-foreground/40">—</td>
                                          <td className="border-b border-r border-border/40 px-2.5 py-1.5 text-right tabular-nums">{formatNumber(activityType.unitsProduced)}</td>
                                          <td className="border-b border-r border-border/40 px-2.5 py-1.5 text-right tabular-nums">{formatNumber(activityType.actualHours)}</td>
                                          <td className="border-b border-r border-border/40 px-2.5 py-1.5 text-right tabular-nums">{formatNumber(activityType.effectiveHours)}</td>
                                          <td className="border-b border-r border-border/40 px-2.5 py-1.5 text-right tabular-nums">{formatNumber(activityType.effectiveHours / camas30)}</td>
                                          <td className="border-b border-r border-border/40 px-2.5 py-1.5 text-right tabular-nums">{formatNumber(activityType.productivity)}</td>
                                          <td className="border-b px-2.5 py-1.5 text-right tabular-nums">{formatPercent(activityType.rendimientoPct)}</td>
                                        </tr>

                                        {typeExpanded ? activityType.activities.map((activity) => {
                                          const activityKey = `${typeKey}|${activity.activityId}|${activity.activityName}`;
                                          const activityExpanded = expandedActivities.includes(activityKey);
                                          return (
                                            <Fragment key={`activity-${activityKey}`}>
                                              {/* L4: Actividad */}
                                              <tr className="bg-background hover:bg-muted/15 transition-colors">
                                                <td className="border-b border-r border-border/30 px-3 py-1.5 pl-16">
                                                  <button type="button" className="flex items-center gap-1.5 text-left w-full" onClick={() => toggleActivity(activityKey)}>
                                                    {activityExpanded ? <ChevronDown className="size-3 shrink-0 text-muted-foreground/60" /> : <ChevronRight className="size-3 shrink-0 text-muted-foreground/60" />}
                                                    <span className="text-foreground">{activity.activityName}</span>
                                                  </button>
                                                </td>
                                                <td className="border-b border-r border-border/30 px-2.5 py-1.5 text-muted-foreground">{activity.unitOfMeasure || "—"}</td>
                                                <td className="border-b border-r border-border/30 px-2.5 py-1.5 text-right tabular-nums">{formatNumber(activity.unitsProduced)}</td>
                                                <td className="border-b border-r border-border/30 px-2.5 py-1.5 text-right tabular-nums">{formatNumber(activity.actualHours)}</td>
                                                <td className="border-b border-r border-border/30 px-2.5 py-1.5 text-right tabular-nums">{formatNumber(activity.effectiveHours)}</td>
                                                <td className="border-b border-r border-border/30 px-2.5 py-1.5 text-right tabular-nums">{formatNumber(activity.effectiveHours / camas30)}</td>
                                                <td className="border-b border-r border-border/30 px-2.5 py-1.5 text-right tabular-nums">{formatNumber(activity.productivity)}</td>
                                                <td className="border-b px-2.5 py-1.5 text-right tabular-nums">{formatPercent(activity.rendimientoPct)}</td>
                                              </tr>

                                              {activityExpanded ? activity.people.map((person) => (
                                                <HoursCamaPersonRow
                                                  key={`person-${activityKey}-${person.personId}`}
                                                  person={person}
                                                  camas30={camas30}
                                                  isSelected={selectedPersonId === person.personId}
                                                  onOpenPerson={setSelectedPersonId}
                                                />
                                              )) : null}
                                            </Fragment>
                                          );
                                        }) : null}
                                      </Fragment>
                                    );
                                  }) : null}
                                </Fragment>
                              );
                            }) : null}
                          </Fragment>
                        );
                      }) : (
                        <tr>
                          <td colSpan={8} className="px-4 py-8 text-center text-sm text-muted-foreground">
                            No hay horas registradas para este ciclo.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") {
    return null;
  }

  return (
    <>
      {createPortal(overlayContent, document.body)}
      {selectedPersonId ? (
        <PersonHoursOverlay
          key={`person-hours-${cycle.cycleKey}-${selectedPersonId}`}
          cycle={cycle}
          personId={selectedPersonId}
          data={personData ?? null}
          loading={personLoading}
          error={personRequestError instanceof Error ? personRequestError.message : null}
          onClose={() => setSelectedPersonId(null)}
        />
      ) : null}
    </>
  );
}

function HoursCamaPersonRow({
  person,
  camas30,
  isSelected,
  onOpenPerson,
}: {
  person: CycleLaborPersonSummary;
  camas30: number;
  isSelected?: boolean;
  onOpenPerson?: (personId: string) => void;
}) {
  return (
    <tr className={cn("bg-muted/10 hover:bg-muted/25 transition-colors", isSelected && "bg-slate-900/8 dark:bg-slate-900/12")}>
      {/* L5: Persona — columna descripción con indent máximo */}
      <td className="border-b border-r border-border/30 px-3 py-1.5 pl-20">
        <div className="flex items-center gap-2">
          <span className="text-foreground leading-snug">{person.personName ?? <span className="italic text-muted-foreground">Sin nombre</span>}</span>
          {onOpenPerson ? (
            <button
              type="button"
              className={cn(
                "inline-flex shrink-0 rounded-full border px-1.5 py-0.5 text-[11px] font-semibold transition-colors",
                isSelected
                  ? "border-slate-700/35 bg-primary/10 text-slate-700 dark:text-white"
                  : "border-border/60 bg-background text-muted-foreground hover:border-slate-700/35 hover:text-slate-700 dark:text-white",
              )}
              onClick={() => onOpenPerson(person.personId)}
            >
              {person.personId}
            </button>
          ) : <span className="text-[11px] text-muted-foreground">{person.personId}</span>}
        </div>
      </td>
      <td className="border-b border-r border-border/30 px-2.5 py-1.5 text-muted-foreground">{person.unitOfMeasure || "—"}</td>
      <td className="border-b border-r border-border/30 px-2.5 py-1.5 text-right tabular-nums">{formatNumber(person.unitsProduced)}</td>
      <td className="border-b border-r border-border/30 px-2.5 py-1.5 text-right tabular-nums">{formatNumber(person.actualHours)}</td>
      <td className="border-b border-r border-border/30 px-2.5 py-1.5 text-right tabular-nums">{formatNumber(person.effectiveHours)}</td>
      <td className="border-b border-r border-border/30 px-2.5 py-1.5 text-right tabular-nums">{formatNumber(person.effectiveHours / (camas30))}</td>
      <td className="border-b border-r border-border/30 px-2.5 py-1.5 text-right tabular-nums">{formatNumber(person.productivity)}</td>
      <td className="border-b px-2.5 py-1.5 text-right tabular-nums">{formatPercent(person.rendimientoPct)}</td>
    </tr>
  );
}

function BedsTable({
  beds,
  selectedValveId,
  onOpenValve,
  onOpenMortalityCurve,
}: {
  beds: BedProfileCard[];
  selectedValveId?: string | null;
  onOpenValve?: (valveId: string) => void;
  onOpenMortalityCurve?: (bedId: string) => void;
}) {
  const sortedBeds = [...beds].sort((left, right) => {
    const leftSortValue = getBedSortValue(left.bedId);
    const rightSortValue = getBedSortValue(right.bedId);

    if (leftSortValue !== rightSortValue) {
      return leftSortValue - rightSortValue;
    }

    return left.bedId.localeCompare(right.bedId, "en-US", { numeric: true });
  });

  return (
    <div className="overflow-auto rounded-2xl border border-border/70">
      <table className="min-w-full border-separate border-spacing-0 text-sm">
        <thead>
          <tr>
            {[
              "Cama",
              "Valvula",
              "Programadas",
              "Inicio ciclo",
              "Vigentes",
              "Bajas",
              "Resiembras",
              "Disp. vs prog.",
              "Mortandad",
              "Pambiles",
              "Camas 30 m²",
              "Variedad",
              "SP",
              "Vigencia",
              "Acciones",
            ].map((label) => (
              <th
                key={label}
                className="border-b border-r border-border/20 bg-foreground px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-background last:border-r-0"
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedBeds.map((bed, index) => {
            const isActiveValve = Boolean(selectedValveId && selectedValveId === bed.valveId);

            return (
              <tr
                key={bed.recordId}
                className={cn(
                  index % 2 === 0 ? "bg-background/82" : "bg-background/68",
                  isActiveValve && "bg-primary/6",
                )}
              >
                <td className="border-b border-r border-border/60 px-3 py-2.5 font-medium">{getTrailingSegment(bed.bedId)}</td>
                <td className="border-b border-r border-border/60 px-3 py-2.5">
                  {bed.valveId && onOpenValve ? (
                    <button
                      type="button"
                      className="font-medium text-slate-700 dark:text-white underline-offset-4 hover:underline"
                      onClick={() => onOpenValve(bed.valveId)}
                    >
                      {getValveDisplayName(null, bed.valveId)}
                    </button>
                  ) : (
                    getValveDisplayName(null, bed.valveId)
                  )}
                </td>
                <td className="border-b border-r border-border/60 px-3 py-2.5">{formatNumber(bed.programmedPlants)}</td>
                <td className="border-b border-r border-border/60 px-3 py-2.5">{formatNumber(bed.cycleStartPlants)}</td>
                <td className="border-b border-r border-border/60 px-3 py-2.5">{formatNumber(bed.currentPlants)}</td>
                <td className="border-b border-r border-border/60 px-3 py-2.5">{formatNumber(bed.deadPlants)}</td>
                <td className="border-b border-r border-border/60 px-3 py-2.5">{formatNumber(bed.reseededPlants)}</td>
                <td className="border-b border-r border-border/60 px-3 py-2.5">{formatPercent(bed.availabilityVsScheduledPct)}</td>
                <td className="border-b border-r border-border/60 px-3 py-2.5">{formatPercent(bed.mortalityPct)}</td>
                <td className="border-b border-r border-border/60 px-3 py-2.5">{formatNumber(bed.pambilesCount)}</td>
                <td className="border-b border-r border-border/60 px-3 py-2.5">{formatNumber(computeCamas30(bed.bedArea))}</td>
                <td className="border-b border-r border-border/60 px-3 py-2.5">{bed.variety || "-"}</td>
                <td className="border-b border-r border-border/60 px-3 py-2.5">{bed.spType || "-"}</td>
                <td className="border-b border-border/60 px-3 py-2.5">
                  {formatDate(bed.validFrom)} / {formatDate(bed.validTo)}
                </td>
                <td className="border-b border-border/60 px-3 py-2.5">
                  {onOpenMortalityCurve ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-lg"
                      onClick={() => onOpenMortalityCurve(bed.bedId)}
                    >
                      <LineChart className="size-4" aria-hidden="true" />
                      Curva de mortandad
                    </Button>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function BedsOverlay({
  cycleKey,
  data,
  loading,
  error,
  selectedValve,
  valveData,
  valveLoading,
  valveError,
  onOpenValve,
  onOpenValveBedsOverlay,
  onOpenBedMortalityCurve,
  onOpenValveMortalityCurve,
  onClose,
}: {
  cycleKey: string;
  data: BedProfilePayload | null;
  loading: boolean;
  error: string | null;
  selectedValve: { cycleKey: string; valveId: string } | null;
  valveData: ValveProfilePayload | null;
  valveLoading: boolean;
  valveError: string | null;
  onOpenValve: (cycleKey: string, valveId: string) => void;
  onOpenValveBedsOverlay: (cycleKey: string, valveId: string) => void;
  onOpenBedMortalityCurve: (cycleKey: string, bedId: string) => void;
  onOpenValveMortalityCurve: (cycleKey: string, valveId: string) => void;
  onClose: () => void;
}) {
  const selectedValveId = selectedValve?.cycleKey === cycleKey ? selectedValve.valveId : null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-3 py-4 backdrop-blur-sm sm:px-4 sm:py-6 animate-in fade-in duration-150" role="dialog" aria-modal="true" aria-labelledby="modal-title-beds">
      <button type="button" className="absolute inset-0 border-0 bg-transparent p-0" onClick={onClose} aria-label="Cerrar detalle de camas" />
      <div className="relative z-10 flex max-h-[min(90dvh,960px)] w-full max-w-sm sm:max-w-2xl md:max-w-3xl lg:max-w-4xl xl:max-w-5xl 2xl:max-w-6xl min-w-0 flex-col overflow-hidden rounded-2xl border border-border/50 bg-card shadow-2xl shadow-slate-950/14 animate-in fade-in slide-in-from-bottom-4 duration-200">
        <div className="flex items-start justify-between gap-4 border-b border-border/50 bg-muted/20 px-4 py-4 sm:px-6">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="rounded-full px-3 py-1">
                Tabla de camas
              </Badge>
              <Badge variant="secondary" className="rounded-full px-3 py-1">
                {cycleKey}
              </Badge>
            </div>
            <div className="min-w-0">
              <h3 id="modal-title-beds" className="text-2xl font-semibold tracking-tight">Detalle de camas</h3>
              <p className="break-words text-sm text-muted-foreground">
                Vista completa del ciclo con acceso directo al detalle de valvulas por cama.
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>

        <div className="overflow-y-auto px-4 py-5 sm:px-6">
          {loading ? (
            <div className="flex items-center gap-3 py-8 text-sm text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
              Cargando detalle de camas.
            </div>
          ) : error ? (
            <div className="py-8 text-sm text-destructive">{error}</div>
          ) : data && data.cycleKey === cycleKey ? (
            data.beds.length ? (
              <div className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <DetailBadges
                    items={[
                      `${data.summary.totalBeds} camas`,
                      `${formatNumber(data.summary.totalProgrammedPlants)} programadas`,
                      `${formatNumber(data.summary.totalCurrentPlants)} vigentes`,
                      `${formatNumber(data.summary.totalBedArea)} superficie`,
                    ]}
                  />
                </div>

                <div className="max-h-[54dvh] overflow-auto rounded-[24px] border border-border/70 bg-background/72 p-3">
                  <BedsTable
                    beds={data.beds}
                    selectedValveId={selectedValveId}
                    onOpenValve={(valveId) => onOpenValve(cycleKey, valveId)}
                    onOpenMortalityCurve={(bedId) => onOpenBedMortalityCurve(cycleKey, bedId)}
                  />
                </div>

                {selectedValveId ? (
                  <div className="rounded-[22px] border border-border/70 bg-card/90 p-4">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                          Detalle de valvula
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {valveData?.valve
                            ? `${getValveDisplayName(valveData.valve.valveName, valveData.valve.valveId)} / Bloque ${valveData.valve.blockId || valveData.valve.parentBlock || "-"}`
                            : getValveDisplayName(null, selectedValveId)}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          className="rounded-xl"
                          onClick={() => onOpenValveBedsOverlay(cycleKey, selectedValveId)}
                        >
                          <Rows3 className="size-4" aria-hidden="true" />
                          Abrir tabla flotante de camas
                        </Button>
                        <Button variant="outline" className="rounded-xl" onClick={() => onOpenValve(cycleKey, selectedValveId)}>
                          Ocultar detalle
                        </Button>
                      </div>
                    </div>
                    <ValveDetailPanel
                      data={valveData}
                      loading={valveLoading}
                      error={valveError}
                      onOpenMortalityCurve={() => onOpenValveMortalityCurve(cycleKey, selectedValveId)}
                    />
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted-foreground">
                <Rows3 className="size-5 opacity-40" aria-hidden="true" />
                No hay detalle de camas para este ciclo.
              </div>
            )
          ) : (
            <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted-foreground">
              <Rows3 className="size-5 opacity-40" aria-hidden="true" />
              No hay detalle de camas disponible para esta seleccion.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ValveBedsOverlay({
  data,
  loading,
  error,
  onOpenBedMortalityCurve,
  onClose,
}: {
  data: ValveProfilePayload | null;
  loading: boolean;
  error: string | null;
  onOpenBedMortalityCurve: (cycleKey: string, bedId: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 px-3 py-4 backdrop-blur-sm sm:px-4 sm:py-6 animate-in fade-in duration-150" role="dialog" aria-modal="true" aria-labelledby="modal-title-valve-beds">
      <button type="button" className="absolute inset-0 border-0 bg-transparent p-0" onClick={onClose} aria-label="Cerrar camas de la valvula" />
      <div className="relative z-10 flex max-h-[min(90dvh,960px)] w-full max-w-sm sm:max-w-2xl md:max-w-3xl lg:max-w-4xl xl:max-w-5xl 2xl:max-w-6xl min-w-0 flex-col overflow-hidden rounded-2xl border border-border/50 bg-card shadow-2xl shadow-slate-950/14 animate-in fade-in slide-in-from-bottom-4 duration-200">
        <div className="flex items-start justify-between gap-4 border-b border-border/50 bg-muted/20 px-4 py-4 sm:px-6">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="rounded-full px-3 py-1">
                Camas de la valvula
              </Badge>
              {data?.valve ? (
                <Badge variant="secondary" className="rounded-full px-3 py-1">
                  {getValveDisplayName(data.valve.valveName, data.valve.valveId)}
                </Badge>
              ) : null}
            </div>
            <div className="min-w-0">
              <h3 id="modal-title-valve-beds" className="text-2xl font-semibold tracking-tight">Tabla flotante de camas</h3>
              <p className="break-words text-sm text-muted-foreground">
                Solo las camas asignadas a la valvula seleccionada del bloque {data?.valve?.blockId || data?.valve?.parentBlock || "-"}.
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>

        <div className="overflow-y-auto px-4 py-5 sm:px-6">
          {loading ? (
            <div className="flex items-center gap-3 py-8 text-sm text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
              Cargando camas de la valvula.
            </div>
          ) : error ? (
            <div className="py-8 text-sm text-destructive">{error}</div>
          ) : data?.valve ? (
            data.beds.length ? (
              <div className="space-y-5">
                <DetailBadges
                  items={[
                    `${data.summary.totalBeds} camas`,
                    `${formatNumber(data.summary.totalProgrammedPlants)} programadas`,
                    `${formatNumber(data.summary.totalCurrentPlants)} vigentes`,
                  ]}
                />
                <div className="max-h-[56dvh] overflow-auto rounded-[24px] border border-border/70 bg-background/72 p-3">
                  <BedsTable
                    beds={data.beds}
                    selectedValveId={data.valve.valveId}
                    onOpenMortalityCurve={(bedId) => onOpenBedMortalityCurve(data.cycleKey, bedId)}
                  />
                </div>
              </div>
            ) : (
              <div className="py-8 text-sm text-muted-foreground">
                No hay camas relacionadas con esta valvula.
              </div>
            )
          ) : (
            <div className="py-8 text-sm text-muted-foreground">
              No hay detalle de valvula disponible.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function HarvestCurveOverlay({
  cycleKey,
  data,
  loading,
  error,
  onClose,
}: {
  cycleKey: string;
  data: HarvestCurvePayload | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 px-3 py-4 backdrop-blur-sm sm:px-4 sm:py-6 animate-in fade-in duration-150" role="dialog" aria-modal="true" aria-labelledby="modal-title-harvest-curve">
      <button type="button" className="absolute inset-0 border-0 bg-transparent p-0" onClick={onClose} aria-label="Cerrar curva de cosecha" />
      <div className="relative z-10 flex max-h-[min(90dvh,960px)] w-full max-w-sm sm:max-w-2xl md:max-w-3xl lg:max-w-4xl xl:max-w-5xl 2xl:max-w-6xl min-w-0 flex-col overflow-hidden rounded-2xl border border-border/50 bg-card shadow-2xl shadow-slate-950/14 animate-in fade-in slide-in-from-bottom-4 duration-200">
        <div className="flex items-start justify-between gap-4 border-b border-border/50 bg-muted/20 px-4 py-4 sm:px-6">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="rounded-full px-3 py-1">
                Curva de cosecha por ciclo
              </Badge>
              <Badge variant="secondary" className="rounded-full px-3 py-1">
                {cycleKey}
              </Badge>
            </div>
            <div className="min-w-0">
              <h3 id="modal-title-harvest-curve" className="text-2xl font-semibold tracking-tight">Curva de cosecha por ciclo</h3>
              <p className="break-words text-sm text-muted-foreground">
                Acumulado diario de tallos con separacion visual entre dato real y proyectado.
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>

        <div className="overflow-y-auto px-4 py-5 sm:px-6">
          {loading ? (
            <div className="flex items-center gap-3 py-8 text-sm text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
              Cargando curva de cosecha.
            </div>
          ) : error ? (
            <div className="py-8 text-sm text-destructive">{error}</div>
          ) : data && data.cycleKey === cycleKey ? (
            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <MetricPill label="Tallos ciclo" value={formatNumber(data.summary.totalStems)} />
                <MetricPill label="Tallos reales" value={formatNumber(data.summary.observedStems)} />
                <MetricPill label="Tallos proyectados" value={formatNumber(data.summary.projectedStems)} />
                <MetricPill
                  label="% avance"
                  value={
                    data.summary.totalStems > 0
                      ? formatPercent(
                        Math.round((data.summary.observedStems / data.summary.totalStems) * 10000) / 100,
                      )
                      : "-"
                  }
                  hint="Reales / tallos ciclo"
                />
                <MetricPill
                  label="Inicio proyeccion"
                  value={data.projectionStartDay ? `Dia ${data.projectionStartDay}` : "Sin proyeccion"}
                  hint={data.projectionStartDate ? formatDate(data.projectionStartDate) : undefined}
                />
                {/*
                  Métricas de peso: ahora conectadas desde productivity_green_cur / post_cur.
                */}
                <MetricPill
                  label="Peso ciclo"
                  value={
                    data.summary.totalGreenWeightKg > 0
                      ? `${formatNumber(data.summary.totalGreenWeightKg)} kg`
                      : "-"
                  }
                  hint={data.summary.totalGreenWeightKg > 0 ? "Peso verde acumulado" : "Sin datos de peso"}
                />
                <MetricPill
                  label="Peso / tallo ciclo"
                  value={
                    data.summary.weightPerStemG !== null
                      ? `${formatNumber(data.summary.weightPerStemG)} g`
                      : "-"
                  }
                  hint={data.summary.weightPerStemG !== null ? "Peso verde / tallos" : "Sin datos de peso"}
                />
              </div>

              {data.points.length ? (
                <div className="rounded-[24px] border border-border/70 bg-background/72 p-4">
                  <HarvestCurvePanel
                    data={data.points}
                    projectionStartDay={data.projectionStartDay}
                    summary={data.summary}
                  />
                </div>
              ) : (
                <div className="rounded-[22px] border border-border/70 bg-background/72 p-6 text-sm text-muted-foreground">
                  No hay datos diarios para graficar este ciclo.
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted-foreground">
              <LineChart className="size-5 opacity-40" aria-hidden="true" />
              No hay curva disponible para esta seleccion.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function buildMortalityBadge(data: MortalityCurvePayload | null, selectedCurve: SelectedMortalityCurveState) {
  return buildMortalityBadgeHelper(data, selectedCurve);
}

function MortalityCurveOverlay({
  selectedCurve,
  data,
  loading,
  error,
  onClose,
}: {
  selectedCurve: SelectedMortalityCurveState;
  data: MortalityCurvePayload | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
}) {
  const badgeLabel = buildMortalityBadge(data, selectedCurve);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 px-3 py-4 backdrop-blur-sm sm:px-4 sm:py-6 animate-in fade-in duration-150" role="dialog" aria-modal="true" aria-labelledby="modal-title-mortality">
      <button type="button" className="absolute inset-0 border-0 bg-transparent p-0" onClick={onClose} aria-label="Cerrar curva de mortandad" />
      <div className="relative z-10 flex max-h-[min(90dvh,960px)] w-full max-w-sm sm:max-w-2xl md:max-w-3xl lg:max-w-4xl xl:max-w-5xl 2xl:max-w-6xl min-w-0 flex-col overflow-hidden rounded-2xl border border-border/50 bg-card shadow-2xl shadow-slate-950/14 animate-in fade-in slide-in-from-bottom-4 duration-200">
        <div className="flex items-start justify-between gap-4 border-b border-border/50 bg-muted/20 px-4 py-4 sm:px-6">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="rounded-full px-3 py-1">
                Curva de mortandad
              </Badge>
              <Badge variant="secondary" className="rounded-full px-3 py-1">
                {badgeLabel}
              </Badge>
            </div>
            <div className="min-w-0">
              <h3 id="modal-title-mortality" className="text-2xl font-semibold tracking-tight">Tendencia diaria de mortandad</h3>
              <p className="break-words text-sm text-muted-foreground">
                Mortandad diaria y acumulada segun bajas, resiembras y plantas iniciales del ciclo.
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>

        <div className="overflow-y-auto px-4 py-5 sm:px-6">
          {loading ? (
            <div className="flex items-center gap-3 py-8 text-sm text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
              Cargando curva de mortandad.
            </div>
          ) : error ? (
            <div className="py-8 text-sm text-destructive">{error}</div>
          ) : data ? (
            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <MetricPill label="Plantas programadas" value={formatNumber(data.summary.programmedPlants)} />
                <MetricPill label="Plantas inicio ciclo" value={formatNumber(data.summary.initialPlantsCycle)} />
                <MetricPill label="Resiembras" value={formatNumber(data.summary.totalReseededPlants)} />
                <MetricPill label="Plantas muertas" value={formatNumber(data.summary.totalDeadPlants)} />
                <MetricPill
                  label="Plantas vigentes"
                  value={
                    data.summary.initialPlantsCycle > 0
                      ? formatNumber(
                        data.summary.initialPlantsCycle
                          - data.summary.totalDeadPlants
                          + data.summary.totalReseededPlants,
                      )
                      : "-"
                  }
                />
                <MetricPill label="Mortandad" value={formatPercent(data.summary.lastCumulativeMortalityPct)} />
                <MetricPill label="Mortandad diaria actual" value={formatPercent(data.summary.lastDailyMortalityPct)} />
                <MetricPill label="Pico diario" value={formatPercent(data.summary.maxDailyMortalityPct)} />
                <MetricPill
                  label="Disp. vs programadas"
                  value={
                    data.summary.programmedPlants && data.summary.programmedPlants > 0
                      ? formatPercent(
                        Math.round(
                          (((data.summary.initialPlantsCycle - data.summary.totalDeadPlants + data.summary.totalReseededPlants) / data.summary.programmedPlants) * 100) * 100,
                        ) / 100,
                      )
                      : "-"
                  }
                  hint="Plantas vigentes / plantas programadas"
                />
              </div>

              {data.points.length ? (
                <div className="rounded-[24px] border border-border/70 bg-background/72 p-4">
                  <MortalityCurvePanel data={data.points} />
                </div>
              ) : (
                <div className="rounded-[22px] border border-border/70 bg-background/72 p-6 text-sm text-muted-foreground">
                  No hay datos diarios de mortandad para esta seleccion.
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted-foreground">
              <LineChart className="size-5 opacity-40" aria-hidden="true" />
              No hay curva de mortandad disponible para esta seleccion.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CycleSelector({
  cycles,
  selectedCycleKey,
  onSelect,
}: {
  cycles: CycleProfileCard[];
  selectedCycleKey: string | null;
  onSelect: (cycleKey: string) => void;
}) {
  const sortedCycles = useMemo(
    () => [...cycles].sort((a, b) => {
      const dateA = a.validFrom ?? "";
      const dateB = b.validFrom ?? "";
      return dateB.localeCompare(dateA);
    }),
    [cycles],
  );

  return (
    <div className="relative">
      <select
        className="w-full appearance-none rounded-2xl border border-border/70 bg-background/80 px-4 py-3 pr-10 text-sm font-medium focus:border-slate-700/40 focus:outline-none focus:ring-2 focus:ring-slate-900/20"
        value={selectedCycleKey ?? ""}
        onChange={(event) => onSelect(event.target.value)}
      >
        {sortedCycles.map((cycle) => (
          <option key={cycle.cycleKey} value={cycle.cycleKey}>
            {cycle.cycleKey} — {deriveCycleOperationalStatus(cycle)}
          </option>
        ))}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4">
        <svg className="size-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>
  );
}

function ModalContent({
  data,
  filteredCycleKey,
  selectedCurveCycleKey,
  onOpenBeds,
  onOpenHours,
  onOpenValves,
  onOpenCurve,
  onOpenCycleMortalityCurve,
}: {
  data: CycleProfileBlockPayload;
  filteredCycleKey: string | null;
  selectedCurveCycleKey: string | null;
  onOpenBeds: (cycleKey: string) => void;
  onOpenHours: (cycle: CycleProfileCard) => void;
  onOpenValves: (cycleKey: string) => void;
  onOpenCurve: (cycleKey: string) => void;
  onOpenCycleMortalityCurve: (cycleKey: string) => void;
}) {
  const initialCycleKey = filteredCycleKey ?? data.cycles[0]?.cycleKey ?? null;
  const [activeCycleKey, setActiveCycleKey] = useState<string | null>(initialCycleKey);
  const [showProcessViewer, setShowProcessViewer] = useState(false);

  const cycle = useMemo(
    () => data.cycles.find((c) => c.cycleKey === activeCycleKey) ?? null,
    [data.cycles, activeCycleKey],
  );

  const aggregatedStatus = useMemo(
    () => resolveAggregatedOperationalStatus(data.cycles),
    [data.cycles],
  );

  const programmedPlantsTotal = useMemo(() => {
    // Use blockProgrammedPlants from the most current cycle (sum by block_id)
    const currentCycle = data.cycles.find((c) => c.isCurrent) ?? data.cycles[0] ?? null;
    return currentCycle?.blockProgrammedPlants ?? computeProgrammedPlantsAcrossCycles(data.cycles);
  }, [data.cycles]);

  const blockAggregates = useMemo(() => {
    let totalStemsForRatio = 0;
    let totalCurrentPlantsForRatio = 0;
    let totalGreenKg = 0;
    let totalBedArea = 0;
    let totalEffectiveHoursClosedCycles = 0;
    let totalCamas30ClosedCycles = 0;
    let closedCyclesCount = 0;
    for (const c of data.cycles) {
      // Only count cycles with programmed plants data for the tallos/planta ratio
      if ((c.programmedPlants ?? 0) > 0 && (c.currentPlants ?? 0) > 0) {
        totalStemsForRatio += c.totalStems ?? 0;
        totalCurrentPlantsForRatio += c.currentPlants!;
      }
      totalGreenKg += c.greenWeightKg ?? 0;
      totalBedArea += c.bedArea ?? 0;

      // Horas cama ponderado: only closed cycles
      if (c.status === "CLOSED" && c.effectiveHours !== null && c.effectiveHours > 0) {
        totalEffectiveHoursClosedCycles += c.effectiveHours;
        const camas30Cycle = computeCamas30(c.bedArea);
        if (camas30Cycle !== null && camas30Cycle > 0) {
          totalCamas30ClosedCycles += camas30Cycle;
          closedCyclesCount++;
        }
      }
    }
    const camas30 = totalBedArea > 0 ? totalBedArea / 30 : null;
    const cajasVerde = totalGreenKg > 0 ? totalGreenKg / 10 : null;
    return {
      tallosPlanta: totalStemsForRatio > 0 && totalCurrentPlantsForRatio > 0
        ? Math.round((totalStemsForRatio / totalCurrentPlantsForRatio) * 100) / 100
        : null,
      cajasCama: cajasVerde && camas30 ? Math.round((cajasVerde / camas30) * 100) / 100 : null,
      horasCama: totalEffectiveHoursClosedCycles > 0 && totalCamas30ClosedCycles > 0 && closedCyclesCount > 0
        ? Math.round((totalEffectiveHoursClosedCycles / (totalCamas30ClosedCycles * closedCyclesCount)) * 100) / 100
        : null,
    };
  }, [data.cycles]);

  const showCurveActive = selectedCurveCycleKey === activeCycleKey;

  return (
    <div className="space-y-6">
      {/* B1: Summary row — Estado actual + new KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <MetricPill
          label="Estado actual"
          value={aggregatedStatus}
          hint="Click para ver macroproceso"
          onClick={() => setShowProcessViewer(true)}
        />
        <MetricPill label="Tallos planta" value={formatNumber(blockAggregates.tallosPlanta)} hint="Tallos / plantas vigentes (todos ciclos)" />
        <MetricPill label="Cajas cama" value={formatNumber(blockAggregates.cajasCama)} hint="Cajas verde / camas 30m² (todos ciclos)" />
        <MetricPill
          label="Horas cama"
          value={formatNumber(blockAggregates.horasCama)}
          hint={cycle ? "Macro-ponderado de todos los ciclos. Click para ver el detalle del ciclo seleccionado" : "Macro-ponderado de todos los ciclos"}
          onClick={cycle ? () => onOpenHours(cycle) : undefined}
        />
        <MetricPill label="Costo cama" value="-" hint="Sin fuente conectada" />
        <MetricPill
          label="Plantas del programa"
          value={formatNumber(programmedPlantsTotal)}
          hint="Macro-ponderado de todos los ciclos"
        />
      </div>

      {/* B2: Cycle selector */}
      {data.cycles.length > 1 ? (
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Seleccionar ciclo</p>
          <CycleSelector
            cycles={data.cycles}
            selectedCycleKey={activeCycleKey}
            onSelect={setActiveCycleKey}
          />
        </div>
      ) : null}

      {/* B3: Selected cycle detail */}
      {cycle ? (
        <Card className="rounded-xl border-border/50 bg-card shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
          <CardHeader className="space-y-3 border-b border-border/40 pb-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="rounded-full px-3 py-1">{cycle.cycleKey}</Badge>
              <Badge
                variant={deriveCycleOperationalStatus(cycle) === "Activo" ? "secondary" : "outline"}
                className="rounded-full px-3 py-1"
              >
                {deriveCycleOperationalStatus(cycle)}
              </Badge>
            </div>
            <CardTitle className="text-base">
              Bloque {cycle.blockId || cycle.parentBlock}
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-1">
            {/* Fila 1: Identificación */}
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricPill label="Área" value={cycle.areaId || "-"} />
              <MetricPill label="Variedad" value={cycle.variety || "-"} />
              <MetricPill label="Tipo SP" value={cycle.spType || "-"} />
              <MetricPill label="Fase" value={deriveCyclePhase(cycle)} />
            </div>
            {/* Fila 2: Condiciones */}
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricPill label="Invernadero" value={cycle.greenhouse ? "Si" : "No"} />
              <MetricPill label="Luz" value={cycle.lightType && cycle.lightType.toLowerCase() !== "unknown" ? cycle.lightType : "-"} />
              <MetricPill label="Suelo" value={cycle.soilType || "-"} />
              <MetricPill label="Fecha SP" value={formatDate(cycle.pruningDate)} />
            </div>
            {/* Fila 3: Infraestructura */}
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricPill label="Camas 30 m²" value={formatNumber(computeCamas30(cycle.bedArea))} />
              <MetricPill
                label="Camas físicas"
                value={formatNumber(cycle.bedCount)}
                hint="Ver tabla de camas"
                onClick={() => onOpenBeds(cycle.cycleKey)}
              />
              <MetricPill
                label="Válvulas"
                value={formatNumber(cycle.valveCount)}
                hint="Ver detalle de válvulas"
                onClick={() => onOpenValves(cycle.cycleKey)}
              />
              <MetricPill label="Pambiles" value={formatNumber(cycle.pambilesCount)} />
            </div>
            {/* Fila 4: Plantas */}
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricPill label="Plantas programadas" value={formatNumber(cycle.programmedPlants)} />
              <MetricPill label="Plantas vigentes" value={formatNumber(cycle.currentPlants)} />
              <MetricPill label="Disp. vs programadas" value={formatPercent(cycle.availabilityVsScheduledPct)} />
              <MetricPill
                label="Mortandad"
                value={formatPercent(cycle.mortalityPct)}
                hint="Ver curva de mortandad"
                onClick={() => onOpenCycleMortalityCurve(cycle.cycleKey)}
              />
            </div>
            {/* Fila 5: Producción */}
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricPill
                label="Tallos / planta"
                value={cycle.totalStems && cycle.currentPlants ? formatNumber(Math.round((cycle.totalStems / cycle.currentPlants) * 100) / 100) : "-"}
              />
              <MetricPill
                label="Peso / tallo"
                value={cycle.greenWeightKg && cycle.totalStems ? `${formatNumber(Math.round((cycle.greenWeightKg / cycle.totalStems) * 1000 * 100) / 100)} g` : "-"}
              />
              <MetricPill
                label="Cajas / cama"
                value={cycle.greenWeightKg && cycle.bedArea ? formatNumber(Math.round(((cycle.greenWeightKg / 10) / computeCamas30(cycle.bedArea)!) * 100) / 100) : "-"}
              />
              <MetricPill
                label="Cajas verde"
                value={cycle.greenWeightKg ? formatNumber(Math.round((cycle.greenWeightKg / 10) * 100) / 100) : "-"}
              />
            </div>
            {/* Fila 6: Fechas y post */}
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricPill
                label="Cajas blanco"
                value={cycle.postWeightKg ? formatNumber(Math.round((cycle.postWeightKg / 10) * 100) / 100) : "-"}
                hint="Estimado proporcional"
              />
              <MetricPill label="Inicio cosecha" value={formatDate(cycle.harvestStartDate)} />
              <MetricPill label="Fin cosecha" value={formatDate(cycle.harvestEndDate)} />
              <MetricPill
                label="Horas cama"
                value={formatNumber(computeHorasCama(cycle.effectiveHours, cycle.bedArea))}
                hint="Horas trabajadas / camas 30m²"
                onClick={() => onOpenHours(cycle)}
              />
            </div>
          </CardContent>

          <CardContent className="flex flex-wrap gap-2 border-t border-border/60 pt-4">
            <Button
              variant={showCurveActive ? "secondary" : "outline"}
              className="rounded-xl"
              onClick={() => onOpenCurve(cycle.cycleKey)}
            >
              <LineChart className="size-4" aria-hidden="true" />
              Curva de cosecha por ciclo
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-[22px] border border-border/70 bg-background/72 p-6 text-center text-sm text-muted-foreground">
          <Sprout className="size-5 opacity-40" aria-hidden="true" />
          No hay ciclos disponibles para este bloque con el criterio actual.
        </div>
      )}

      {/*
        BPMN del macroproceso de campo.
        Asset esperado: public/processes/campo-macroproceso-es.bpmn
        Si el archivo no existe, el visor mostrará un error informativo.
        Para conectar: crear el archivo BPMN y colocarlo en public/processes/.
      */}
      {showProcessViewer ? (
        <ProcessViewerOverlay
          title="Macroproceso de campo"
          subtitle="Flujo operativo del ciclo productivo. El asset BPMN debe colocarse en public/processes/campo-macroproceso-es.bpmn"
          assetPath="/processes/campo-macroproceso-es.bpmn"
          onClose={() => setShowProcessViewer(false)}
        />
      ) : null}
    </div>
  );
}

function ValveDetailPanel({
  data,
  loading,
  error,
  onOpenMortalityCurve,
}: {
  data: ValveProfilePayload | null;
  loading: boolean;
  error: string | null;
  onOpenMortalityCurve?: () => void;
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-3 py-4 text-sm text-muted-foreground">
        <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
        Cargando detalle de la valvula.
      </div>
    );
  }

  if (error) {
    return <div className="py-4 text-sm text-destructive">{error}</div>;
  }

  if (!data || !data.valve) {
    return (
      <div className="flex flex-col items-center gap-2 py-4 text-center text-sm text-muted-foreground">
        <Rows3 className="size-5 opacity-40" aria-hidden="true" />
        No hay detalle de valvula disponible para esta seleccion.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricPill label="Valvula" value={getValveDisplayName(data.valve.valveName, data.valve.valveId)} />
        <MetricPill label="Bloque" value={data.valve.blockId || data.valve.parentBlock || "-"} />
        <MetricPill label="Camas 30 m²" value={formatNumber(computeCamas30(data.summary.totalBedArea))} />
        <MetricPill label="Camas fisicas" value={formatNumber(data.valve.bedCount)} />
        <MetricPill label="Pambiles" value={formatNumber(data.valve.pambilesCount)} />
        <MetricPill label="Plantas programadas" value={formatNumber(data.valve.programmedPlants)} />
        <MetricPill label="Inicio de ciclo" value={formatNumber(data.valve.cycleStartPlants)} />
        <MetricPill label="Plantas vigentes" value={formatNumber(data.valve.currentPlants)} />
        <MetricPill label="Bajas acumuladas" value={formatNumber(data.valve.deadPlants)} />
        <MetricPill label="Resiembras" value={formatNumber(data.valve.reseededPlants)} />
        <MetricPill label="Disp. vs programadas" value={formatPercent(data.valve.availabilityVsScheduledPct)} />
        <MetricPill
          label="Mortandad"
          value={formatPercent(data.valve.mortalityPct)}
          hint="Click para ver curva de mortandad"
          onClick={onOpenMortalityCurve}
        />
      </div>

      <div className="rounded-[20px] border border-border/70 bg-background/72 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
              Camas de la valvula
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {getValveDisplayName(data.valve.valveName, data.valve.valveId)} / Bloque {data.valve.blockId || data.valve.parentBlock || "-"}
            </p>
          </div>
          <DetailBadges
            items={[
              `${data.summary.totalBeds} camas fisicas`,
              `${formatNumber(data.summary.totalProgrammedPlants)} programadas`,
              `${formatNumber(data.summary.totalCurrentPlants)} vigentes`,
            ]}
          />
        </div>
      </div>
    </div>
  );
}

function ValvesSection({
  cycleKey,
  data,
  loading,
  error,
  selectedValve,
  onOpenValveBedsOverlay,
  onOpenValveMortalityCurve,
}: {
  cycleKey: string;
  data: ValveProfilesByCyclePayload | null;
  loading: boolean;
  error: string | null;
  selectedValve: { cycleKey: string; valveId: string } | null;
  onOpenValveBedsOverlay: (cycleKey: string, valveId: string) => void;
  onOpenValveMortalityCurve: (cycleKey: string, valveId: string) => void;
}) {
  return (
    <div className="rounded-[22px] border border-border/70 bg-card/88 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
            Detalle de valvulas
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{cycleKey}</p>
        </div>
        {data && data.cycleKey === cycleKey ? (
          <DetailBadges
            items={[
              `${data.summary.totalValves} valvulas`,
              `${formatNumber(data.summary.totalProgrammedPlants)} programadas`,
              `${formatNumber(data.summary.totalCurrentPlants)} vigentes`,
            ]}
          />
        ) : null}
      </div>

      {loading ? (
        <div className="flex items-center gap-3 py-6 text-sm text-muted-foreground">
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          Cargando detalle de valvulas.
        </div>
      ) : error ? (
        <div className="py-6 text-sm text-destructive">{error}</div>
      ) : data && data.cycleKey === cycleKey ? (
        data.valves.length ? (
          <div className="mt-4 grid gap-3 xl:grid-cols-2">
            {data.valves.map((valve) => {
              const isSelected =
                selectedValve?.cycleKey === cycleKey && selectedValve?.valveId === valve.valveId;

              return (
                <div
                  key={valve.recordId}
                  className={cn(
                    "rounded-2xl border border-border/70 bg-background/82 p-4",
                    isSelected && "border-slate-700/30",
                  )}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Badge className="rounded-full px-3 py-1">
                      {getValveDisplayName(valve.valveName, valve.valveId)}
                    </Badge>
                    <div className="flex flex-wrap gap-2">
                      {(valve.blockId || valve.parentBlock) ? (
                        <Badge variant="outline" className="rounded-full px-3 py-1">
                          Bloque {valve.blockId || valve.parentBlock}
                        </Badge>
                      ) : null}
                      <Badge
                        variant={valve.isCurrent && valve.isValid ? "secondary" : "outline"}
                        className="rounded-full px-3 py-1"
                      >
                        {valve.isCurrent && valve.isValid
                          ? "Activo"
                          : !valve.isCurrent && valve.isValid
                            ? "Cerrado"
                            : "Planificado"}
                      </Badge>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    <MetricPill label="Pambiles" value={formatNumber(valve.pambilesCount)} />
                    <MetricPill label="Plantas programadas" value={formatNumber(valve.programmedPlants)} />
                    <MetricPill label="Plantas vigentes" value={formatNumber(valve.currentPlants)} />
                    <MetricPill label="Inicio de ciclo" value={formatNumber(valve.cycleStartPlants)} />
                    <MetricPill label="Bajas acumuladas" value={formatNumber(valve.deadPlants)} />
                    <MetricPill label="Resiembras" value={formatNumber(valve.reseededPlants)} />
                    <MetricPill label="Disp. vs prog." value={formatPercent(valve.availabilityVsScheduledPct)} />
                    <MetricPill
                      label="Mortandad"
                      value={formatPercent(valve.mortalityPct)}
                      hint="Click para ver curva"
                      onClick={() => onOpenValveMortalityCurve(cycleKey, valve.valveId)}
                    />
                    <MetricPill label="Camas 30 m²" value={formatNumber(computeCamas30(valve.bedArea))} />
                    <MetricPill
                      label="Camas fisicas"
                      value={formatNumber(valve.bedCount)}
                      hint="Click para ver camas"
                      onClick={() => onOpenValveBedsOverlay(cycleKey, valve.valveId)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-6 text-center text-sm text-muted-foreground">
            <Rows3 className="size-5 opacity-40" aria-hidden="true" />
            No hay valvulas registradas para este ciclo.
          </div>
        )
      ) : null}
    </div>
  );
}

function ValvesOverlay({
  cycleKey,
  data,
  loading,
  error,
  selectedValve,
  onOpenValveBedsOverlay,
  onOpenValveMortalityCurve,
  onClose,
}: {
  cycleKey: string;
  data: ValveProfilesByCyclePayload | null;
  loading: boolean;
  error: string | null;
  selectedValve: { cycleKey: string; valveId: string } | null;
  onOpenValveBedsOverlay: (cycleKey: string, valveId: string) => void;
  onOpenValveMortalityCurve: (cycleKey: string, valveId: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center bg-black/40 px-3 py-4 backdrop-blur-sm sm:px-4 sm:py-6 animate-in fade-in duration-150" role="dialog" aria-modal="true" aria-labelledby="modal-title-valves">
      <button type="button" className="absolute inset-0 border-0 bg-transparent p-0" onClick={onClose} aria-label="Cerrar valvulas del ciclo" />
      <div className="relative z-10 flex max-h-[min(90dvh,960px)] w-full max-w-sm sm:max-w-2xl md:max-w-3xl lg:max-w-4xl xl:max-w-5xl 2xl:max-w-6xl min-w-0 flex-col overflow-hidden rounded-2xl border border-border/50 bg-card shadow-2xl shadow-slate-950/14 animate-in fade-in slide-in-from-bottom-4 duration-200">
        <div className="flex items-start justify-between gap-4 border-b border-border/50 bg-muted/20 px-4 py-4 sm:px-6">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="rounded-full px-3 py-1">
                Valvulas del ciclo
              </Badge>
              <Badge variant="secondary" className="rounded-full px-3 py-1">
                {cycleKey}
              </Badge>
            </div>
            <div className="min-w-0">
              <h3 id="modal-title-valves" className="text-2xl font-semibold tracking-tight">Ventana flotante de valvulas</h3>
              <p className="break-words text-sm text-muted-foreground">
                Vista completa del ciclo con apertura de detalle y camas asociadas por valvula.
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>

        <div className="overflow-y-auto px-4 py-5 sm:px-6">
          <ValvesSection
            cycleKey={cycleKey}
            data={data}
            loading={loading}
            error={error}
            selectedValve={selectedValve}
            onOpenValveBedsOverlay={onOpenValveBedsOverlay}
            onOpenValveMortalityCurve={onOpenValveMortalityCurve}
          />
        </div>
      </div>
    </div>
  );
}

export function BlockProfileModal({
  row,
  data,
  loading,
  error,
  selectedCycleKey,
  bedData,
  bedLoading,
  bedError,
  selectedValveCycleKey,
  valvesData,
  valvesLoading,
  valvesError,
  selectedValve,
  valveData,
  valveLoading,
  valveError,
  selectedCurveCycleKey,
  curveData,
  curveLoading,
  curveError,
  selectedMortalityCurve,
  mortalityCurveData,
  mortalityCurveLoading,
  mortalityCurveError,
  onOpenBeds,
  onCloseBeds,
  onOpenValves,
  onCloseValves,
  onOpenValve,
  onOpenCurve,
  onCloseCurve,
  onOpenCycleMortalityCurve,
  onOpenValveMortalityCurve,
  onOpenBedMortalityCurve,
  onCloseMortalityCurve,
  onClose,
  directMode = false,
}: {
  row: BlockModalRow | null;
  data: CycleProfileBlockPayload | null;
  loading: boolean;
  error: string | null;
  selectedCycleKey: string | null;
  bedData: BedProfilePayload | null;
  bedLoading: boolean;
  bedError: string | null;
  selectedValveCycleKey: string | null;
  valvesData: ValveProfilesByCyclePayload | null;
  valvesLoading: boolean;
  valvesError: string | null;
  selectedValve: { cycleKey: string; valveId: string } | null;
  valveData: ValveProfilePayload | null;
  valveLoading: boolean;
  valveError: string | null;
  selectedCurveCycleKey: string | null;
  curveData: HarvestCurvePayload | null;
  curveLoading: boolean;
  curveError: string | null;
  selectedMortalityCurve: SelectedMortalityCurveState | null;
  mortalityCurveData: MortalityCurvePayload | null;
  mortalityCurveLoading: boolean;
  mortalityCurveError: string | null;
  onOpenBeds: (cycleKey: string) => void;
  onCloseBeds: () => void;
  onOpenValves: (cycleKey: string) => void;
  onCloseValves: () => void;
  onOpenValve: (cycleKey: string, valveId: string) => void;
  onOpenCurve: (cycleKey: string) => void;
  onCloseCurve: () => void;
  onOpenCycleMortalityCurve: (cycleKey: string) => void;
  onOpenValveMortalityCurve: (cycleKey: string, valveId: string) => void;
  onOpenBedMortalityCurve: (cycleKey: string, bedId: string) => void;
  onCloseMortalityCurve: () => void;
  onClose: () => void;
  /** When true the main block summary panel is hidden; navigation goes directly to the overlay panel */
  directMode?: boolean;
}) {
  const [selectedValveBeds, setSelectedValveBeds] = useState<{ cycleKey: string; valveId: string } | null>(null);
  // Guardamos el ciclo completo para evitar mismatch de keys entre ModalContent y BlockProfileModal
  const [selectedHoursCycle, setSelectedHoursCycle] = useState<CycleProfileCard | null>(null);
  const selectedHoursCycleKey = selectedHoursCycle?.cycleKey ?? null;
  const hoursRequest = buildCycleHoursRequest(selectedHoursCycleKey);
  const {
    data: hoursData,
    error: hoursRequestError,
    isLoading: hoursLoading,
  } = useSWRImmutable<CycleLaborHoursPayload>(hoursRequest, swrHoursFetcher, {
    revalidateOnFocus: false,
  });

  useEffect(() => {
    if (!row) {
      return;
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }

      if (selectedValveBeds) {
        setSelectedValveBeds(null);
        return;
      }

      if (selectedHoursCycleKey) {
        setSelectedHoursCycle(null);
        return;
      }

      if (selectedCurveCycleKey) {
        onCloseCurve();
        return;
      }

      if (selectedMortalityCurve) {
        onCloseMortalityCurve();
        return;
      }

      if (selectedValveCycleKey) {
        onCloseValves();
        return;
      }

      if (selectedCycleKey) {
        onCloseBeds();
        return;
      }

      onClose();
    }

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [
    onClose,
    onCloseBeds,
    onCloseCurve,
    onCloseMortalityCurve,
    onCloseValves,
    row,
    selectedCurveCycleKey,
    selectedHoursCycleKey,
    selectedCycleKey,
    selectedMortalityCurve,
    selectedValveCycleKey,
    selectedValveBeds,
  ]);

  if (!row) {
    return null;
  }

  const showingFilteredCycle = Boolean(data?.filteredCycleKey);
  // hoursCycle: usamos el objeto guardado directamente (evita mismatch de keys)
  const hoursCycle = selectedHoursCycle;

  function openValveBedsOverlay(cycleKey: string, valveId: string) {
    onOpenValve(cycleKey, valveId);
    setSelectedValveBeds({ cycleKey, valveId });
  }

  function openBedMortality(cycleKey: string, bedId: string) {
    setSelectedValveBeds(null);
    onOpenBedMortalityCurve(cycleKey, bedId);
  }

  function openValveMortality(cycleKey: string, valveId: string) {
    setSelectedValveBeds(null);
    onOpenValveMortalityCurve(cycleKey, valveId);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-3 py-4 backdrop-blur-sm sm:px-4 sm:py-6 animate-in fade-in duration-150" role="dialog" aria-modal="true" aria-labelledby="modal-title-block">
      <button type="button" className="absolute inset-0 border-0 bg-transparent p-0" onClick={onClose} aria-label="Cerrar ficha del bloque" />
      <div className={cn("relative z-10 flex max-h-[min(90dvh,960px)] w-full max-w-sm sm:max-w-2xl md:max-w-3xl lg:max-w-4xl xl:max-w-5xl 2xl:max-w-6xl min-w-0 flex-col overflow-hidden rounded-2xl border border-border/50 bg-card shadow-2xl shadow-slate-950/14 animate-in fade-in slide-in-from-bottom-4 duration-200", directMode && "pointer-events-none opacity-0 invisible")}>
        <div className="flex items-start justify-between gap-4 border-b border-border/50 bg-muted/20 px-4 py-4 sm:px-6">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="rounded-full px-3 py-1">
                Bloque {row.block}
              </Badge>
              {showingFilteredCycle ? (
                <Badge variant="secondary" className="rounded-full px-3 py-1">
                  Ciclo de la fila
                </Badge>
              ) : (
                <Badge variant="outline" className="rounded-full px-3 py-1">
                  Historial del bloque
                </Badge>
              )}
            </div>
            <div className="min-w-0">
              <h2 id="modal-title-block" className="text-2xl font-semibold tracking-tight">Ficha del bloque</h2>
              <p className="break-words text-sm text-muted-foreground">
                {row.area || "Sin area"} / {row.variety || "Sin variedad"} / {row.spType || "Sin SP"} / {showingFilteredCycle ? "ciclo filtrado" : "todos los ciclos del bloque"}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>

        <div className="overflow-y-auto px-4 py-5 sm:px-6">
          {loading ? (
            <div className="flex items-center gap-3 py-10 text-sm text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
              Cargando ciclos del bloque.
            </div>
          ) : error ? (
            <div className="py-10 text-sm text-destructive">{error}</div>
          ) : data ? (
            <ModalContent
              data={data}
              filteredCycleKey={data.filteredCycleKey}
              selectedCurveCycleKey={selectedCurveCycleKey}
              onOpenBeds={onOpenBeds}
              onOpenHours={setSelectedHoursCycle}
              onOpenValves={onOpenValves}
              onOpenCurve={onOpenCurve}
              onOpenCycleMortalityCurve={onOpenCycleMortalityCurve}
            />
          ) : null}
        </div>
      </div>

      {selectedCycleKey ? (
        <BedsOverlay
          cycleKey={selectedCycleKey}
          data={bedData}
          loading={bedLoading}
          error={bedError}
          selectedValve={selectedValve}
          valveData={valveData}
          valveLoading={valveLoading}
          valveError={valveError}
          onOpenValve={onOpenValve}
          onOpenValveBedsOverlay={openValveBedsOverlay}
          onOpenBedMortalityCurve={openBedMortality}
          onOpenValveMortalityCurve={openValveMortality}
          onClose={() => { onCloseBeds(); if (directMode) onClose(); }}
        />
      ) : null}

      {selectedCurveCycleKey ? (
        <HarvestCurveOverlay
          cycleKey={selectedCurveCycleKey}
          data={curveData}
          loading={curveLoading}
          error={curveError}
          onClose={onCloseCurve}
        />
      ) : null}

      {hoursCycle ? (
        <HoursCamaOverlay
          key={hoursCycle.cycleKey}
          cycle={hoursCycle}
          data={hoursData ?? null}
          loading={hoursLoading}
          error={hoursRequestError instanceof Error ? hoursRequestError.message : null}
          onClose={() => setSelectedHoursCycle(null)}
        />
      ) : null}

      {selectedValveCycleKey ? (
        <ValvesOverlay
          cycleKey={selectedValveCycleKey}
          data={valvesData}
          loading={valvesLoading}
          error={valvesError}
          selectedValve={selectedValve}
          onOpenValveBedsOverlay={openValveBedsOverlay}
          onOpenValveMortalityCurve={openValveMortality}
          onClose={() => { onCloseValves(); if (directMode) onClose(); }}
        />
      ) : null}

      {selectedValveBeds
      && selectedValve
      && selectedValve.cycleKey === selectedValveBeds.cycleKey
      && selectedValve.valveId === selectedValveBeds.valveId ? (
        <ValveBedsOverlay
          data={valveData}
          loading={valveLoading}
          error={valveError}
          onOpenBedMortalityCurve={openBedMortality}
          onClose={() => setSelectedValveBeds(null)}
        />
      ) : null}

      {selectedMortalityCurve ? (
        <MortalityCurveOverlay
          selectedCurve={selectedMortalityCurve}
          data={mortalityCurveData}
          loading={mortalityCurveLoading}
          error={mortalityCurveError}
          onClose={onCloseMortalityCurve}
        />
      ) : null}
    </div>
  );
}
