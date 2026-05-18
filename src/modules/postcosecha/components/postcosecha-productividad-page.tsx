"use client";

import React, { useDeferredValue, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Clock, LoaderCircle } from "lucide-react";
import useSWR from "swr";
import { toast } from "sonner";

import { fetchJson } from "@/lib/fetch-json";
import {
  defaultPostharvestProductivityFilters,
  type PostharvestProductivityActivityDetailData,
  type PostharvestProductivityDashboardData,
  type PostharvestProductivityFilters,
  type PostharvestProductivityRow,
} from "@/lib/postcosecha-productividad-contract";
import { EmptyState } from "@/shared/data-display/empty-state";
import { MetricTile } from "@/shared/data-display/metric-tile";
import { DateField } from "@/shared/filters/date-field";
import { MultiSelectField } from "@/shared/filters/multi-select-field";
import { DetailSection, FilterPanel, KpiGrid } from "@/shared/layout/filter-panel";
import { SectionPageShell } from "@/shared/layout/section-page-shell";
import { formatDecimal, formatHours, formatMonthNumeric, formatPercent } from "@/shared/lib/format";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { ScrollFadeTable } from "@/shared/tables/scroll-fade-table";
import { cn } from "@/lib/utils";
import { PostcosechaProductividadPdfExportButton } from "@/modules/postcosecha/components/postcosecha-productividad-pdf-export-button";

const dashboardFetcher = (url: string) =>
  fetchJson<PostharvestProductivityDashboardData>(
    url,
    "No se pudo cargar el dashboard de productividad de postcosecha.",
  );

const detailFetcher = (url: string) =>
  fetchJson<PostharvestProductivityActivityDetailData>(
    url,
    "No se pudo cargar el detalle de actividades de productividad de postcosecha.",
  );

function buildQueryString(filters: PostharvestProductivityFilters) {
  const params = new URLSearchParams();
  params.set("year", filters.year);
  params.set("month", filters.month);
  params.set("area", filters.area);
  params.set("pathPost", filters.pathPost);
  params.set("finalDestination", filters.finalDestination);
  params.set("variety", filters.variety);
  if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) params.set("dateTo", filters.dateTo);
  return params.toString();
}

type AggregateMetrics = {
  totalWeightKg: number;
  totalBoxes10: number;
  totalHoursCls: number;
  totalHoursSb: number;
  totalHoursEmp: number;
  totalHours: number;
};

type ActivityCostAreaGroup = AggregateMetrics & {
  costArea: string;
  subCostCenters: ActivitySubCostCenterGroup[];
};

type ActivitySubCostCenterGroup = AggregateMetrics & {
  subCostCenter: string;
  activities: ActivityLeafRow[];
};

type ActivityLeafRow = AggregateMetrics & {
  activityName: string;
};

function emptyMetrics(): AggregateMetrics {
  return {
    totalWeightKg: 0,
    totalBoxes10: 0,
    totalHoursCls: 0,
    totalHoursSb: 0,
    totalHoursEmp: 0,
    totalHours: 0,
  };
}

function accumulateMetrics(target: AggregateMetrics, row: PostharvestProductivityRow) {
  target.totalWeightKg += row.weightKg;
  target.totalBoxes10 += row.boxes10;
  target.totalHoursCls += row.hoursCls;
  target.totalHoursSb += row.hoursSb;
  target.totalHoursEmp += row.hoursEmp;
  target.totalHours += row.totalHours;
}

