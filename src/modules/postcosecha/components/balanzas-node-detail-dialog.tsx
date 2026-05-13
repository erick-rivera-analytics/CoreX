"use client";

import { useState } from "react";
import { Download, LoaderCircle } from "lucide-react";
import useSWR from "swr";

import type { BalanzasFilters, BalanzasNodeDetail, BalanzasNodeSummary } from "@/lib/postcosecha-balanzas";
import { fetchJson } from "@/lib/fetch-json";
import { BalanzasExpandableTable, type BalanzasGroupBy } from "@/modules/postcosecha/components/balanzas-expandable-table";
import { BalanzasFlatTable } from "@/modules/postcosecha/components/balanzas-flat-table";
import { BalanzasKpiMetaSection } from "@/modules/postcosecha/components/balanzas-kpi-meta-section";
import { MetricTile } from "@/shared/data-display/metric-tile";
import { MultiSelectField } from "@/shared/filters/multi-select-field";
import { FilterPanel, KpiGrid } from "@/shared/layout/filter-panel";
import { DialogShell } from "@/shared/overlays/dialog-shell";
import { Button } from "@/shared/ui/button";

type Props = {
  node: BalanzasNodeSummary;
  filters: BalanzasFilters;
  open: boolean;
  presetDestination?: string | null;
  onClose: () => void;
};

type LocalFilters = {
  destinations: string;
  grades: string;
  gradeGroups: string;
  detailYears: string;
  detailMonths: string;
  detailWeeks: string;
  detailDates: string;
};

const EMPTY_LOCAL: LocalFilters = {
  destinations: "all",
  grades: "all",
  gradeGroups: "all",
  detailYears: "all",
  detailMonths: "all",
  detailWeeks: "all",
  detailDates: "all",
};

const TEMPORAL_FILTER_NODE_KEYS = new Set([
  "gv-b1-b1c-weight",
  "apertura-b1-b1c-weight",
  "gv-b1c-b2-weight",
  "apertura-b1c-b2-weight",
  "gv-b2-b2a-weight",
  "apertura-b2-b2a-weight",
  "gv-b1c-b2a-ideal",
  "apertura-b1c-b2a-ideal",
]);

function buildEmptyLocalFilters(presetDestination?: string | null): LocalFilters {
  return {
    ...EMPTY_LOCAL,
    destinations: presetDestination ?? "all",
  };
}

function formatDestinationLabel(raw: string): string {
  if (!raw) return raw;

  const upper = raw.trim().toUpperCase();
  if (upper === "ARCOIRIS" || upper === "ARCOÍRIS") return "Arcoíris";
  if (upper === "BLANCO") return "Blanco";
  if (upper === "TINTURADO") return "Tinturado";

  const lower = raw.trim().toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function buildDetailUrl(nodeKey: string, filters: BalanzasFilters, local: LocalFilters) {
  const params = new URLSearchParams();
  params.set("weekValue", filters.weekValue);
  params.set("month", filters.month);
  params.set("year", filters.year);

  if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) params.set("dateTo", filters.dateTo);
  if (filters.farm && filters.farm !== "xl") params.set("farm", filters.farm);

  params.set("destinations", local.destinations);
  params.set("grades", local.grades);
  params.set("gradeGroups", local.gradeGroups);
  params.set("detailYears", local.detailYears);
  params.set("detailMonths", local.detailMonths);
  params.set("detailWeeks", local.detailWeeks);
  params.set("detailDates", local.detailDates);

  return `/api/postcosecha/balanzas/${nodeKey}?${params.toString()}`;
}

