"use client";

import { useState } from "react";
import { UserSquare } from "lucide-react";
import useSWR from "swr";
import { toast } from "sonner";

import { fetchJson } from "@/lib/fetch-json";
import { SectionPageShell } from "@/shared/layout/section-page-shell";
import { FilterPanel, KpiGrid } from "@/shared/layout/filter-panel";
import { MetricTile } from "@/shared/data-display/metric-tile";
import { EmptyState } from "@/shared/data-display/empty-state";
import { DateField } from "@/shared/filters/date-field";
import { MultiSelectField } from "@/shared/filters/multi-select-field";
import { SearchInput } from "@/shared/forms/search-input";
import { Label } from "@/shared/ui/label";
import { Button } from "@/shared/ui/button";
import { formatMonthNumeric, localDateString } from "@/shared/lib/format";

import type {
  EmployeeFollowupBootPayload,
  EmployeeFollowupCatalogMap,
  EmployeeFollowupFilters,
  EmployeeScheduledFollowupRow,
} from "@/modules/talento-humano/seguimientos/server/types";
import { FollowupWorkspace } from "@/modules/talento-humano/seguimientos/components/followup-workspace";

type Props = {
  initialCatalogs: EmployeeFollowupCatalogMap;
  initialWorkers: string[];
  initialAreas: string[];
  initialDateOptions: { years: string[]; months: string[] };
};

const bootFetcher = (url: string) =>
  fetchJson<EmployeeFollowupBootPayload>(url, "No se pudo cargar el módulo.", { cache: "no-store" });

const followupFetcher = (url: string) =>
  fetchJson<{ rows: EmployeeScheduledFollowupRow[] }>(url, "No se pudo cargar seguimientos.");

function buildFollowupQuery(filters: EmployeeFollowupFilters) {
  const params = new URLSearchParams();
  if (filters.asOfDate) params.set("asOfDate", filters.asOfDate);
  if (filters.personSearch) params.set("q", filters.personSearch);
  if (filters.associatedWorker) params.set("associatedWorker", filters.associatedWorker);
  if (filters.area) params.set("area", filters.area);
  if (filters.route) params.set("route", filters.route);
  if (filters.status) params.set("status", filters.status);
  if (filters.year && filters.year !== "all") params.set("year", filters.year);
  if (filters.month && filters.month !== "all") params.set("month", filters.month);
  if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) params.set("dateTo", filters.dateTo);
  return params.toString();
}

const today = localDateString();
const currentYear = String(new Date().getFullYear());
const currentMonth = String(new Date().getMonth() + 1);

const DEFAULT_FILTERS: EmployeeFollowupFilters = {
  asOfDate: today,
  year: currentYear,
  month: currentMonth,
};

