"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { LoaderCircle, X } from "lucide-react";
import useSWRImmutable from "swr/immutable";

import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { fetchJson } from "@/lib/fetch-json";
import { formatInteger, formatDecimal } from "@/shared/lib/format";
import type {
  MedicalExamMarker,
  MedicalMarkerColor,
  MedicalMarkerField,
  MedicalPersonExam,
  MedicalPersonPayload,
} from "@/lib/salud";
import { cn } from "@/lib/utils";

type MarkerTrendPoint = {
  examId: number;
  date: string;
  type: string;
  value: number;
  deltaPct: number | null;
  marker: MedicalExamMarker;
};

function buildMedicalPersonRequest(personId: string) {
  return [
    `/api/medical/person/${encodeURIComponent(personId)}`,
    "No se pudo cargar la ficha medica del personal.",
  ] as const;
}

async function medicalFetcher<T>([url, fallbackMessage]: readonly [string, string]) {
  return fetchJson<T>(url, fallbackMessage);
}


function formatSignedPercent(value: number | null) {
  if (value === null) {
    return "-";
  }

  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

function formatDisplayDate(value: string) {
  if (!value || value === "-") {
    return "-";
  }

  const [year, month, day] = value.split("-");

  if (!year || !month || !day) {
    return value;
  }

  return `${day}/${month}/${year}`;
}

function getMarkerTone(color: MedicalMarkerColor) {
  if (color === "green") {
    return {
      badge: "border-emerald-200 bg-slate-50 text-slate-700",
      border: "border-emerald-200/80",
      shadow: "shadow-emerald-950/5",
    };
  }

  if (color === "yellow") {
    return {
      badge: "border-slate-200 bg-slate-50 text-slate-700",
      border: "border-slate-200/80",
      shadow: "shadow-amber-950/5",
    };
  }

  if (color === "red") {
    return {
      badge: "border-slate-200 bg-slate-50 text-slate-700",
      border: "border-slate-200/80",
      shadow: "shadow-rose-950/5",
    };
  }

  return {
    badge: "border-slate-200 bg-slate-50 text-slate-600",
    border: "border-border/60",
    shadow: "shadow-slate-950/5",
  };
}

function buildMarkerSeries(exams: MedicalPersonExam[], field: MedicalMarkerField) {
  const chronologicalExams = [...exams].reverse();
  const points: MarkerTrendPoint[] = [];

  for (const exam of chronologicalExams) {
    const marker = exam.markers.find((item) => item.field === field);
    if (!marker || marker.value === null) {
      continue;
    }

    const previousPoint = points[points.length - 1] ?? null;
    const deltaPct =
      previousPoint && previousPoint.value !== 0
        ? ((marker.value - previousPoint.value) / previousPoint.value) * 100
        : null;

    points.push({
      examId: exam.examId,
      date: exam.date,
      type: exam.type,
      value: marker.value,
      deltaPct,
      marker,
    });
  }

  return {
    marker: points[points.length - 1]?.marker ?? null,
    points,
    recentPoints: points.slice(-5),
  };
}

function resolveDirection(points: MarkerTrendPoint[]) {
  if (points.length < 2) {
    return "Sin historia";
  }

  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];

  if (!firstPoint || !lastPoint || firstPoint.value === 0) {
    return "Sin historia";
  }

  const percentChange = ((lastPoint.value - firstPoint.value) / firstPoint.value) * 100;

  if (Math.abs(percentChange) < 5) {
    return "Estable";
  }

  return percentChange > 0 ? "Al alza" : "A la baja";
}

function SummaryCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card px-4 py-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/65">
        {label}
      </p>
      <p className="mt-2 text-xl font-semibold text-foreground">{value}</p>
      {hint ? (
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

function MarkerTrendChart({
  points,
}: {
  points: MarkerTrendPoint[];
}) {
  if (!points.length) {
    return (
      <div className="rounded-2xl border border-dashed border-border/70 bg-muted/14 px-4 py-10 text-center text-sm text-muted-foreground">
        No hay resultados validos para construir la serie.
      </div>
    );
  }

  const width = 760;
  const height = 300;
  const paddingLeft = 56;
  const paddingRight = 24;
  const paddingTop = 24;
  const paddingBottom = 44;
  const valueList = points.map((point) => point.value);
  const referenceLow = points.find((point) => point.marker.referenceLow !== null)?.marker.referenceLow ?? null;
  const referenceHigh = points.find((point) => point.marker.referenceHigh !== null)?.marker.referenceHigh ?? null;

  const minValue = Math.min(
    ...valueList,
    referenceLow ?? Number.POSITIVE_INFINITY,
    referenceHigh ?? Number.POSITIVE_INFINITY,
  );
  const maxValue = Math.max(
    ...valueList,
    referenceLow ?? Number.NEGATIVE_INFINITY,
    referenceHigh ?? Number.NEGATIVE_INFINITY,
  );

  const safeMin = Number.isFinite(minValue) ? minValue : 0;
  const safeMax = Number.isFinite(maxValue) ? maxValue : 1;
  const range = safeMax === safeMin ? Math.max(Math.abs(safeMax) * 0.15, 1) : (safeMax - safeMin) * 0.15;
  const chartMin = safeMin - range;
  const chartMax = safeMax + range;

  function scaleX(index: number) {
    if (points.length === 1) {
      return width / 2;
    }

    return paddingLeft + ((width - paddingLeft - paddingRight) * index) / (points.length - 1);
  }

  function scaleY(value: number) {
    const drawableHeight = height - paddingTop - paddingBottom;
    return paddingTop + ((chartMax - value) / (chartMax - chartMin || 1)) * drawableHeight;
  }

  const polyline = points
    .map((point, index) => `${scaleX(index)},${scaleY(point.value)}`)
    .join(" ");

  return (
    <div className="overflow-x-auto rounded-2xl border border-border/60 bg-card px-3 py-3">
      <svg viewBox={`0 0 ${width} ${height}`} className="min-w-[680px]">
        <line
          x1={paddingLeft}
          y1={height - paddingBottom}
          x2={width - paddingRight}
          y2={height - paddingBottom}
          stroke="var(--color-border)"
          strokeWidth="1"
        />
        {referenceLow !== null ? (
          <line
            x1={paddingLeft}
            y1={scaleY(referenceLow)}
            x2={width - paddingRight}
            y2={scaleY(referenceLow)}
            stroke="var(--color-chart-warning)"
            strokeDasharray="6 6"
            strokeWidth="1.5"
          />
        ) : null}
        {referenceHigh !== null ? (
          <line
            x1={paddingLeft}
            y1={scaleY(referenceHigh)}
            x2={width - paddingRight}
            y2={scaleY(referenceHigh)}
            stroke="var(--color-chart-success-bold)"
            strokeDasharray="6 6"
            strokeWidth="1.5"
          />
        ) : null}
        <polyline
          points={polyline}
          fill="none"
          stroke="var(--color-chart-info-bold)"
          strokeWidth="3"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {points.map((point, index) => (
          <g key={`${point.examId}-${point.date}`}>
            <circle
              cx={scaleX(index)}
              cy={scaleY(point.value)}
              r="5.5"
              fill={point.deltaPct !== null && point.deltaPct <= -25 && point.marker.field === "colinesterasa"
                ? "var(--color-chart-danger)"
                : "var(--color-chart-info-bold)"}
            />
            <text
              x={scaleX(index)}
              y={scaleY(point.value) - 10}
              textAnchor="middle"
              className="fill-slate-600 text-[11px] font-medium"
            >
              {Number.isInteger(point.value) ? formatInteger(point.value) : formatDecimal(point.value)}
            </text>
            <text
              x={scaleX(index)}
              y={height - 18}
              textAnchor="middle"
              className="fill-slate-500 text-[11px]"
            >
              {formatDisplayDate(point.date)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function MedicalMarkerOverlay({
  personName,
  series,
  onClose,
}: {
  personName: string;
  series: ReturnType<typeof buildMarkerSeries>;
  onClose: () => void;
}) {
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      onClose();
    }

    window.addEventListener("keydown", handleEscape, true);
    return () => window.removeEventListener("keydown", handleEscape, true);
  }, [onClose]);

  const marker = series.marker;
  const recentPoints = series.recentPoints;
  const latestPoint = recentPoints[recentPoints.length - 1] ?? null;
  const latestDelta = latestPoint?.deltaPct ?? null;
  const worstDrop = recentPoints.length
    ? Math.min(...recentPoints.map((point) => point.deltaPct ?? Number.POSITIVE_INFINITY))
    : null;
  const safeWorstDrop = worstDrop !== Number.POSITIVE_INFINITY ? worstDrop : null;

  const overlayContent = (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-950/54 px-3 py-4 backdrop-blur-sm sm:px-4 sm:py-6">
      <button
        type="button"
        className="absolute inset-0 border-0 bg-transparent p-0"
        onClick={onClose}
        aria-label="Cerrar detalle del analito"
      />
      <div className="relative z-10 flex max-h-[min(90dvh,960px)] w-full max-w-sm sm:max-w-2xl md:max-w-4xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl min-w-0 flex-col overflow-hidden rounded-2xl border border-border/50 bg-card shadow-2xl shadow-slate-950/20 mx-auto">
        <div className="flex items-start justify-between gap-4 border-b border-border/50 bg-muted/20 px-4 py-4 sm:px-6">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="rounded-full px-3 py-1">
                Ficha medica
              </Badge>
              <Badge variant="secondary" className="rounded-full px-3 py-1">
                {marker?.name ?? "Analito"}
              </Badge>
            </div>
            <div className="min-w-0">
              <h3 className="text-2xl font-semibold tracking-tight">
                {personName}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Ultimos {recentPoints.length} resultados validos y su evolucion.
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>

        <div className="overflow-y-auto px-4 py-5 sm:px-6">
          {marker ? (
            <div className="space-y-5">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <SummaryCard
                  label="Historia util"
                  value={`${recentPoints.length} examenes`}
                />
                <SummaryCard
                  label="Ultimo valor"
                  value={`${
                    latestPoint?.value === undefined || latestPoint.value === null
                      ? "-"
                      : Number.isInteger(latestPoint.value)
                        ? formatInteger(latestPoint.value)
                        : formatDecimal(latestPoint.value)
                  } ${marker.unit}`.trim()}
                />
                <SummaryCard
                  label="Cambio reciente"
                  value={formatSignedPercent(latestDelta)}
                  hint="Vs. el control valido anterior"
                />
                <SummaryCard
                  label="Direccion"
                  value={resolveDirection(recentPoints)}
                  hint={marker.field === "colinesterasa" ? "Se marca alerta si cae 25% o mas." : undefined}
                />
              </div>

              {marker.field === "colinesterasa" ? (
                <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 px-4 py-4 text-sm text-slate-900">
                  <p className="font-semibold">Control especial de colinesterasa</p>
                  <p className="mt-1">
                    Caida maxima reciente: {formatSignedPercent(safeWorstDrop)}. Si la variacion entre controles
                    consecutivos baja 25% o mas, se muestra en rojo.
                  </p>
                </div>
              ) : null}

              <div className="space-y-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/65">
                    Evolucion del analito
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Vista flotante del analito seleccionando los ultimos cinco resultados validos.
                  </p>
                </div>
                <MarkerTrendChart points={recentPoints} />
              </div>

              <div className="rounded-2xl border border-border/70">
                <div className="border-b border-border/60 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/65">
                    Ultimos controles
                  </p>
                </div>
                <div className="overflow-auto">
                  <table className="min-w-full border-separate border-spacing-0 text-sm">
                    <thead className="sticky top-0 bg-card/95 backdrop-blur">
                      <tr>
                        <th className="border-b border-r border-border/60 bg-card px-3 py-3 text-left font-semibold text-foreground">Fecha</th>
                        <th className="border-b border-r border-border/60 bg-card px-3 py-3 text-left font-semibold text-foreground">Tipo</th>
                        <th className="border-b border-r border-border/60 bg-card px-3 py-3 text-right font-semibold text-foreground">Valor</th>
                        <th className="border-b border-r border-border/60 bg-card px-3 py-3 text-right font-semibold text-foreground">Variacion</th>
                        <th className="border-b bg-card px-3 py-3 text-left font-semibold text-foreground">Lectura</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...recentPoints].reverse().map((point, index) => {
                        const isAlert = marker.field === "colinesterasa" && point.deltaPct !== null && point.deltaPct <= -25;
                        return (
                          <tr key={`${point.examId}-${point.date}`} className={index % 2 === 0 ? "bg-background/90" : "bg-muted/18"}>
                            <td className="border-b border-r border-border/40 px-3 py-2.5">{formatDisplayDate(point.date)}</td>
                            <td className="border-b border-r border-border/40 px-3 py-2.5">{point.type}</td>
                            <td className="border-b border-r border-border/40 px-3 py-2.5 text-right tabular-nums">
                              {Number.isInteger(point.value) ? formatInteger(point.value) : formatDecimal(point.value)} {marker.unit}
                            </td>
                            <td className={cn(
                              "border-b border-r border-border/40 px-3 py-2.5 text-right tabular-nums",
                              isAlert ? "font-semibold text-slate-600" : "text-foreground",
                            )}>
                              {formatSignedPercent(point.deltaPct)}
                            </td>
                            <td className={cn(
                              "border-b px-3 py-2.5",
                              isAlert ? "font-semibold text-slate-600" : "text-muted-foreground",
                            )}>
                              {isAlert ? "Alerta de caida" : point.marker.status}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-10 text-sm text-muted-foreground">
              No se pudo construir la serie del analito seleccionado.
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(overlayContent, document.body);
}

export function PersonMedicalPanel({
  personId,
  fallbackName,
}: {
  personId: string;
  fallbackName: string;
}) {
  const request = useMemo(() => buildMedicalPersonRequest(personId), [personId]);
  const {
    data,
    error,
    isLoading,
  } = useSWRImmutable<MedicalPersonPayload>(request, medicalFetcher, {
    revalidateOnFocus: false,
  });
  const [selectedExamId, setSelectedExamId] = useState<number | null>(null);
  const [selectedField, setSelectedField] = useState<MedicalMarkerField | null>(null);

  const resolvedSelectedExamId = useMemo(() => {
    if (!data?.exams.length) {
      return null;
    }

    if (selectedExamId !== null && data.exams.some((exam) => exam.examId === selectedExamId)) {
      return selectedExamId;
    }

    return data.exams[0]?.examId ?? null;
  }, [data, selectedExamId]);

  const selectedExam = useMemo(() => {
    if (!data?.exams.length) {
      return null;
    }

    return data.exams.find((exam) => exam.examId === resolvedSelectedExamId) ?? data.exams[0] ?? null;
  }, [data, resolvedSelectedExamId]);

  const selectedSeries = useMemo(() => {
    if (!data || !selectedField || !data.exams.length) {
      return null;
    }

    return buildMarkerSeries(data.exams, selectedField);
  }, [data, selectedField]);

  const cholinesteraseSeries = useMemo(() => {
    if (!data) {
      return null;
    }

    return buildMarkerSeries(data.exams, "colinesterasa");
  }, [data]);

  const latestCholinesteraseDelta =
    cholinesteraseSeries?.points[cholinesteraseSeries.points.length - 1]?.deltaPct ?? null;

  if (isLoading) {
    return (
      <div className="flex items-center gap-3 py-8 text-sm text-muted-foreground">
        <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
        Cargando ficha medica.
      </div>
    );
  }

  if (error) {
    return <div className="py-8 text-sm text-destructive">{error.message}</div>;
  }

  if (!data || !data.exams.length || !selectedExam) {
    return (
      <div className="space-y-3 py-6 text-sm text-muted-foreground">
        <p>No hay examenes medicos disponibles para este personal.</p>
        <p>
          La ficha medica se activara cuando exista una cedula vinculada al `personId`
          y resultados cargados en la tabla temporal de salud.
        </p>
      </div>
    );
  }

  const personName = data.profile?.fullName ?? fallbackName;

  return (
    <>
      <div className="space-y-5">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            label="Examenes"
            value={String(data.summary.examsCount)}
            hint="Historial medico disponible"
          />
          <SummaryCard
            label="Ultimo examen"
            value={formatDisplayDate(data.summary.lastExamDate ?? "-")}
            hint={data.summary.lastExamType ?? "Sin tipo"}
          />
          <SummaryCard
            label="Var. colinesterasa"
            value={formatSignedPercent(latestCholinesteraseDelta)}
            hint="Vs. control valido anterior"
          />
          <SummaryCard
            label="Examenes con alertas"
            value={String(data.summary.alertExamCount)}
            hint="Alertas segun rangos operativos"
          />
        </div>

        <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
          <div className="rounded-2xl border border-border/60 bg-muted/14 px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/65">
                  Examenes medicos
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Selecciona un control para ver sus analitos.
                </p>
              </div>
              <Badge variant="outline" className="rounded-full px-3 py-1">
                {data.exams.length}
              </Badge>
            </div>

            <div className="mt-4 max-h-[52dvh] space-y-2 overflow-auto pr-1">
              {data.exams.map((exam) => (
                <button
                  key={exam.examId}
                  type="button"
                  onClick={() => setSelectedExamId(exam.examId)}
                  className={cn(
                    "w-full rounded-2xl border px-3.5 py-3 text-left transition-colors",
                    selectedExam.examId === exam.examId
                      ? "border-primary/35 bg-card shadow-sm"
                      : "border-border/60 bg-background/90 hover:border-primary/20 hover:bg-card",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {formatDisplayDate(exam.date)}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {exam.type}
                      </p>
                    </div>
                    <Badge variant="secondary" className="rounded-full px-2.5 py-0.5">
                      {exam.alertsBand}
                    </Badge>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-border/60 bg-muted/14 px-4 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="rounded-full px-3 py-1">
                  Ficha medica
                </Badge>
                <Badge variant="secondary" className="rounded-full px-3 py-1">
                  {formatDisplayDate(selectedExam.date)}
                </Badge>
                <Badge variant="outline" className="rounded-full px-3 py-1">
                  {selectedExam.type}
                </Badge>
              </div>
              <h4 className="mt-3 text-xl font-semibold tracking-tight">
                {personName}
              </h4>
              <p className="mt-1 text-sm text-muted-foreground">
                Haz click sobre un analito para abrir su vista flotante con los ultimos cinco resultados validos.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {selectedExam.markers.map((marker) => {
                const tone = getMarkerTone(marker.color);

                return (
                  <button
                    key={marker.field}
                    type="button"
                    onClick={() => setSelectedField(marker.field)}
                    className={cn(
                      "rounded-2xl border bg-card px-4 py-4 text-left shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-all hover:-translate-y-[1px] hover:shadow-md",
                      tone.border,
                      tone.shadow,
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{marker.name}</p>
                        <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
                          {marker.value === null
                            ? "NA"
                            : Number.isInteger(marker.value)
                              ? formatInteger(marker.value)
                              : formatDecimal(marker.value)}
                          {marker.unit ? (
                            <span className="ml-1 text-sm font-medium text-muted-foreground">
                              {marker.unit}
                            </span>
                          ) : null}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                          tone.badge,
                        )}
                      >
                        {marker.status}
                      </span>
                    </div>
                    <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                      {marker.range}
                    </p>
                    <p className="mt-3 text-xs font-medium text-slate-700">
                      Ver detalle
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {selectedField && selectedSeries ? (
        <MedicalMarkerOverlay
          personName={personName}
          series={selectedSeries}
          onClose={() => setSelectedField(null)}
        />
      ) : null}
    </>
  );
}
