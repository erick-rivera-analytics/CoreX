"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { LoaderCircle } from "lucide-react";
import useSWRImmutable from "swr/immutable";

import { PersonMedicalPanel } from "@/components/dashboard/person-medical-panel";
import { Badge } from "@/shared/ui/badge";
import { MetricTile } from "@/shared/data-display/metric-tile";
import { SheetShell } from "@/shared/overlays/sheet-shell";
import { fetchJson } from "@/lib/fetch-json";
import { formatFlexibleNumber as formatNumber, formatPercent } from "@/shared/lib/format";
import { cn } from "@/lib/utils";
import type { CycleLaborPersonDetailPayload } from "@/lib/fenograma";

function formatProductivity(value: number | null, fallback = "-") {
  if (value === null) {
    return fallback;
  }

  return formatNumber(value);
}

function buildCycleHoursPersonRequest(cycleKey: string, personId: string | null) {
  if (!personId) {
    return null;
  }

  return [
    `/api/fenograma/cycle/${encodeURIComponent(cycleKey)}/hours/person/${encodeURIComponent(personId)}`,
    "No se pudo cargar la ficha de horas del personal.",
  ] as const;
}

async function swrPersonHoursFetcher<T>([url, fallbackMessage]: readonly [string, string]) {
  return fetchJson<T>(url, fallbackMessage);
}

function computeHorasCama(effectiveHours: number | null, camas30: number | null) {
  if (effectiveHours === null || camas30 === null || camas30 <= 0) {
    return null;
  }

  return Math.round((effectiveHours / camas30) * 100) / 100;
}

function DetailBadges({
  items,
}: {
  items: string[];
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <Badge key={item} variant="outline" className="rounded-full px-3 py-1">
          {item}
        </Badge>
      ))}
    </div>
  );
}

function InfoField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-muted/18 px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/65">
        {label}
      </p>
      <p className="mt-2 text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

function HoursPerformanceDonut({
  percentage,
}: {
  percentage: number | null;
}) {
  const hasPercentage = percentage !== null;
  const normalizedPercentage = Math.max(0, Math.min(percentage ?? 0, 100));
  const chartStyle = {
    background: `conic-gradient(var(--color-chart-success-bold) 0 ${normalizedPercentage}%, var(--color-muted) ${normalizedPercentage}% 100%)`,
  } as const;

  return (
    <div className="rounded-2xl border border-border/60 bg-card px-4 py-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <div className="flex items-center gap-4">
        <div
          className="relative h-28 w-28 shrink-0 rounded-full shadow-inner"
          style={chartStyle}
          aria-hidden="true"
        >
          <div className="absolute inset-[16px] flex items-center justify-center rounded-full border border-border/50 bg-card text-center text-xs font-semibold tabular-nums text-foreground">
            {hasPercentage ? formatPercent(percentage) : "Sin dato"}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/65">
            % Horas rendimiento
          </p>
          <p className="text-2xl font-semibold tabular-nums">
            {formatPercent(percentage)}
          </p>
          <p className="max-w-[18rem] text-xs text-muted-foreground">
            Horas presenciales con medida distinta de H. Normales sobre el total de horas presenciales.
          </p>
        </div>
      </div>
    </div>
  );
}

