"use client";

import React, { useDeferredValue, useMemo, useState } from "react";
import { Clock, ChevronDown, ChevronRight, LoaderCircle, RefreshCcw } from "lucide-react";
import useSWR from "swr";
import { toast } from "sonner";

import { BlockProfileModal } from "@/modules/fenograma/components/block-profile-modal";
import { PersonProfileDialog } from "@/shared/overlays/person-profile-dialog";
import { useBlockProfileModal } from "@/hooks/use-block-profile-modal";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { InteractiveCell } from "@/shared/tables/interactive-cell";
import { ScrollFadeTable } from "@/shared/tables/scroll-fade-table";
import { Card, CardContent } from "@/shared/ui/card";
import { fetchJson } from "@/lib/fetch-json";
import { MultiSelectField } from "@/shared/filters/multi-select-field";
import { SingleSelectField } from "@/shared/filters/single-select-field";
import { DetailSection, FilterPanel, KpiGrid } from "@/shared/layout/filter-panel";
import { SectionPageShell } from "@/shared/layout/section-page-shell";
import { formatDecimal, formatHours, formatInteger, formatMonthNumeric, formatPercent } from "@/shared/lib/format";
import { MetricTile } from "@/shared/data-display/metric-tile";
import { EmptyState } from "@/shared/data-display/empty-state";
import type { BlockModalRow } from "@/lib/fenograma";
import type {
  CycleLaborHoursPayload,
  CycleLaborCostAreaSummary,
  CycleLaborSubCostCenterSummary,
  CycleLaborPersonSummary,
} from "@/lib/fenograma";
import type {
  ProductividadDashboardData,
  ProductividadEtapa,
  ProductividadFilters,
  ProductividadRow,
} from "@/lib/productividad";

// ── Fetcher ───────────────────────────────────────────────────────────────────
const prodFetcher = (url: string) =>
  fetchJson<ProductividadDashboardData>(url, "No se pudo cargar el dashboard de productividad.");

const detailFetcher = (url: string) =>
  fetchJson<CycleLaborHoursPayload>(url, "No se pudo cargar el detalle del ciclo.");

// ── Query string ──────────────────────────────────────────────────────────────
function buildQueryString(filters: ProductividadFilters): string {
  const params = new URLSearchParams();
  params.set("year", filters.year);
  params.set("month", filters.month);
  params.set("spType", filters.spType);
  params.set("variety", filters.variety);
  params.set("area", filters.area);
  params.set("status", filters.status);
  params.set("costArea", filters.costArea);
  return params.toString();
}

// ── Formatters ────────────────────────────────────────────────────────────────
// ── BlockModalRow builder ─────────────────────────────────────────────────────
function buildBlockModalRow(row: ProductividadRow): BlockModalRow {
  return {
    block: row.block || row.cycleKey,
    cycleKey: row.cycleKey,
    area: row.area,
    variety: row.variety,
    spType: row.spType,
    spDate: row.spDate,
    harvestStartDate: row.harvestStartDate,
    harvestEndDate: row.harvestEndDate,
    totalStems: row.totalStems ?? 0,
    primaryMetricLabel: "Hora / Caja",
    primaryMetricText: formatHours(row.horaCaja),
  };
}

// ── Status badge ──────────────────────────────────────────────────────────────
const STATUS_STYLES: Record<string, string> = {
  Abierto:     "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
  Cerrado:     "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
  Planificado: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
};

