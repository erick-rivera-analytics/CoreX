"use client";

import type { TalentoFilters, TalentoFilterOptions } from "@/lib/talento-humano";
import { MultiSelectField } from "@/shared/filters/multi-select-field";
import { DateField } from "@/shared/filters/date-field";
import { WeekField } from "@/shared/filters/week-field";
import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";

import { TALENTO_WEEK_OPTIONS } from "@/modules/talento-humano/components/talento-view-utils";

type CommonFilterChange = <K extends keyof TalentoFilters>(key: K, value: TalentoFilters[K]) => void;

export function TalentoFilterToolbar({
  mode,
  filters,
  options,
  onFilterChange,
  onReset,
  onRefresh,
  refreshing,
  extraControls,
  containerless = false,
}: {
  mode: "snapshot" | "range";
  filters: TalentoFilters;
  options: TalentoFilterOptions;
  onFilterChange: CommonFilterChange;
  onReset: () => void;
  onRefresh: () => void;
  refreshing?: boolean;
  extraControls?: React.ReactNode;
  containerless?: boolean;
}) {
  const content = (
    <div className="space-y-4 overflow-visible px-0 py-0">
      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-6">
        {mode === "snapshot" ? (
          <DateField label="Dia de corte" value={filters.snapshotDate} onChange={(value) => onFilterChange("snapshotDate", value)} />
        ) : (
          <>
            <WeekField label="Semana desde" value={filters.weekFrom} options={TALENTO_WEEK_OPTIONS} onChange={(value) => onFilterChange("weekFrom", value)} />
            <WeekField label="Semana hasta" value={filters.weekTo} options={TALENTO_WEEK_OPTIONS} onChange={(value) => onFilterChange("weekTo", value)} />
          </>
        )}
        {extraControls}
        <MultiSelectField id={`talento-filter-area-general-${mode}`} label="Area general" value={filters.areaGeneral} options={options.areaGenerals} onChange={(value) => onFilterChange("areaGeneral", value)} />
        <MultiSelectField id={`talento-filter-area-${mode}`} label="Area" value={filters.area} options={options.areas} onChange={(value) => onFilterChange("area", value)} />
        <MultiSelectField id={`talento-filter-cargo-${mode}`} label="Cargo" value={filters.jobTitle} options={options.jobTitles} onChange={(value) => onFilterChange("jobTitle", value)} />
        <MultiSelectField id={`talento-filter-clasificacion-${mode}`} label="Clasificacion" value={filters.jobClassification} options={options.jobClassifications} onChange={(value) => onFilterChange("jobClassification", value)} />
        <MultiSelectField id={`talento-filter-ts-${mode}`} label="Trabajadora social" value={filters.associatedWorker} options={options.associatedWorkers} onChange={(value) => onFilterChange("associatedWorker", value)} />
        <MultiSelectField id={`talento-filter-genero-${mode}`} label="Genero" value={filters.gender} options={options.genders} onChange={(value) => onFilterChange("gender", value)} />
        <MultiSelectField id={`talento-filter-estado-civil-${mode}`} label="Estado civil" value={filters.maritalStatus} options={options.maritalStatuses} onChange={(value) => onFilterChange("maritalStatus", value)} />
        <MultiSelectField id={`talento-filter-ciudad-${mode}`} label="Ciudad" value={filters.city} options={options.cities} onChange={(value) => onFilterChange("city", value)} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onReset}>
          Restablecer
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onRefresh} disabled={refreshing}>
          {refreshing ? "Cargando..." : "Actualizar"}
        </Button>
      </div>
    </div>
  );

  if (containerless) {
    return content;
  }

  return (
    <Card className="overflow-visible bg-card/90">
      <CardContent className="space-y-4 overflow-visible px-5 py-5">{content}</CardContent>
    </Card>
  );
}