export function PersonHoursOverlay({
  cycleKey,
  personId,
  camas30,
  onClose,
}: {
  cycleKey: string;
  personId: string;
  camas30: number | null;
  onClose: () => void;
}) {
  const [view, setView] = useState<"info" | "performance" | "medical">("info");
  const personRequest = buildCycleHoursPersonRequest(cycleKey, personId);
  const {
    data,
    error,
    isLoading,
  } = useSWRImmutable<CycleLaborPersonDetailPayload>(personRequest, swrPersonHoursFetcher, {
    revalidateOnFocus: false,
  });

  const totalEffectiveHours = data?.summary.totalEffectiveHours ?? 0;
  const totalActualHours = data?.summary.totalActualHours ?? 0;
  const horasCama = computeHorasCama(totalEffectiveHours, camas30);
  const profile = data?.profile ?? null;
  const displayName = profile?.fullName ?? `Personal ${personId}`;
  const requestError = error instanceof Error ? error.message : null;

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      onClose();
    }

    window.addEventListener("keydown", handleEscape, true);
    return () => window.removeEventListener("keydown", handleEscape, true);
  }, [onClose]);

  const overlayContent = (
    <SheetShell
      title={displayName}
      description={profile?.jobTitle ?? "Personal de campo"}
      onClose={onClose}
      widthClassName="max-w-6xl"
      headerActions={
            <div className="flex flex-wrap justify-end gap-2">
              <Badge variant="outline" className="rounded-full px-3 py-1">
                Ficha del personal
              </Badge>
              <Badge variant="secondary" className="rounded-full px-3 py-1">
                ID {personId}
              </Badge>
              <Badge variant="outline" className="rounded-full px-3 py-1">
                {cycleKey}
              </Badge>
            </div>
      }
    >
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

            {isLoading ? (
              <div className="flex items-center gap-3 py-8 text-sm text-muted-foreground">
                <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                Cargando ficha del personal.
              </div>
            ) : requestError ? (
              <div className="py-8 text-sm text-destructive">{requestError}</div>
            ) : data ? (
              view === "info" ? (
                <div className="space-y-5">
                  <div className="rounded-2xl border border-border/60 bg-muted/14 px-5 py-5">
                    <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/65">
                      Datos personales
                    </p>
                    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
                      <InfoField label="Nombre completo" value={profile?.fullName ?? "Sin dato"} />
                      <InfoField label="Cedula / ID" value={profile?.nationalId ?? "Sin dato"} />
                      <InfoField label="Genero" value={profile?.gender ?? "Sin dato"} />
                      <InfoField label="Estado civil" value={profile?.maritalStatus ?? "Sin dato"} />
                      <InfoField label="Fecha de nacimiento" value={profile?.birthDate ?? "Sin dato"} />
                      <InfoField label="Lugar de nacimiento" value={profile?.birthPlace ?? "Sin dato"} />
                      <InfoField label="Nacionalidad" value={profile?.nationality ?? "Sin dato"} />
                      <InfoField label="Nivel educativo" value={profile?.educationTitle ?? "Sin dato"} />
                      <InfoField label="Hijos" value={profile?.childrenCount == null ? "Sin dato" : String(profile.childrenCount)} />
                      <InfoField label="Dependientes" value={profile?.dependentsCount == null ? "Sin dato" : String(profile.dependentsCount)} />
                      <InfoField label="Discapacidad" value={profile?.disabledFlag == null ? "Sin dato" : profile.disabledFlag ? "Si" : "No"} />
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border/60 bg-muted/14 px-5 py-5">
                    <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/65">
                      Datos laborales
                    </p>
                    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
                      <InfoField label="Cargo" value={profile?.jobTitle ?? "Sin dato"} />
                      <InfoField label="Tipo de empleado" value={profile?.employeeType ?? "Sin dato"} />
                      <InfoField label="Tipo de contrato" value={profile?.contractType ?? "Sin dato"} />
                      <InfoField label="Clasificacion de cargo" value={profile?.jobClassificationCode ?? "Sin dato"} />
                      <InfoField label="Empleador" value={profile?.employerName ?? "Sin dato"} />
                      <InfoField label="Codigo de finca" value={profile?.farmCode ?? "Sin dato"} />
                      <InfoField label="Trabajador asociado" value={profile?.associatedWorkerName ?? "Sin dato"} />
                      <InfoField label="Pago por rendimiento" value={profile?.performancePayApplicable == null ? "Sin dato" : profile.performancePayApplicable ? "Si" : "No"} />
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border/60 bg-muted/14 px-5 py-5">
                    <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/65">
                      Contacto
                    </p>
                    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
                      <InfoField label="Email" value={profile?.email ?? "Sin dato"} />
                      <InfoField label="Telefono" value={profile?.phoneNumber ?? "Sin dato"} />
                      <InfoField label="Direccion" value={profile?.address ?? "Sin dato"} />
                      <InfoField label="Ciudad" value={profile?.city ?? "Sin dato"} />
                      <InfoField label="Parroquia" value={profile?.parish ?? "Sin dato"} />
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border/60 bg-muted/14 px-5 py-5">
                    <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/65">
                      Acceso a la empresa
                    </p>
                    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
                      <InfoField label="Ultima entrada" value={profile?.lastEntryDate ?? "Sin dato"} />
                      <InfoField label="Ultima salida" value={profile?.lastExitDate ?? "Sin dato"} />
                    </div>
                  </div>
                </div>
              ) : view === "performance" ? (
                <div className="space-y-5">
                  <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
                    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
                      <MetricTile
                        label="Horas presenciales"
                        value={formatNumber(totalActualHours)}
                        hint="Actual hours del personal"
                      />
                      <MetricTile
                        label="Horas trabajadas"
                        value={formatNumber(totalEffectiveHours)}
                        hint="Effective hours del personal"
                      />
                      <MetricTile
                        label="Horas cama"
                        value={formatNumber(horasCama)}
                        hint="Horas trabajadas / camas 30 m2 del ciclo"
                      />
                      <MetricTile
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
                              {formatNumber(computeHorasCama(activity.effectiveHours, camas30))}
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
    </SheetShell>
  );

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(overlayContent, document.body);
}