function downloadCsv(detail: BalanzasNodeDetail) {
  // Excluir columnas helper (isHidden) del export — son campos internos.
  const exportColumns = detail.columns.filter((c) => !c.isHidden);
  const header = exportColumns.map((column) => column.label).join(",");
  const rows = detail.rows.map((row) =>
    exportColumns
      .map((column) => {
        const value = row[column.key];
        if (value === null || value === undefined) return "";
        const stringValue = String(value);
        return stringValue.includes(",") || stringValue.includes('"')
          ? `"${stringValue.replace(/"/g, '""')}"`
          : stringValue;
      })
      .join(","),
  );

  const csv = [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `balanzas-${detail.nodeKey}-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function BalanzasNodeDetailDialog({ node, filters, open, presetDestination, onClose }: Props) {
  const [local, setLocal] = useState<LocalFilters>(() => buildEmptyLocalFilters(presetDestination));
  const groupBy: BalanzasGroupBy = null;

  const url = open ? buildDetailUrl(node.key, filters, local) : null;

  const { data: detail, isLoading } = useSWR(
    url,
    (requestUrl: string) => fetchJson<BalanzasNodeDetail>(requestUrl, "No se pudo cargar el detalle."),
    { keepPreviousData: true, revalidateOnFocus: false, dedupingInterval: 10000 },
  );

  const displayedMetrics = detail?.metrics ?? node.metrics;
  const metricCount = (
    displayedMetrics.length <= 2 ? 2
      : displayedMetrics.length === 3 ? 3
        : displayedMetrics.length === 4 ? 4
          : 5
  ) as 2 | 3 | 4 | 5;

  const hasDestination = detail ? detail.destinations.length > 0 : false;
  const hasGrades = detail ? detail.grades.length > 0 : false;
  const hasGradeGroups = detail ? detail.gradeGroups.length > 0 : false;
  const isFlatTable = (detail?.tableMode ?? node.detailTableMode) === "flat";

  const destinationOptions = detail?.destinations ?? [];
  const gradeOptions = detail?.grades ?? [];
  const gradeGroupOptions = detail?.gradeGroups ?? [];
  const temporalOptions = detail && TEMPORAL_FILTER_NODE_KEYS.has(detail.nodeKey) ? detail.temporalOptions : undefined;
  const yearOptions = temporalOptions?.years.map((option) => option.value) ?? [];
  const monthOptions = temporalOptions?.months.map((option) => option.value) ?? [];
  const weekOptions = temporalOptions?.weeks.map((option) => option.value) ?? [];
  const dateOptions = temporalOptions?.dates.map((option) => option.value) ?? [];
  const monthLabelMap = new Map((temporalOptions?.months ?? []).map((option) => [option.value, option.label]));

  return (
    <DialogShell
      open={open}
      title={
        presetDestination
          ? `${node.dialogTitle ?? node.label} · ${formatDestinationLabel(presetDestination)}`
          : (node.dialogTitle ?? node.label)
      }
      description={`${detail ? detail.rowCount.toLocaleString("es-EC") : "..."} registros`}
      maxWidth="max-w-[min(1600px,95vw)]"
      onClose={onClose}
      headerActions={
        detail ? (
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl"
            onClick={() => downloadCsv(detail)}
          >
            <Download className="size-4" aria-hidden="true" />
            CSV
          </Button>
        ) : undefined
      }
    >
      <div className="space-y-5">
        <KpiGrid columns={metricCount}>
          {displayedMetrics.map((metric) => (
            <MetricTile key={metric.col} label={metric.label} value={metric.formatted} />
          ))}
        </KpiGrid>

        {detail?.kpi ? <BalanzasKpiMetaSection kpi={detail.kpi} /> : null}

        <FilterPanel>
          {/* Categóricos arriba (Destino · Grado · Grupo), responsivos 1 → 2 → 3 cols.
              Solo se muestran cuando la MV los soporta; si solo hay 1, ocupa todo
              el ancho disponible para que el dropdown no quede angosto. */}
          {(hasDestination || hasGrades || hasGradeGroups) ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {hasDestination ? (
                <MultiSelectField
                  id="detail-destinations"
                  label="Destino"
                  value={local.destinations}
                  options={destinationOptions}
                  displayValue={formatDestinationLabel}
                  onChange={(value) => setLocal((prev) => ({ ...prev, destinations: value }))}
                  emptyLabel="Todos los destinos"
                />
              ) : null}
              {hasGrades ? (
                <MultiSelectField
                  id="detail-grades"
                  label="Grado"
                  value={local.grades}
                  options={gradeOptions}
                  onChange={(value) => setLocal((prev) => ({ ...prev, grades: value }))}
                  emptyLabel="Todos los grados"
                />
              ) : null}
              {hasGradeGroups ? (
                <MultiSelectField
                  id="detail-grade-groups"
                  label="Grupo de grado"
                  value={local.gradeGroups}
                  options={gradeGroupOptions}
                  onChange={(value) => setLocal((prev) => ({ ...prev, gradeGroups: value }))}
                  emptyLabel="Todos los grupos"
                />
              ) : null}
            </div>
          ) : null}

          {/* Temporales abajo (4 fijos) — responsivos 1 → 2 → 4 cols. */}
          {temporalOptions ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <MultiSelectField
                id="detail-years"
                label="Año"
                value={local.detailYears}
                options={yearOptions}
                onChange={(value) => setLocal((prev) => ({ ...prev, detailYears: value }))}
                emptyLabel="Todos los años"
              />
              <MultiSelectField
                id="detail-months"
                label="Mes"
                value={local.detailMonths}
                options={monthOptions}
                displayValue={(value) => monthLabelMap.get(value) ?? value}
                onChange={(value) => setLocal((prev) => ({ ...prev, detailMonths: value }))}
                emptyLabel="Todos los meses"
              />
              <MultiSelectField
                id="detail-weeks"
                label="Semana"
                value={local.detailWeeks}
                options={weekOptions}
                onChange={(value) => setLocal((prev) => ({ ...prev, detailWeeks: value }))}
                emptyLabel="Todas las semanas"
              />
              <MultiSelectField
                id="detail-dates"
                label={temporalOptions.dateLabel}
                value={local.detailDates}
                options={dateOptions}
                onChange={(value) => setLocal((prev) => ({ ...prev, detailDates: value }))}
                emptyLabel="Todas las fechas"
              />
            </div>
          ) : null}
        </FilterPanel>

        {isLoading && !detail ? (
          <div className="flex items-center gap-3 py-12 text-sm text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
            Cargando detalle…
          </div>
        ) : detail && detail.columns.length > 0 ? (
          isFlatTable ? (
            <BalanzasFlatTable detail={detail} />
          ) : (
            <BalanzasExpandableTable detail={detail} groupBy={groupBy} />
          )
        ) : detail && detail.columns.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No hay datos disponibles para este nodo en el período seleccionado.
          </p>
        ) : null}
      </div>
    </DialogShell>
  );
}