function buildGroups(rows: PostharvestProductivityRow[]): YearGroup[] {
  const yearMap = new Map<
    string,
    { year: number | null; months: Map<number, { month: number; monthLabel: string; weeks: Map<string, { weekLabel: string; paths: Map<string, { pathPost: string; destinations: Map<string, DestinationGroup>; metrics: AggregateMetrics; rowCount: number }>; metrics: AggregateMetrics; rowCount: number }>; metrics: AggregateMetrics; rowCount: number }>; metrics: AggregateMetrics; rowCount: number }
  >();

  for (const row of rows) {
    const yearKey = row.year === null ? "Sin año" : String(row.year);
    const yearEntry = yearMap.get(yearKey) ?? {
      year: row.year,
      months: new Map(),
      metrics: emptyMetrics(),
      rowCount: 0,
    };

    yearEntry.rowCount += 1;
    accumulateMetrics(yearEntry.metrics, row);

    const monthKey = row.month ?? 0;
    const monthEntry = yearEntry.months.get(monthKey) ?? {
      month: monthKey,
      monthLabel: row.month ? formatMonthNumeric(String(row.month).padStart(2, "0")) : "Sin mes",
      weeks: new Map(),
      metrics: emptyMetrics(),
      rowCount: 0,
    };

    monthEntry.rowCount += 1;
    accumulateMetrics(monthEntry.metrics, row);

    const weekKey = row.isoWeekId;
    const weekEntry = monthEntry.weeks.get(weekKey) ?? {
      weekLabel: row.isoWeekId,
      paths: new Map(),
      metrics: emptyMetrics(),
      rowCount: 0,
    };
    weekEntry.rowCount += 1;
    accumulateMetrics(weekEntry.metrics, row);

    const pathEntry = weekEntry.paths.get(row.pathPost) ?? {
      pathPost: row.pathPost,
      destinations: new Map(),
      metrics: emptyMetrics(),
      rowCount: 0,
    };
    pathEntry.rowCount += 1;
    accumulateMetrics(pathEntry.metrics, row);

    const destinationEntry = pathEntry.destinations.get(row.finalDestination) ?? {
      finalDestination: row.finalDestination,
      rowCount: 0,
      rows: [],
      ...emptyMetrics(),
    };
    destinationEntry.rowCount += 1;
    destinationEntry.rows.push(row);
    accumulateMetrics(destinationEntry, row);

    pathEntry.destinations.set(row.finalDestination, destinationEntry);
    weekEntry.paths.set(row.pathPost, pathEntry);
    monthEntry.weeks.set(weekKey, weekEntry);

    yearEntry.months.set(monthKey, monthEntry);
    yearMap.set(yearKey, yearEntry);
  }

  return Array.from(yearMap.values())
    .map((yearEntry) => ({
      year: yearEntry.year,
      label: yearEntry.year === null ? "Sin año" : String(yearEntry.year),
      rowCount: yearEntry.rowCount,
      totalWeightKg: yearEntry.metrics.totalWeightKg,
      totalBoxes10: yearEntry.metrics.totalBoxes10,
      totalHoursCls: yearEntry.metrics.totalHoursCls,
      totalHoursSb: yearEntry.metrics.totalHoursSb,
      totalHoursEmp: yearEntry.metrics.totalHoursEmp,
      totalHours: yearEntry.metrics.totalHours,
      months: Array.from(yearEntry.months.values())
        .sort((left, right) => right.month - left.month)
        .map((monthEntry) => ({
          month: monthEntry.month,
          monthLabel: monthEntry.monthLabel,
          rowCount: monthEntry.rowCount,
          totalWeightKg: monthEntry.metrics.totalWeightKg,
          totalBoxes10: monthEntry.metrics.totalBoxes10,
          totalHoursCls: monthEntry.metrics.totalHoursCls,
          totalHoursSb: monthEntry.metrics.totalHoursSb,
          totalHoursEmp: monthEntry.metrics.totalHoursEmp,
          totalHours: monthEntry.metrics.totalHours,
          weeks: Array.from(monthEntry.weeks.values())
            .sort((left, right) => right.weekLabel.localeCompare(left.weekLabel, "es-EC"))
            .map((weekEntry) => ({
              weekLabel: weekEntry.weekLabel,
              rowCount: weekEntry.rowCount,
              totalWeightKg: weekEntry.metrics.totalWeightKg,
              totalBoxes10: weekEntry.metrics.totalBoxes10,
              totalHoursCls: weekEntry.metrics.totalHoursCls,
              totalHoursSb: weekEntry.metrics.totalHoursSb,
              totalHoursEmp: weekEntry.metrics.totalHoursEmp,
              totalHours: weekEntry.metrics.totalHours,
              paths: Array.from(weekEntry.paths.values())
                .sort((left, right) => left.pathPost.localeCompare(right.pathPost, "es-EC"))
                .map((pathEntry) => ({
                  pathPost: pathEntry.pathPost,
                  rowCount: pathEntry.rowCount,
                  totalWeightKg: pathEntry.metrics.totalWeightKg,
                  totalBoxes10: pathEntry.metrics.totalBoxes10,
                  totalHoursCls: pathEntry.metrics.totalHoursCls,
                  totalHoursSb: pathEntry.metrics.totalHoursSb,
                  totalHoursEmp: pathEntry.metrics.totalHoursEmp,
                  totalHours: pathEntry.metrics.totalHours,
                  destinations: Array.from(pathEntry.destinations.values())
                    .sort((left, right) => left.finalDestination.localeCompare(right.finalDestination, "es-EC"))
                    .map((destinationEntry) => ({
                      ...destinationEntry,
                      rows: [...destinationEntry.rows].sort((left, right) => right.postDate.localeCompare(left.postDate)),
                    })),
                })),
            })),
        })),
    }))
    .sort((left, right) => {
      if (left.year === null) return 1;
      if (right.year === null) return -1;
      return right.year - left.year;
    });
}

