"use client";

import { useState } from "react";
import { Download, LoaderCircle } from "lucide-react";
import useSWR from "swr";

import type { BalanzasFilters, BalanzasNodeDetail, BalanzasNodeSummary } from "@/lib/postcosecha-balanzas";
import { fetchJson } from "@/lib/fetch-json";
import { encodeMultiSelectValue } from "@/lib/multi-select";
import { BalanzasExpandableTable, type BalanzasGroupBy } from "@/modules/postcosecha/components/balanzas-expandable-table";
import { BalanzasFlatTable } from "@/modules/postcosecha/components/balanzas-flat-table";
import { MetricTile } from "@/shared/data-display/metric-tile";
import { DateField } from "@/shared/filters/date-field";
import { FilterPanel, KpiGrid } from "@/shared/layout/filter-panel";
import { DialogShell } from "@/shared/overlays/dialog-shell";
import { MultiSelectField } from "@/shared/filters/multi-select-field";
import { SingleSelectField } from "@/shared/filters/single-select-field";
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
  workDateFrom: string;
  workDateTo: string;
  lotDateFrom: string;
  lotDateTo: string;
};

const EMPTY_LOCAL: LocalFilters = {
  destinations: "all",
  grades: "all",
  gradeGroups: "all",
  workDateFrom: "",
  workDateTo: "",
  lotDateFrom: "",
  lotDateTo: "",
};

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

  if (local.workDateFrom) params.set("workDateFrom", local.workDateFrom);
  if (local.workDateTo) params.set("workDateTo", local.workDateTo);
  if (local.lotDateFrom) params.set("lotDateFrom", local.lotDateFrom);
  if (local.lotDateTo) params.set("lotDateTo", local.lotDateTo);

  return `/api/postcosecha/balanzas/${nodeKey}?${params.toString()}`;
}

function downloadCsv(detail: BalanzasNodeDetail) {
  const header = detail.columns.map((column) => column.label).join(",");
  const rows = detail.rows.map((row) =>
    detail.columns
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
  const [groupBy, setGroupBy] = useState<BalanzasGroupBy>(null);

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
  const supportsGrouping = !isFlatTable;
  const hasWorkDateFilter = detail?.dateFilterKeys.includes("work_date") ?? false;
  const hasLotDateFilter = detail?.dateFilterKeys.includes("lot_date") ?? false;

  const destinationOptions = detail?.destinations ?? [];
  const gradeOptions = detail?.grades ?? [];
  const gradeGroupOptions = detail?.gradeGroups ?? [];

  return (
    <DialogShell
      open={open}
      title={
        presetDestination
          ? `${node.dialogTitle ?? node.label} · ${formatDestinationLabel(presetDestination)}`
          : (node.dialogTitle ?? node.label)
      }
      description={`${detail ? detail.rowCount.toLocaleString("es-EC") : "…"} registros`}
      maxWidth="max-w-7xl"
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

        <FilterPanel>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {supportsGrouping ? (
              <SingleSelectField
                id="detail-groupBy"
                label="Agrupación"
                value={groupBy ?? "none"}
                options={[
                  ...(hasDestination ? ["destination"] : []),
                  ...(hasGrades ? ["grade"] : []),
                  ...(hasGradeGroups ? ["gradeGroup"] : []),
                ]}
                displayValue={(value) =>
                  value === "destination" ? "Por destino"
                    : value === "grade" ? "Por grado"
                      : value === "gradeGroup" ? "Por grupo de grado"
                        : value
                }
                emptyValue="none"
                emptyLabel="Sin agrupar (Semana → detalle)"
                onChange={(value) => setGroupBy(value === "none" ? null : (value as BalanzasGroupBy))}
              />
            ) : null}
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

          {hasWorkDateFilter || hasLotDateFilter ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {hasWorkDateFilter ? (
                <DateField
                  id="detail-work-date-from"
                  label="Fecha trabajo desde"
                  value={local.workDateFrom}
                  onChange={(value) => setLocal((prev) => ({ ...prev, workDateFrom: value }))}
                />
              ) : null}
              {hasWorkDateFilter ? (
                <DateField
                  id="detail-work-date-to"
                  label="Fecha trabajo hasta"
                  value={local.workDateTo}
                  onChange={(value) => setLocal((prev) => ({ ...prev, workDateTo: value }))}
                />
              ) : null}
              {hasLotDateFilter ? (
                <DateField
                  id="detail-lot-date-from"
                  label="Fecha lote desde"
                  value={local.lotDateFrom}
                  onChange={(value) => setLocal((prev) => ({ ...prev, lotDateFrom: value }))}
                />
              ) : null}
              {hasLotDateFilter ? (
                <DateField
                  id="detail-lot-date-to"
                  label="Fecha lote hasta"
                  value={local.lotDateTo}
                  onChange={(value) => setLocal((prev) => ({ ...prev, lotDateTo: value }))}
                />
              ) : null}
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

export { encodeMultiSelectValue };