function StatusBadge({ status }: { status: "Planificado" | "Abierto" | "Cerrado" }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_STYLES[status]}`}>
      {status}
    </span>
  );
}

// ── Cycle-level grouping (for summary metrics) ───────────────────────────────
type CycleGroup = {
  cycleKey: string;
  block: string;
  area: string;
  variety: string;
  spType: string;
  cycleStatus: "Planificado" | "Abierto" | "Cerrado";
  pctMortality: number | null;
  representative: ProductividadRow;
  totalEffectiveHours: number;
  cajas: number | null;
  camas30: number | null;
  plantsCurrentOrInitial: number | null;
  initialPlantsCycle: number | null;
  reseedPlantsCycle: number | null;
  deadPlantsCycle: number | null;
  horaCaja: number | null;
  cajaCama: number | null;
  horaCama: number | null;
  tallosPlanta: number | null;
  pesoTalloGramos: number | null;
};

type YearGroup = {
  year: string;
  cycles: CycleGroup[];
  totalEffectiveHours: number;
  totalCajas: number;
  totalCamas30: number;
  totalStems: number;
  // Mortandad directa: Σ(dead_plants_count) / Σ(inicial + resiembras)
  totalInitialPlusReseeds: number;
  totalDeadPlants: number;
  // Tallos/Planta: solo ciclos con plants_current > 0 (igual que ficha del bloque)
  totalStemsForRatio: number;
  totalPlantsForRatio: number;
};

function groupRows(rows: ProductividadRow[]): YearGroup[] {
  const cycleMap = new Map<string, CycleGroup>();

  for (const row of rows) {
    const key = row.cycleKey;
    if (!cycleMap.has(key)) {
      cycleMap.set(key, {
        cycleKey: row.cycleKey,
        block: row.block,
        area: row.area,
        variety: row.variety,
        spType: row.spType,
        cycleStatus: row.cycleStatus,
        pctMortality: row.pctMortality,
        representative: row,
        totalEffectiveHours: 0,
        cajas: row.cajas,
        camas30: row.camas30,
        plantsCurrentOrInitial: row.plantsCurrentOrInitial,
        initialPlantsCycle: row.initialPlantsCycle,
        reseedPlantsCycle: row.reseedPlantsCycle,
        deadPlantsCycle: row.deadPlantsCycle,
        horaCaja: null,
        cajaCama: row.cajaCama,
        horaCama: null,
        tallosPlanta: row.tallosPlanta,
        pesoTalloGramos: row.pesoTalloGramos,
      });
    }
    cycleMap.get(key)!.totalEffectiveHours += row.effectiveHours ?? 0;
  }

  for (const cycle of cycleMap.values()) {
    const cajas = cycle.cajas;
    cycle.horaCaja = cajas !== null && cajas > 0 ? cycle.totalEffectiveHours / cajas : null;
    cycle.horaCama = (cycle.horaCaja !== null && cycle.cajaCama !== null)
      ? cycle.horaCaja * cycle.cajaCama : null;
  }

  const yearMap = new Map<string, YearGroup>();
  const collator = new Intl.Collator("es-EC", { numeric: true });

  for (const cycle of cycleMap.values()) {
    const year = String(cycle.representative.harvestYear ?? "Sin ano");
    if (!yearMap.has(year)) {
      yearMap.set(year, {
        year,
        cycles: [],
        totalEffectiveHours: 0,
        totalCajas: 0,
        totalCamas30: 0,
        totalStems: 0,
        totalInitialPlusReseeds: 0,
        totalDeadPlants: 0,
        totalStemsForRatio: 0,
        totalPlantsForRatio: 0,
      });
    }
    const yg = yearMap.get(year)!;
    yg.cycles.push(cycle);
    yg.totalEffectiveHours += cycle.totalEffectiveHours;
    yg.totalCajas += cycle.cajas ?? 0;
    yg.totalCamas30 += cycle.camas30 ?? 0;
    yg.totalStems += cycle.representative.totalStems ?? 0;

    // Mortandad: Σ(muertas) / Σ(inicial + resiembras)
    yg.totalInitialPlusReseeds += (cycle.initialPlantsCycle ?? 0) + (cycle.reseedPlantsCycle ?? 0);
    yg.totalDeadPlants += cycle.deadPlantsCycle ?? 0;

    // Tallos/Planta: solo ciclos con plantas válidas (igual que ficha del bloque)
    if ((cycle.plantsCurrentOrInitial ?? 0) > 0) {
      yg.totalStemsForRatio += cycle.representative.totalStems ?? 0;
      yg.totalPlantsForRatio += cycle.plantsCurrentOrInitial!;
    }
  }

  return Array.from(yearMap.values())
    .sort((a, b) => collator.compare(b.year, a.year))
    .map((yg) => ({
      ...yg,
      cycles: yg.cycles.sort((a, b) => collator.compare(a.block, b.block)),
    }));
}

// ── Table helpers ─────────────────────────────────────────────────────────────
function TH({ children, right = false }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th scope="col" className={`border-b border-border/60 bg-background/95 px-3 py-2.5 text-xs font-semibold text-muted-foreground whitespace-nowrap ${right ? "text-right" : "text-left"}`}>
      {children}
    </th>
  );
}

function TD({
  children, right = false, muted = false, className = "", colSpan,
}: {
  children?: React.ReactNode; right?: boolean; muted?: boolean;
  className?: string; colSpan?: number;
}) {
  return (
    <td colSpan={colSpan} className={`border-b border-border/40 px-3 py-2 text-sm whitespace-nowrap ${right ? "text-right" : ""} ${muted ? "text-muted-foreground" : ""} ${className}`}>
      {children}
    </td>
  );
}

type SubCostCenterPersonHours = Pick<CycleLaborPersonSummary, "personId" | "personName"> & {
  effectiveHours: number;
};

type SubCostCenterActivityHours = {
  activityName: string;
  effectiveHours: number;
  people: SubCostCenterPersonHours[];
};

function sortPersonHours(people: SubCostCenterPersonHours[]): SubCostCenterPersonHours[] {
  return people.sort((left, right) => {
    const leftLabel = left.personName || left.personId;
    const rightLabel = right.personName || right.personId;
    const nameCompare = leftLabel.localeCompare(rightLabel, "es-EC", { numeric: true, sensitivity: "base" });
    return nameCompare !== 0 ? nameCompare : left.personId.localeCompare(right.personId, "es-EC", { numeric: true });
  });
}

function groupActivitiesBySubCostCenter(sub: CycleLaborSubCostCenterSummary): SubCostCenterActivityHours[] {
  const activitiesByName = new Map<string, {
    activityName: string;
    effectiveHours: number;
    peopleById: Map<string, SubCostCenterPersonHours>;
  }>();

  for (const activityType of sub.activityTypes) {
    for (const activity of activityType.activities) {
      const activityName = activity.activityName || "Sin actividad";
      const activityEntry = activitiesByName.get(activityName) ?? {
        activityName,
        effectiveHours: 0,
        peopleById: new Map<string, SubCostCenterPersonHours>(),
      };

      activityEntry.effectiveHours += activity.effectiveHours;
      activitiesByName.set(activityName, activityEntry);

      for (const person of activity.people) {
        const personId = person.personId;
        const current = activityEntry.peopleById.get(personId);
        if (current) {
          current.effectiveHours += person.effectiveHours;
          current.personName = current.personName || person.personName;
        } else {
          activityEntry.peopleById.set(personId, {
            personId,
            personName: person.personName,
            effectiveHours: person.effectiveHours,
          });
        }
      }
    }
  }

  return Array.from(activitiesByName.values())
    .map((activity) => ({
      activityName: activity.activityName,
      effectiveHours: activity.effectiveHours,
      people: sortPersonHours(Array.from(activity.peopleById.values())),
    }))
    .sort((left, right) => left.activityName.localeCompare(right.activityName, "es-EC", { numeric: true, sensitivity: "base" }));
}

// ── CycleDetailRows: lazy-loaded person-level drill-down ─────────────────────
function CycleDetailRows({
  cycleKey, cajas, camas30,
}: {
  cycleKey: string; cajas: number | null; camas30: number | null;
}) {
  const { data, error, isLoading } = useSWR(
    `/api/productividad/${encodeURIComponent(cycleKey)}/detail`,
    detailFetcher,
    { revalidateOnFocus: false, dedupingInterval: 30000 },
  );

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  function toggle(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  const hCaja = (hours: number) => (cajas !== null && cajas > 0 ? hours / cajas : null);
  const hCama = (hours: number) => (camas30 !== null && camas30 > 0 ? hours / camas30 : null);

  if (isLoading) {
    return (
      <tr><TD colSpan={11}>
        <div className="ml-10 flex items-center gap-2 py-2 text-xs text-muted-foreground">
          <LoaderCircle className="size-3.5 animate-spin" /> Cargando detalle...
        </div>
      </TD></tr>
    );
  }
  if (error || !data) {
    return (
      <tr><TD colSpan={11}>
        <div className="ml-10 py-2 text-xs text-destructive">
          {error?.message || "Error al cargar detalle"}
        </div>
      </TD></tr>
    );
  }

  return (
    <>
      {data.costAreas.map((ca: CycleLaborCostAreaSummary) => {
        const caKey = `ca|${cycleKey}|${ca.costArea}`;
        const caOpen = expanded.has(caKey);
        return (
          <React.Fragment key={caKey}>
            <tr className="cursor-pointer bg-muted/20 hover:bg-muted/30" onClick={() => toggle(caKey)}>
              <TD>
                <span className="ml-10 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                  {caOpen ? <ChevronDown className="size-3 shrink-0" /> : <ChevronRight className="size-3 shrink-0" />}
                  {ca.costArea}
                  <Badge variant="secondary" className="rounded-full px-1.5 py-0 text-[9px] font-normal">{ca.subCostCenters.length} sub</Badge>
                </span>
              </TD>
              <TD /><TD /><TD /><TD /><TD />
              <TD right className="text-xs font-semibold">{formatDecimal(hCaja(ca.effectiveHours))}</TD>
              <TD />
              <TD right className="text-xs font-semibold">{formatDecimal(hCama(ca.effectiveHours))}</TD>
              <TD /><TD />
            </tr>

            {caOpen && ca.subCostCenters.map((sub: CycleLaborSubCostCenterSummary) => {
              const subKey = `sub|${caKey}|${sub.subCostCenter}`;
              const subOpen = expanded.has(subKey);
              const activities = groupActivitiesBySubCostCenter(sub);
              return (
                <React.Fragment key={subKey}>
                  <tr className="cursor-pointer bg-background/30 hover:bg-muted/15" onClick={() => toggle(subKey)}>
                    <TD>
                      <span className="ml-16 flex items-center gap-1.5 text-xs text-muted-foreground">
                        {subOpen ? <ChevronDown className="size-3 shrink-0" /> : <ChevronRight className="size-3 shrink-0" />}
                        <Badge variant="outline" className="rounded px-1 py-0 text-[9px] font-normal">SUB</Badge>
                        {sub.subCostCenter}
                        <Badge variant="secondary" className="rounded-full px-1.5 py-0 text-[9px] font-normal">{activities.length} act.</Badge>
                      </span>
                    </TD>
                    <TD /><TD /><TD /><TD /><TD />
                    <TD right className="text-xs text-muted-foreground">{formatDecimal(hCaja(sub.effectiveHours))}</TD>
                    <TD />
                    <TD right className="text-xs text-muted-foreground">{formatDecimal(hCama(sub.effectiveHours))}</TD>
                    <TD /><TD />
                  </tr>

                  {subOpen && activities.map((activity) => {
                    const activityKey = `activity|${subKey}|${activity.activityName}`;
                    const activityOpen = expanded.has(activityKey);

                    return (
                      <React.Fragment key={activityKey}>
                        <tr className="cursor-pointer bg-background/15 hover:bg-muted/10" onClick={() => toggle(activityKey)}>
                          <TD>
                            <span className="ml-[88px] flex items-center gap-1.5 text-xs text-muted-foreground/80">
                              {activityOpen ? <ChevronDown className="size-3 shrink-0" /> : <ChevronRight className="size-3 shrink-0" />}
                              {activity.activityName}
                              <Badge variant="secondary" className="rounded-full px-1.5 py-0 text-[9px] font-normal">{activity.people.length} personas</Badge>
                            </span>
                          </TD>
                          <TD /><TD /><TD /><TD /><TD />
                          <TD right className="text-[11px] text-muted-foreground/70">{formatDecimal(hCaja(activity.effectiveHours))}</TD>
                          <TD />
                          <TD right className="text-[11px] text-muted-foreground/70">{formatDecimal(hCama(activity.effectiveHours))}</TD>
                          <TD /><TD />
                        </tr>

                        {activityOpen && activity.people.map((person) => (
                          <tr key={`person|${activityKey}|${person.personId}`} className="bg-background/5 hover:bg-muted/10">
                            <TD>
                              <span className="ml-[112px] inline-flex items-center gap-1.5">
                                <InteractiveCell
                                  variant="link"
                                  label={
                                    <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground/70">
                                      <span>{person.personName || "Sin nombre"}</span>
                                      <span className="text-[10px] text-muted-foreground/45">[{person.personId}]</span>
                                    </span>
                                  }
                                  ariaLabel={`Abrir ficha del personal ${person.personName || person.personId}`}
                                  onActivate={() => setSelectedPersonId(person.personId)}
                                  tooltip="Abrir ficha del personal"
                                  stopPropagation
                                />
                              </span>
                            </TD>
                            <TD /><TD /><TD /><TD /><TD />
                            <TD right className="text-[11px] text-muted-foreground/60">{formatDecimal(hCaja(person.effectiveHours))}</TD>
                            <TD />
                            <TD right className="text-[11px] text-muted-foreground/60">{formatDecimal(hCama(person.effectiveHours))}</TD>
                            <TD /><TD />
                          </tr>
                        ))}
                      </React.Fragment>
                    );
                  })}
                  {subOpen && activities.length === 0 ? (
                    <tr className="bg-background/5">
                      <TD colSpan={11} className="pl-[88px] text-xs text-muted-foreground">
                        No hay actividades registradas para este subcentro.
                      </TD>
                    </tr>
                  ) : null}
                </React.Fragment>
              );
            })}
          </React.Fragment>
        );
      })}
      <PersonProfileDialog
        key={`person-profile-${cycleKey}-${selectedPersonId ?? "none"}`}
        open={Boolean(selectedPersonId)}
        personId={selectedPersonId ?? ""}
        sourceContext={{ module: "productividad", cycleKey, camas30 }}
        onClose={() => setSelectedPersonId(null)}
      />
    </>
  );
}

// ── ProductividadTable ────────────────────────────────────────────────────────
function ProductividadTable({
  yearGroups,
  onCycleClick,
}: {
  yearGroups: YearGroup[];
  onCycleClick: (row: ProductividadRow) => void;
}) {
  const [expandedYears, setExpandedYears] = useState<Set<string>>(
    () => new Set(yearGroups.map((yg) => yg.year)),
  );
  const [expandedCycles, setExpandedCycles] = useState<Set<string>>(new Set());

  function toggleYear(year: string) {
    setExpandedYears((prev) => {
      const next = new Set(prev);
      if (next.has(year)) {
        next.delete(year);
      } else {
        next.add(year);
      }
      return next;
    });
  }

  function toggleCycle(cycleKey: string) {
    setExpandedCycles((prev) => {
      const next = new Set(prev);
      if (next.has(cycleKey)) {
        next.delete(cycleKey);
      } else {
        next.add(cycleKey);
      }
      return next;
    });
  }

  if (!yearGroups.length) {
    return <EmptyState label="No hay datos disponibles para el filtro actual." />;
  }

  return (
    <ScrollFadeTable className="rounded-[24px] border border-border/60">
      <table className="min-w-[1200px] w-full text-sm">
        <thead className="sticky top-0 z-10">
          <tr>
            <TH>Ciclo / Bloque</TH>
            <TH>Area</TH>
            <TH>Variedad</TH>
            <TH>Tipo SP</TH>
            <TH>Estado</TH>
            <TH right>Mort. %</TH>
            <TH right>Hora / Caja</TH>
            <TH right>Caja / Cama</TH>
            <TH right>Hora / Cama</TH>
            <TH right>Tallos / Planta</TH>
            <TH right>Peso Tallo (g)</TH>
          </tr>
        </thead>
        <tbody>
          {yearGroups.map((yg) => {
            const yearOpen = expandedYears.has(yg.year);
            const yearHoraCaja = yg.totalCajas > 0 ? yg.totalEffectiveHours / yg.totalCajas : null;
            const yearCajaCama = yg.totalCamas30 > 0 ? yg.totalCajas / yg.totalCamas30 : null;
            const yearHoraCama = yg.totalCamas30 > 0 ? yg.totalEffectiveHours / yg.totalCamas30 : null;
            // Tallos/Planta: Σ tallos / Σ plantas_finales (solo ciclos con plants > 0)
            const yearTallosPlanta = yg.totalPlantsForRatio > 0
              ? yg.totalStemsForRatio / yg.totalPlantsForRatio
              : null;
            const yearPesoTallo = yg.totalStems > 0
              ? (yg.totalCajas * 10000) / yg.totalStems
              : null;
            // Mortandad: Σ(dead_plants_count) / Σ(inicial + resiembras)
            const yearMortality = yg.totalInitialPlusReseeds > 0
              ? (yg.totalDeadPlants / yg.totalInitialPlusReseeds) * 100
              : null;

            return (
              <React.Fragment key={`year-${yg.year}`}>
                {/* ── Year row ── */}
                <tr className="cursor-pointer bg-muted/40 hover:bg-muted/60" onClick={() => toggleYear(yg.year)}>
                  <TD className="font-semibold">
                    <div className="flex items-center gap-2">
                      {yearOpen ? <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" /> : <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />}
                      <span>{yg.year}</span>
                      <Badge variant="secondary" className="rounded-full px-2 py-0.5 text-[10px]">{yg.cycles.length} ciclos</Badge>
                    </div>
                  </TD>
                  <TD /><TD /><TD /><TD />
                  <TD right className="font-semibold">{formatPercent(yearMortality)}</TD>
                  <TD right className="font-semibold">{formatDecimal(yearHoraCaja)}</TD>
                  <TD right className="font-semibold">{formatDecimal(yearCajaCama)}</TD>
                  <TD right className="font-semibold">{formatDecimal(yearHoraCama)}</TD>
                  <TD right className="font-semibold">{formatDecimal(yearTallosPlanta)}</TD>
                  <TD right className="font-semibold">{formatDecimal(yearPesoTallo)}</TD>
                </tr>

                {yearOpen && yg.cycles.map((cycle) => {
                  const cycleOpen = expandedCycles.has(cycle.cycleKey);

                  return (
                    <React.Fragment key={`cycle-${cycle.cycleKey}`}>
                      {/* ── Cycle row ── */}
                      <tr className="cursor-pointer bg-background/60 hover:bg-primary/5 transition-colors" onClick={(e) => { e.stopPropagation(); toggleCycle(cycle.cycleKey); }}>
                        <TD>
                          <div className="flex items-center gap-2">
                            <span className="ml-4 flex items-center gap-1.5">
                              {cycleOpen ? <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" /> : <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />}
                              <InteractiveCell
                                variant="link"
                                label={cycle.cycleKey}
                                onActivate={() => onCycleClick(cycle.representative)}
                                tooltip="Ver ficha del bloque"
                                stopPropagation
                              />
                            </span>
                            <span className="text-xs text-muted-foreground">{cycle.block}</span>
                          </div>
                        </TD>
                        <TD muted>{cycle.area}</TD>
                        <TD muted>{cycle.variety}</TD>
                        <TD muted>{cycle.spType}</TD>
                        <TD><StatusBadge status={cycle.cycleStatus} /></TD>
                        <TD right muted>{formatPercent(cycle.pctMortality)}</TD>
                        <TD right className="font-medium">{formatDecimal(cycle.horaCaja)}</TD>
                        <TD right muted>{formatDecimal(cycle.cajaCama)}</TD>
                        <TD right muted>{formatDecimal(cycle.horaCama)}</TD>
                        <TD right muted>{formatDecimal(cycle.tallosPlanta)}</TD>
                        <TD right muted>{formatDecimal(cycle.pesoTalloGramos)}</TD>
                      </tr>

                      {/* ── Detail drill-down (lazy-loaded) ── */}
                      {cycleOpen && (
                        <CycleDetailRows
                          cycleKey={cycle.cycleKey}
                          cajas={cycle.cajas}
                          camas30={cycle.camas30}
                        />
                      )}
                    </React.Fragment>
                  );
                })}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </ScrollFadeTable>
  );
}

// ── Main Explorer ─────────────────────────────────────────────────────────────
export function ProductividadExplorer({ initialData }: { initialData: ProductividadDashboardData }) {
  const [filters, setFilters] = useState<ProductividadFilters>(initialData.filters);
  const [selectedBlockRow, setSelectedBlockRow] = useState<BlockModalRow | null>(null);
  const deferredFilters = useDeferredValue(filters);

  const initialFilterKey = useMemo(() => buildQueryString(initialData.filters), [initialData.filters]);
  const filterKey = useMemo(() => buildQueryString(deferredFilters), [deferredFilters]);

  const blockModal = useBlockProfileModal(selectedBlockRow);

  const {
    data: dashboardData,
    error: dashboardError,
    isValidating,
    mutate,
  } = useSWR(`/api/productividad?${filterKey}`, prodFetcher, {
    fallbackData: filterKey === initialFilterKey ? initialData : undefined,
    keepPreviousData: true,
    revalidateOnFocus: false,
    dedupingInterval: 15000,
    onError: (err) => toast.error(err?.message || "Error al cargar productividad"),
  });

  const data = dashboardData ?? initialData;
  const yearGroups = useMemo(() => groupRows(data.rows), [data.rows]);

  function updateFilter<K extends keyof ProductividadFilters>(key: K, value: ProductividadFilters[K]) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function resetFilters() {
    setFilters(initialData.filters);
  }

  const etapaOptions = ["Vegetativo (Campo)", "Cosecha"] as const;
  const etapaMap: Record<string, ProductividadEtapa> = {
    "Vegetativo (Campo)": "CAMPO",
    "Cosecha": "COSECHA",
  };
  const etapaReverse: Record<string, string> = {
    CAMPO: "Vegetativo (Campo)",
    COSECHA: "Cosecha",
  };

  return (
    <div className="min-w-0 space-y-4">
      <SectionPageShell
        eyebrow="Dashboard / Indicadores / Campo"
        title="Productividad"
        subtitle="Productividad de mano de obra por ciclo y etapa operativa. Haz clic en un ciclo para abrir su ficha completa. Expande para ver el detalle por persona."
        icon={<Clock className="size-6" aria-hidden="true" />}
      >
        <FilterPanel>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-8">
            <MultiSelectField id="prod-year" label="Año" value={filters.year} options={data.options.years} onChange={(value) => updateFilter("year", value)} />
            <MultiSelectField id="prod-month" label="Mes" value={filters.month} options={data.options.months} onChange={(value) => updateFilter("month", value)} displayValue={formatMonthNumeric} />
            <MultiSelectField id="prod-area" label="Área" value={filters.area} options={data.options.areas} onChange={(value) => updateFilter("area", value)} />
            <MultiSelectField id="prod-sp-type" label="Tipo SP" value={filters.spType} options={data.options.spTypes} onChange={(value) => updateFilter("spType", value)} />
            <MultiSelectField id="prod-variety" label="Variedad" value={filters.variety} options={data.options.varieties} onChange={(value) => updateFilter("variety", value)} />
            <MultiSelectField id="prod-status" label="Estado" value={filters.status} options={data.options.statuses} onChange={(value) => updateFilter("status", value)} />
            <SingleSelectField
              id="prod-etapa"
              label="Etapa"
              value={etapaReverse[filters.costArea] ?? ""}
              options={[...etapaOptions]}
              onChange={(val) => updateFilter("costArea", etapaMap[val] ?? "all" as ProductividadEtapa)}
              emptyLabel="Todas las etapas"
            />
            <div className="flex items-end">
              <Button variant="outline" className="w-full" onClick={resetFilters}>
                <RefreshCcw className="size-4" aria-hidden="true" />
                Restablecer
              </Button>
            </div>
          </div>

          <KpiGrid>
            <MetricTile label="Ciclos" value={formatInteger(data.summary.totalCycles)} />
            <MetricTile label="Horas efectivas" value={formatHours(data.summary.totalEffectiveHours, 1)} />
            <MetricTile label="Cajas" value={formatInteger(data.summary.totalCajas)} />
            <MetricTile label="Hora / caja" value={formatHours(data.summary.weightedHoraCaja, 2)} />
          </KpiGrid>

          {isValidating ? (
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
              Actualizando productividad.
            </div>
          ) : null}
          {dashboardError ? (
            <div className="flex items-center gap-3 text-sm text-destructive">
              {dashboardError.message}
              <button type="button" className="underline underline-offset-2 hover:text-destructive/80" onClick={() => mutate()}>Reintentar</button>
            </div>
          ) : null}
        </FilterPanel>
      </SectionPageShell>

      <DetailSection>
        <Card className="starter-panel border-border/70 bg-card/86">
          <CardContent className="pt-6">
            <ProductividadTable
              yearGroups={yearGroups}
              onCycleClick={(row) => setSelectedBlockRow(buildBlockModalRow(row))}
            />
          </CardContent>
        </Card>
      </DetailSection>

      {/* ── Block Profile Modal ── */}
      <BlockProfileModal
        row={selectedBlockRow}
        data={blockModal.blockData}
        loading={blockModal.blockLoading}
        error={blockModal.blockError}
        selectedCycleKey={blockModal.selectedCycleKey}
        bedData={blockModal.bedData}
        bedLoading={blockModal.bedLoading}
        bedError={blockModal.bedError}
        selectedValveCycleKey={blockModal.selectedValveCycleKey}
        valvesData={blockModal.valvesData}
        valvesLoading={blockModal.valvesLoading}
        valvesError={blockModal.valvesError}
        selectedValve={blockModal.selectedValve}
        valveData={blockModal.valveData}
        valveLoading={blockModal.valveLoading}
        valveError={blockModal.valveError}
        selectedCurveCycleKey={blockModal.selectedCurveCycleKey}
        curveData={blockModal.curveData}
        curveLoading={blockModal.curveLoading}
        curveError={blockModal.curveError}
        selectedMortalityCurve={blockModal.selectedMortalityCurve}
        mortalityCurveData={blockModal.mortalityCurveData}
        mortalityCurveLoading={blockModal.mortalityCurveLoading}
        mortalityCurveError={blockModal.mortalityCurveError}
        onOpenBeds={blockModal.openBeds}
        onCloseBeds={blockModal.closeBeds}
        onOpenValves={blockModal.openValves}
        onCloseValves={blockModal.closeValves}
        onOpenValve={blockModal.openValve}
        onOpenCurve={blockModal.openCurve}
        onCloseCurve={blockModal.closeCurve}
        onOpenCycleMortalityCurve={blockModal.openCycleMortalityCurve}
        onOpenValveMortalityCurve={blockModal.openValveMortalityCurve}
        onOpenBedMortalityCurve={blockModal.openBedMortalityCurve}
        onCloseMortalityCurve={blockModal.closeMortalityCurve}
        onClose={() => setSelectedBlockRow(null)}
      />
    </div>
  );
}