function ratioLabel(hours: number, boxes10: number) {
  return boxes10 > 0 ? formatDecimal(hours / boxes10, 4) : "-";
}

function participationLabel(partHours: number, totalHours: number) {
  if (totalHours <= 0) return "-";
  return formatPercent((partHours / totalHours) * 100, {
    maximumFractionDigits: 2,
  });
}

function complianceClassName(value: number | null) {
  if (value === null) return "text-muted-foreground";
  if (value < 100) return "text-emerald-600";
  if (value > 100) return "text-red-600";
  return "text-foreground";
}

function buildActivityDetailQueryString(params: {
  filters: PostharvestProductivityFilters;
  yearScope?: string;
  monthScope?: string;
  isoWeekId: string;
  areaScope?: string;
  pathPostScope: string;
  finalDestinationScope: string;
  varietyScope?: string;
}) {
  const query = new URLSearchParams();
  query.set("year", params.filters.year);
  query.set("month", params.filters.month);
  query.set("area", params.filters.area);
  query.set("pathPost", params.filters.pathPost);
  query.set("finalDestination", params.filters.finalDestination);
  query.set("variety", params.filters.variety);
  if (params.filters.dateFrom) query.set("dateFrom", params.filters.dateFrom);
  if (params.filters.dateTo) query.set("dateTo", params.filters.dateTo);
  if (params.yearScope) query.set("yearScope", params.yearScope);
  if (params.monthScope) query.set("monthScope", params.monthScope);
  if (params.isoWeekId) query.set("isoWeekId", params.isoWeekId);
  if (params.areaScope) query.set("areaScope", params.areaScope);
  if (params.pathPostScope) query.set("pathPostScope", params.pathPostScope);
  if (params.finalDestinationScope) query.set("finalDestinationScope", params.finalDestinationScope);
  if (params.varietyScope) query.set("varietyScope", params.varietyScope);
  return query.toString();
}

function buildActivityGroups(
  rows: PostharvestProductivityActivityDetailData["rows"],
): ActivityCostAreaGroup[] {
  const costAreaMap = new Map<string, { metrics: AggregateMetrics; subCostCenters: Map<string, { metrics: AggregateMetrics; activities: ActivityLeafRow[] }> }>();

  for (const row of rows) {
    const costAreaEntry = costAreaMap.get(row.costArea) ?? {
      metrics: emptyMetrics(),
      subCostCenters: new Map(),
    };
    costAreaEntry.metrics.totalHoursCls += row.hoursCls;
    costAreaEntry.metrics.totalHoursSb += row.hoursSb;
    costAreaEntry.metrics.totalHoursEmp += row.hoursEmp;
    costAreaEntry.metrics.totalHours += row.totalHours;

    const subEntry = costAreaEntry.subCostCenters.get(row.subCostCenter) ?? {
      metrics: emptyMetrics(),
      activities: [],
    };
    subEntry.metrics.totalHoursCls += row.hoursCls;
    subEntry.metrics.totalHoursSb += row.hoursSb;
    subEntry.metrics.totalHoursEmp += row.hoursEmp;
    subEntry.metrics.totalHours += row.totalHours;
    subEntry.activities.push({
      activityName: row.activityName,
      totalWeightKg: 0,
      totalBoxes10: 0,
      totalHoursCls: row.hoursCls,
      totalHoursSb: row.hoursSb,
      totalHoursEmp: row.hoursEmp,
      totalHours: row.totalHours,
    });

    costAreaEntry.subCostCenters.set(row.subCostCenter, subEntry);
    costAreaMap.set(row.costArea, costAreaEntry);
  }

  return Array.from(costAreaMap.entries())
    .map(([costArea, costAreaEntry]) => ({
      costArea,
      totalWeightKg: 0,
      totalBoxes10: 0,
      totalHoursCls: costAreaEntry.metrics.totalHoursCls,
      totalHoursSb: costAreaEntry.metrics.totalHoursSb,
      totalHoursEmp: costAreaEntry.metrics.totalHoursEmp,
      totalHours: costAreaEntry.metrics.totalHours,
      subCostCenters: Array.from(costAreaEntry.subCostCenters.entries())
        .map(([subCostCenter, subEntry]) => ({
          subCostCenter,
          totalWeightKg: 0,
          totalBoxes10: 0,
          totalHoursCls: subEntry.metrics.totalHoursCls,
          totalHoursSb: subEntry.metrics.totalHoursSb,
          totalHoursEmp: subEntry.metrics.totalHoursEmp,
          totalHours: subEntry.metrics.totalHours,
          activities: subEntry.activities.sort((left, right) => left.activityName.localeCompare(right.activityName, "es-EC")),
        }))
        .sort((left, right) => left.subCostCenter.localeCompare(right.subCostCenter, "es-EC")),
    }))
    .sort((left, right) => left.costArea.localeCompare(right.costArea, "es-EC"));
}

