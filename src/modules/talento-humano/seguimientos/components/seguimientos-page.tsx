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
import { SingleSelectField } from "@/shared/filters/single-select-field";
import { DateField } from "@/shared/filters/date-field";
import { SearchInput } from "@/shared/forms/search-input";

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
};

const bootFetcher = (url: string) =>
  fetchJson<EmployeeFollowupBootPayload>(url, "No se pudo cargar el módulo.");

const followupFetcher = (url: string) =>
  fetchJson<{ rows: EmployeeScheduledFollowupRow[] }>(url, "No se pudo cargar seguimientos.");

function buildFollowupQuery(filters: EmployeeFollowupFilters) {
  const params = new URLSearchParams();
  if (filters.asOfDate) params.set("asOfDate", filters.asOfDate);
  if (filters.personSearch) params.set("q", filters.personSearch);
  if (filters.associatedWorker) params.set("associatedWorker", filters.associatedWorker);
  if (filters.route) params.set("route", filters.route);
  if (filters.status && filters.status !== "all") params.set("status", filters.status);
  if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) params.set("dateTo", filters.dateTo);
  return params.toString();
}

const today = new Date().toISOString().slice(0, 10);

const DEFAULT_FILTERS: EmployeeFollowupFilters = {
  asOfDate: today,
  status: "all",
};

export function SeguimientosPage({ initialCatalogs, initialWorkers }: Props) {
  const [filters, setFilters] = useState<EmployeeFollowupFilters>(DEFAULT_FILTERS);
  const [selectedFollowup, setSelectedFollowup] = useState<EmployeeScheduledFollowupRow | null>(null);

  const qs = buildFollowupQuery(filters);

  const { data: bootData } = useSWR("/api/talento-humano/seguimientos/boot", bootFetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 120_000,
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
  const rows = followupsData?.rows ?? [];

  const totalScheduled = rows.length;
  const totalPending = rows.filter((r) => r.status === "pending").length;
  const totalRegistered = rows.filter((r) => r.status === "registered").length;
  const totalAnnulled = rows.filter((r) => r.status === "annulled").length;

  function setFilter<K extends keyof EmployeeFollowupFilters>(key: K, value: EmployeeFollowupFilters[K]) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function handleFollowupUpdated() {
    void mutateFollowups();
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
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
            <SearchInput
              placeholder="Buscar persona..."
              value={filters.personSearch ?? ""}
              onChange={(v) => setFilter("personSearch", v || undefined)}
            />
            <SingleSelectField
              id="filter-worker"
              label="Trabajadora social"
              value={filters.associatedWorker ?? ""}
              options={workerOptions}
              onChange={(v) => setFilter("associatedWorker", v || undefined)}
              emptyLabel="Todas"
            />
            <SingleSelectField
              id="filter-route"
              label="Ruta"
              value={filters.route ?? ""}
              options={["AGR", "ADM"]}
              displayValue={(v) => (v === "AGR" ? "Agrícola" : "Administrativo")}
              onChange={(v) => setFilter("route", (v as "AGR" | "ADM") || undefined)}
              emptyLabel="Todas"
            />
            <SingleSelectField
              id="filter-status"
              label="Estado"
              value={filters.status ?? "all"}
              options={["all", "pending", "registered", "annulled"]}
              displayValue={(v) => ({ all: "Todos", pending: "Pendiente", registered: "Registrado", annulled: "Anulado" }[v] ?? v)}
              onChange={(v) => setFilter("status", (v as EmployeeFollowupFilters["status"]) || "all")}
              omitEmpty
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
          </div>
          <KpiGrid>
            <MetricTile label="Programados" value={String(totalScheduled)} />
            <MetricTile label="Pendientes" value={String(totalPending)} />
            <MetricTile label="Registrados" value={String(totalRegistered)} />
            <MetricTile label="Anulados" value={String(totalAnnulled)} />
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
        />
      )}
    </div>
  );
}