export function SeguimientosPage({ initialCatalogs, initialWorkers, initialAreas, initialDateOptions }: Props) {
  const [filters, setFilters] = useState<EmployeeFollowupFilters>(DEFAULT_FILTERS);
  const [selectedFollowup, setSelectedFollowup] = useState<EmployeeScheduledFollowupRow | null>(null);

  const qs = buildFollowupQuery(filters);

  const { data: bootData } = useSWR("/api/talento-humano/seguimientos/boot", bootFetcher, {
    fallbackData: {
      catalogs: initialCatalogs,
      options: {
        routes: [
          { value: "AGR", label: "Agrícola" },
          { value: "ADM", label: "Administrativo" },
        ],
        associatedWorkers: initialWorkers,
        areas: initialAreas,
        years: initialDateOptions.years,
        months: initialDateOptions.months,
        statuses: [
          { value: "pending", label: "Pendiente" },
          { value: "registered", label: "Registrado" },
        ],
      },
      permissions: { canWrite: false, canSensitive: false, canAdmin: false },
    },
    revalidateOnFocus: false,
    dedupingInterval: 15_000,
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "No se pudo cargar el módulo."),
  });

  const { data: followupsData, isValidating, mutate: mutateFollowups } = useSWR(
    `/api/talento-humano/seguimientos/followup-search?${qs}`,
    followupFetcher,
    {
      keepPreviousData: true,
      revalidateOnFocus: false,
      dedupingInterval: 15_000,
      onError: (error) =>
        toast.error(error instanceof Error ? error.message : "No se pudo cargar seguimientos."),
    },
  );

  const catalogs = bootData?.catalogs ?? initialCatalogs;
  const permissions = bootData?.permissions ?? { canWrite: false, canSensitive: false, canAdmin: false };
  const workerOptions = bootData?.options.associatedWorkers ?? initialWorkers;
  const areaOptions = bootData?.options.areas ?? initialAreas;
  const yearOptions = bootData?.options.years ?? initialDateOptions.years;
  const monthOptions = bootData?.options.months ?? initialDateOptions.months;
  const rows = followupsData?.rows ?? [];

  const totalScheduled = rows.length;
  const totalPending = rows.filter((r) => r.status === "pending").length;
  const totalRegistered = rows.filter((r) => r.status === "registered").length;

  function setFilter<K extends keyof EmployeeFollowupFilters>(key: K, value: EmployeeFollowupFilters[K]) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function handleFollowupUpdated() {
    void mutateFollowups();
    setSelectedFollowup(null);
  }

  function resetFilters() {
    setFilters(DEFAULT_FILTERS);
    setSelectedFollowup(null);
  }

  return (
    <div className="space-y-4">
      <SectionPageShell
        eyebrow="Gestión / Talento Humano / Registros"
        title="Seguimientos Trabajo Social"
        subtitle="Consulta seguimientos programados y registra respuestas AGR/ADM."
        icon={<UserSquare className="h-5 w-5" />}
      >
        <FilterPanel>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
              <div className="min-w-0 space-y-2">
                <Label htmlFor="filter-person-search">Buscar</Label>
                <SearchInput
                  id="filter-person-search"
                  placeholder="Nombre o codigo..."
                  value={filters.personSearch ?? ""}
                  onChange={(v) => setFilter("personSearch", v || undefined)}
                />
              </div>
              <MultiSelectField
                id="filter-worker"
                label="Trabajadora social"
                value={filters.associatedWorker ?? ""}
                options={workerOptions}
                onChange={(value) => setFilter("associatedWorker", value || undefined)}
              />
              <MultiSelectField
                id="filter-area"
                label="Cod. Área"
                value={filters.area ?? ""}
                options={areaOptions}
                onChange={(value) => setFilter("area", value || undefined)}
              />
              <MultiSelectField
                id="filter-route"
                label="Clasificación"
                value={filters.route ?? ""}
                options={["AGR", "ADM"]}
                displayValue={(v) => (v === "AGR" ? "Agrícola" : "Administrativo")}
                onChange={(value) => setFilter("route", value || undefined)}
              />
              <MultiSelectField
                id="filter-status"
                label="Estado"
                value={filters.status ?? ""}
                options={["pending", "registered"]}
                displayValue={(v) => ({ pending: "Pendiente", registered: "Registrado" }[v] ?? v)}
                onChange={(value) => setFilter("status", value || undefined)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
              <MultiSelectField
                id="filter-year"
                label="Año"
                value={filters.year ?? ""}
                options={yearOptions}
                onChange={(value) => setFilter("year", value)}
              />
              <MultiSelectField
                id="filter-month"
                label="Mes"
                value={filters.month ?? ""}
                options={monthOptions}
                onChange={(value) => setFilter("month", value)}
                displayValue={formatMonthNumeric}
              />
              <DateField
                label="Desde"
                value={filters.dateFrom ?? ""}
                onChange={(v) => setFilter("dateFrom", v || undefined)}
              />
              <DateField
                label="Hasta"
                value={filters.dateTo ?? ""}
                onChange={(v) => setFilter("dateTo", v || undefined)}
              />
              <div className="flex items-end">
                <Button type="button" variant="outline" className="h-11 w-full rounded-[16px]" onClick={resetFilters}>
                  Reestablecer filtros
                </Button>
              </div>
            </div>
          </div>
          <KpiGrid columns={3}>
            <MetricTile label="Programados" value={String(totalScheduled)} />
            <MetricTile label="Pendientes" value={String(totalPending)} />
            <MetricTile label="Realizados" value={String(totalRegistered)} />
          </KpiGrid>
        </FilterPanel>
      </SectionPageShell>

      {rows.length === 0 && !isValidating ? (
        <EmptyState label="No se encontraron seguimientos con los filtros actuales." />
      ) : (
        <FollowupWorkspace
          rows={rows}
          catalogs={catalogs}
          permissions={permissions}
          selectedFollowup={selectedFollowup}
          onSelectFollowup={setSelectedFollowup}
          onFollowupUpdated={handleFollowupUpdated}
          isLoading={isValidating}
          asOfDate={filters.asOfDate}
          exportUrl={`/api/talento-humano/seguimientos/export-pdf?${qs}`}
          exportXlsxUrl={`/api/talento-humano/seguimientos/export-xlsx?${qs}`}
        />
      )}
    </div>
  );
}