function TH({ children, right = false }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th
      scope="col"
      className={`border-b border-border/60 bg-background/95 px-3 py-2.5 text-xs font-semibold text-muted-foreground whitespace-nowrap ${
        right ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

function TD({
  children,
  right = false,
  muted = false,
  className = "",
  colSpan,
}: {
  children?: React.ReactNode;
  right?: boolean;
  muted?: boolean;
  className?: string;
  colSpan?: number;
}) {
  return (
    <td
      colSpan={colSpan}
      className={`border-b border-border/40 px-3 py-2 text-sm whitespace-nowrap ${right ? "text-right" : ""} ${
        muted ? "text-muted-foreground" : ""
      } ${className}`}
    >
      {children}
    </td>
  );
}

function DestinationActivityDetailRows({
  filters,
  yearScope,
  monthScope,
  isoWeekId,
  areaScope,
  pathPost,
  finalDestination,
  varietyScope,
  boxes10,
  leadingColumnCount,
}: {
  filters: PostharvestProductivityFilters;
  yearScope?: string;
  monthScope?: string;
  isoWeekId: string;
  areaScope?: string;
  pathPost: string;
  finalDestination: string;
  varietyScope?: string;
  boxes10: number;
  leadingColumnCount: number;
}) {
  const [expandedAreas, setExpandedAreas] = useState<Set<string>>(new Set());
  const [expandedSubCenters, setExpandedSubCenters] = useState<Set<string>>(new Set());

  const queryString = useMemo(
    () =>
      buildActivityDetailQueryString({
        filters,
        yearScope,
        monthScope,
        isoWeekId,
        areaScope,
        pathPostScope: pathPost,
        finalDestinationScope: finalDestination,
        varietyScope,
      }),
    [filters, yearScope, monthScope, isoWeekId, areaScope, pathPost, finalDestination, varietyScope],
  );

  const { data, error, isLoading } = useSWR(
    `/api/postcosecha/productividad/detail?${queryString}`,
    detailFetcher,
    { revalidateOnFocus: false, dedupingInterval: 30000 },
  );

  function toggleArea(key: string) {
    setExpandedAreas((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleSubCenter(key: string) {
    setExpandedSubCenters((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  if (isLoading) {
    return (
      <tr>
        <TD colSpan={leadingColumnCount + 8}>
          <div className="ml-[100px] flex items-center gap-2 py-2 text-xs text-muted-foreground">
            <LoaderCircle className="size-3.5 animate-spin" /> Cargando detalle de actividades…
          </div>
        </TD>
      </tr>
    );
  }

  if (error || !data) {
    return (
      <tr>
        <TD colSpan={leadingColumnCount + 8}>
          <div className="ml-[100px] py-2 text-xs text-destructive">
            {error?.message || "Error al cargar detalle de actividades."}
          </div>
        </TD>
      </tr>
    );
  }

  const groups = buildActivityGroups(data.rows);

  if (!groups.length) {
    return (
      <tr>
        <TD colSpan={leadingColumnCount + 8}>
          <div className="ml-[100px] py-2 text-xs text-muted-foreground">
            No hay actividades para este destino con los filtros actuales.
          </div>
        </TD>
      </tr>
    );
  }

  return (
    <>
      {groups.map((costAreaGroup) => {
        const areaKey = `${isoWeekId}|${pathPost}|${finalDestination}|${costAreaGroup.costArea}`;
        const areaOpen = expandedAreas.has(areaKey);
        return (
          <React.Fragment key={areaKey}>
            <tr className="cursor-pointer bg-muted/15 hover:bg-muted/25" onClick={() => toggleArea(areaKey)}>
              <TD colSpan={leadingColumnCount} className="font-medium">
                <div className="ml-[100px] flex items-center gap-2">
                  {areaOpen ? <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" /> : <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />}
                  <span>{costAreaGroup.costArea}</span>
                </div>
              </TD>
              <TD right>{formatHours(costAreaGroup.totalHours)}</TD>
              <TD right>{formatDecimal(boxes10, 2)}</TD>
              <TD right>{participationLabel(costAreaGroup.totalHoursCls, costAreaGroup.totalHours)}</TD>
              <TD right>{participationLabel(costAreaGroup.totalHoursSb, costAreaGroup.totalHours)}</TD>
              <TD right>{participationLabel(costAreaGroup.totalHoursEmp, costAreaGroup.totalHours)}</TD>
              <TD right>{ratioLabel(costAreaGroup.totalHours, boxes10)}</TD>
              <TD right muted>-</TD>
              <TD right className={complianceClassName(null)}>-</TD>
            </tr>

            {areaOpen &&
              costAreaGroup.subCostCenters.map((subGroup) => {
                const subKey = `${areaKey}|${subGroup.subCostCenter}`;
                const subOpen = expandedSubCenters.has(subKey);
                return (
                  <React.Fragment key={subKey}>
                    <tr className="cursor-pointer bg-background/20 hover:bg-muted/15" onClick={() => toggleSubCenter(subKey)}>
                      <TD colSpan={leadingColumnCount} className="font-medium">
                        <div className="ml-[124px] flex items-center gap-2">
                          {subOpen ? <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" /> : <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />}
                          <span>{subGroup.subCostCenter}</span>
                        </div>
                      </TD>
                      <TD right>{formatHours(subGroup.totalHours)}</TD>
                      <TD right>{formatDecimal(boxes10, 2)}</TD>
                      <TD right>{participationLabel(subGroup.totalHoursCls, subGroup.totalHours)}</TD>
                      <TD right>{participationLabel(subGroup.totalHoursSb, subGroup.totalHours)}</TD>
                      <TD right>{participationLabel(subGroup.totalHoursEmp, subGroup.totalHours)}</TD>
                      <TD right>{ratioLabel(subGroup.totalHours, boxes10)}</TD>
                      <TD right muted>-</TD>
                      <TD right className={complianceClassName(null)}>-</TD>
                    </tr>

                    {subOpen &&
                      subGroup.activities.map((activity) => (
                        <tr key={`${subKey}|${activity.activityName}`} className="bg-background/10 hover:bg-muted/10">
                          <TD colSpan={leadingColumnCount} muted>
                            <span className="ml-[148px]">{activity.activityName}</span>
                          </TD>
                          <TD right>{formatHours(activity.totalHours)}</TD>
                          <TD right>{formatDecimal(boxes10, 2)}</TD>
                          <TD right>{participationLabel(activity.totalHoursCls, activity.totalHours)}</TD>
                          <TD right>{participationLabel(activity.totalHoursSb, activity.totalHours)}</TD>
                          <TD right>{participationLabel(activity.totalHoursEmp, activity.totalHours)}</TD>
                          <TD right>{ratioLabel(activity.totalHours, boxes10)}</TD>
                          <TD right muted>-</TD>
                          <TD right className={complianceClassName(null)}>-</TD>
                        </tr>
                      ))}
                  </React.Fragment>
                );
              })}
          </React.Fragment>
        );
      })}
    </>
  );
}

const productivdadGroupingOptions = [
  { key: "variety", label: "Variedad", width: 140 },
  { key: "area", label: "Área", width: 120 },
  { key: "pathPost", label: "Camino", width: 150 },
  { key: "finalDestination", label: "Destino", width: 150 },
  { key: "week", label: "Semana", width: 120 },
] as const;

type ProductivityGroupingKey = (typeof productivdadGroupingOptions)[number]["key"];
type AreaGroupingValue = "CLS" | "SB" | "EMP";
type GroupedProductivityRow = AggregateMetrics & {
  id: string;
  rowCount: number;
  groupValues: Partial<Record<ProductivityGroupingKey, string>>;
  scope: {
    yearScope: string;
    monthScope: string;
    isoWeekId: string;
    areaScope: string;
    pathPostScope: string;
    finalDestinationScope: string;
    varietyScope: string;
  };
};

const productivityGroupCollator = new Intl.Collator("es-EC", {
  numeric: true,
  sensitivity: "base",
});

function getProductivityGroupValue(row: PostharvestProductivityRow, key: ProductivityGroupingKey) {
  switch (key) {
    case "week":
      return row.isoWeekId ? `Semana ${row.isoWeekId}` : "Sin semana";
    case "pathPost":
      return row.pathPost || "Sin camino";
    case "finalDestination":
      return row.finalDestination || "Sin destino";
    case "area":
      return "Total";
    case "variety":
      return row.varietyCanon || "Sin variedad";
    default:
      return "";
  }
}

type GroupableProductivityRow = PostharvestProductivityRow & {
  areaDimension: string;
  sliceHoursCls: number;
  sliceHoursSb: number;
  sliceHoursEmp: number;
  sliceTotalHours: number;
};

function explodeRowsForGrouping(
  rows: PostharvestProductivityRow[],
  selectedDimensions: ProductivityGroupingKey[],
): GroupableProductivityRow[] {
  if (!selectedDimensions.includes("area")) {
    return rows.map((row) => ({
      ...row,
      areaDimension: "",
      sliceHoursCls: row.hoursCls,
      sliceHoursSb: row.hoursSb,
      sliceHoursEmp: row.hoursEmp,
      sliceTotalHours: row.totalHours,
    }));
  }

  const exploded: GroupableProductivityRow[] = [];

  for (const row of rows) {
    const slices: Array<{ area: AreaGroupingValue; hours: number }> = [
      { area: "CLS", hours: row.hoursCls },
      { area: "SB", hours: row.hoursSb },
      { area: "EMP", hours: row.hoursEmp },
    ];

    for (const slice of slices) {
      if (slice.hours <= 0) continue;

      exploded.push({
        ...row,
        areaDimension: slice.area,
        sliceHoursCls: slice.area === "CLS" ? slice.hours : 0,
        sliceHoursSb: slice.area === "SB" ? slice.hours : 0,
        sliceHoursEmp: slice.area === "EMP" ? slice.hours : 0,
        sliceTotalHours: slice.hours,
      });
    }
  }

  return exploded;
}

function buildProductivityGroupedRows(
  rows: PostharvestProductivityRow[],
  selectedDimensions: ProductivityGroupingKey[],
): GroupedProductivityRow[] {
  const sourceRows = explodeRowsForGrouping(rows, selectedDimensions);
  const groups = new Map<string, GroupedProductivityRow>();

  for (const row of sourceRows) {
    const groupKey = selectedDimensions.length
      ? selectedDimensions
          .map((dimension) =>
            dimension === "area" ? row.areaDimension || "Total" : getProductivityGroupValue(row, dimension),
          )
          .join("|")
      : "__total__";

    const existing = groups.get(groupKey);
    if (existing) {
      existing.rowCount += 1;
      existing.totalWeightKg += row.weightKg;
      existing.totalBoxes10 += row.boxes10;
      existing.totalHoursCls += row.sliceHoursCls;
      existing.totalHoursSb += row.sliceHoursSb;
      existing.totalHoursEmp += row.sliceHoursEmp;
      existing.totalHours += row.sliceTotalHours;
      continue;
    }

    groups.set(groupKey, {
      id: groupKey,
      rowCount: 1,
      groupValues: Object.fromEntries(
        selectedDimensions.map((dimension) => [
          dimension,
          dimension === "area" ? row.areaDimension || "Total" : getProductivityGroupValue(row, dimension),
        ]),
      ) as Partial<Record<ProductivityGroupingKey, string>>,
      scope: {
        yearScope: "",
        monthScope: "",
        isoWeekId: selectedDimensions.includes("week") ? row.isoWeekId : "",
        areaScope: selectedDimensions.includes("area") ? row.areaDimension : "",
        pathPostScope: selectedDimensions.includes("pathPost") ? row.pathPost : "",
        finalDestinationScope: selectedDimensions.includes("finalDestination") ? row.finalDestination : "",
        varietyScope: selectedDimensions.includes("variety") ? row.varietyCanon : "",
      },
      totalWeightKg: row.weightKg,
      totalBoxes10: row.boxes10,
      totalHoursCls: row.sliceHoursCls,
      totalHoursSb: row.sliceHoursSb,
      totalHoursEmp: row.sliceHoursEmp,
      totalHours: row.sliceTotalHours,
    });
  }

  return Array.from(groups.values()).sort((left, right) => {
    for (const dimension of selectedDimensions) {
      const leftValue = left.groupValues[dimension] ?? "";
      const rightValue = right.groupValues[dimension] ?? "";

      if (dimension === "week") {
        const weekCompare = productivityGroupCollator.compare(right.scope.isoWeekId, left.scope.isoWeekId);
        if (weekCompare !== 0) return weekCompare;
        continue;
      }

      const compare = productivityGroupCollator.compare(leftValue, rightValue);
      if (compare !== 0) return compare;
    }

    return right.totalHours - left.totalHours;
  });
}

function PostharvestProductivityTable({
  rows,
  filters,
}: {
  rows: PostharvestProductivityRow[];
  filters: PostharvestProductivityFilters;
}) {
  const [selectedDimensions, setSelectedDimensions] = useState<ProductivityGroupingKey[]>(["week"]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const groupedRows = useMemo(
    () => buildProductivityGroupedRows(rows, selectedDimensions),
    [rows, selectedDimensions],
  );

  function toggleDimension(dimension: ProductivityGroupingKey) {
    setSelectedDimensions((current) => {
      if (current.includes(dimension)) {
        return current.filter((item) => item !== dimension);
      }

      return productivdadGroupingOptions.reduce<ProductivityGroupingKey[]>((acc, option) => {
        if (current.includes(option.key) || option.key === dimension) acc.push(option.key);
        return acc;
      }, []);
    });
    setExpandedGroups(new Set());
  }

  function toggleGroup(groupId: string) {
    setExpandedGroups((current) => {
      const next = new Set(current);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }

  if (!groupedRows.length) {
    return <EmptyState label="No hay datos para los filtros seleccionados." />;
  }

  const leadingColumns = selectedDimensions.length
    ? productivdadGroupingOptions.filter((option) => selectedDimensions.includes(option.key))
    : [{ key: "summary", label: "Vista", width: 180 }] as Array<{ key: string; label: string; width: number }>;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Columnas de agrupación</p>
        <div className="flex flex-wrap gap-2">
          {productivdadGroupingOptions.map((option) => {
            const active = selectedDimensions.includes(option.key);
            return (
              <Button
                key={option.key}
                variant={active ? "secondary" : "outline"}
                className="rounded-full"
                onClick={() => toggleDimension(option.key)}
              >
                {option.label}
              </Button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge variant="outline" className="rounded-full px-3 py-1">
          {rows.length} filas base
        </Badge>
        <Badge variant="outline" className="rounded-full px-3 py-1">
          {groupedRows.length} filas agrupadas
        </Badge>
        <Badge variant="outline" className="rounded-full px-3 py-1">
          {selectedDimensions.length ? selectedDimensions.length : "Sin"} dimensiones activas
        </Badge>
      </div>

      <ScrollFadeTable className="rounded-[24px] border border-border/60" topScrollbar>
        <table className="min-w-[1120px] w-full text-sm">
          <thead className="sticky top-0 z-10">
            <tr>
              {leadingColumns.map((column) => (
                <TH key={column.key}>{column.label}</TH>
              ))}
              <TH right>Horas total</TH>
              <TH right>Cajas 10kg</TH>
              <TH right>% Part. CLS</TH>
              <TH right>% Part. SB</TH>
              <TH right>% Part. EMP</TH>
              <TH right>H/Caja total</TH>
              <TH right>Meta H/Caja</TH>
              <TH right>% Cumplimiento</TH>
            </tr>
          </thead>
          <tbody>
            {groupedRows.map((group) => {
              const isExpanded = expandedGroups.has(group.id);
              return (
                <React.Fragment key={group.id}>
                  <tr className="cursor-pointer bg-background/80 hover:bg-primary/5" onClick={() => toggleGroup(group.id)}>
                    {leadingColumns.map((column, columnIndex) => (
                      <TD key={`${group.id}-${column.key}`} className={cn(columnIndex === 0 && "font-medium")}>
                        <div className={cn("flex items-center gap-2", columnIndex > 0 && "pl-1")}>
                          {columnIndex === 0 ? (
                            isExpanded ? (
                              <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
                            )
                          ) : null}
                          <span>
                            {column.key === "summary"
                              ? "Total general"
                              : group.groupValues[column.key as ProductivityGroupingKey] ?? "-"}
                          </span>
                          {columnIndex === 0 ? (
                            <Badge variant="outline" className="rounded-full px-2 py-0.5 text-[10px]">
                              {group.rowCount} registros
                            </Badge>
                          ) : null}
                        </div>
                      </TD>
                    ))}
                    <TD right>{formatHours(group.totalHours)}</TD>
                    <TD right>{formatDecimal(group.totalBoxes10, 2)}</TD>
                    <TD right>{participationLabel(group.totalHoursCls, group.totalHours)}</TD>
                    <TD right>{participationLabel(group.totalHoursSb, group.totalHours)}</TD>
                    <TD right>{participationLabel(group.totalHoursEmp, group.totalHours)}</TD>
                    <TD right>{ratioLabel(group.totalHours, group.totalBoxes10)}</TD>
                    <TD right muted>-</TD>
                    <TD right className={complianceClassName(null)}>-</TD>
                  </tr>

                  {isExpanded ? (
                    <DestinationActivityDetailRows
                      filters={filters}
                      yearScope={group.scope.yearScope}
                      monthScope={group.scope.monthScope}
                      isoWeekId={group.scope.isoWeekId}
                      areaScope={group.scope.areaScope}
                      pathPost={group.scope.pathPostScope}
                      finalDestination={group.scope.finalDestinationScope}
                      varietyScope={group.scope.varietyScope}
                      boxes10={group.totalBoxes10}
                      leadingColumnCount={leadingColumns.length}
                    />
                  ) : null}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </ScrollFadeTable>
    </div>
  );
}

export function PostcosechaProductividadPage({
  initialData,
}: {
  initialData: PostharvestProductivityDashboardData;
}) {
  const [filters, setFilters] = useState<PostharvestProductivityFilters>(initialData.filters);
  const deferredFilters = useDeferredValue(filters);
  const initialFilterKey = useMemo(() => buildQueryString(initialData.filters), [initialData.filters]);
  const filterKey = useMemo(() => buildQueryString(deferredFilters), [deferredFilters]);

  const { data: dashboardData, error, isValidating } = useSWR(
    `/api/postcosecha/productividad?${filterKey}`,
    dashboardFetcher,
    {
      fallbackData: filterKey === initialFilterKey ? initialData : undefined,
      keepPreviousData: true,
      revalidateOnFocus: false,
      dedupingInterval: 15000,
    },
  );

  const data = dashboardData ?? initialData;

  useEffect(() => {
    if (error) {
      toast.error(error.message || "Error al cargar productividad de postcosecha");
    }
  }, [error]);

  function update<K extends keyof PostharvestProductivityFilters>(key: K, value: PostharvestProductivityFilters[K]) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function resetFilters() {
    setFilters(defaultPostharvestProductivityFilters);
  }

  return (
    <div className="min-w-0 space-y-4">
      <SectionPageShell
        eyebrow="Analítica / Postcosecha / Indicadores & KPI"
        title="Productividad"
        subtitle="Horas trabajadas por caja 10kg consolidadas por fecha post. Agrupa la tabla por semana, camino, destino, área o variedad según el análisis que necesites."
        icon={<Clock className="size-6" />}
        actions={<PostcosechaProductividadPdfExportButton filters={filters} />}
      >
        <FilterPanel>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <DateField id="post-date-from" label="Fecha post desde" value={filters.dateFrom} onChange={(value) => update("dateFrom", value)} />
            <DateField id="post-date-to" label="Fecha post hasta" value={filters.dateTo} onChange={(value) => update("dateTo", value)} />
            <MultiSelectField id="post-area" label="Área" value={filters.area} options={data.options.areas} onChange={(value) => update("area", value)} />
            <MultiSelectField id="post-path" label="Camino" value={filters.pathPost} options={data.options.paths} onChange={(value) => update("pathPost", value)} />
            <MultiSelectField id="post-destination" label="Destino" value={filters.finalDestination} options={data.options.finalDestinations} onChange={(value) => update("finalDestination", value)} />
            <MultiSelectField id="post-variety" label="Variedad" value={filters.variety} options={data.options.varieties} onChange={(value) => update("variety", value)} />
            <div className="xl:col-span-4 flex justify-end">
              <Button variant="outline" className="min-w-40" onClick={resetFilters}>
                Restablecer
              </Button>
            </div>
          </div>

          <KpiGrid columns={5}>
            <MetricTile label="Fechas post" value={formatDecimal(data.summary.postDateCount, 0)} />
            <MetricTile label="Kg procesados" value={formatDecimal(data.summary.totalWeightKg, 2)} />
            <MetricTile label="Cajas 10kg" value={formatDecimal(data.summary.totalBoxes10, 2)} />
            <MetricTile label="Horas totales" value={formatHours(data.summary.totalHours)} />
            <MetricTile label="H/Caja total" value={formatDecimal(data.summary.weightedHoursPerBox, 4)} />
          </KpiGrid>

          <KpiGrid columns={5}>
            <MetricTile label="% Part. CLS" value={participationLabel(data.summary.totalHoursCls, data.summary.totalHours)} />
            <MetricTile label="% Part. SB" value={participationLabel(data.summary.totalHoursSb, data.summary.totalHours)} />
            <MetricTile label="% Part. EMP" value={participationLabel(data.summary.totalHoursEmp, data.summary.totalHours)} />
            <MetricTile label="Meta H/Caja" value="-" />
            <MetricTile label="% Cumplimiento" value="-" />
          </KpiGrid>

          {isValidating ? (
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" />
              Actualizando productividad.
            </div>
          ) : null}
        </FilterPanel>
      </SectionPageShell>

      <DetailSection>
        <Card className="starter-panel border-border/70 bg-card/86">
          <CardContent className="pt-6">
            <PostharvestProductivityTable rows={data.rows} filters={filters} />
          </CardContent>
        </Card>
      </DetailSection>
    </div>
  );
}
