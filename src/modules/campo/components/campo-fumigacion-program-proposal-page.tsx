"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import {
  ChevronRight,
  CopyPlus,
  GripHorizontal,
  Plus,
  Rows4,
  Search,
  Sparkles,
  SprayCan,
  Trash2,
} from "lucide-react";
import useSWR from "swr";

import { fetchJson } from "@/lib/fetch-json";
import { FUMIGATION_ACTIVITY_IDS } from "@/lib/fumigation-activity-family";
import {
  FUMIGATION_PROGRAM_PROPOSAL_SEED,
  type FumigationProposalSeedApplication,
} from "@/lib/fumigation-program-proposal-seed";
import type { BodegaProductRecord } from "@/lib/bodega-master-types";
import { cn } from "@/lib/utils";
import { MetricTile } from "@/shared/data-display/metric-tile";
import { FilterPanel, KpiGrid } from "@/shared/layout/filter-panel";
import { SectionPageShell } from "@/shared/layout/section-page-shell";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { ScrollFadeTable } from "@/shared/tables/scroll-fade-table";
import { StandardTable, StandardTd, StandardTh } from "@/shared/tables/standard-table";

type ProgramKind = "REGULAR" | "DRON" | "LANZAS";

type Slot = {
  productName: string;
  quantity: string;
};

type ProgramApplication = FumigationProposalSeedApplication;

type ProgramWeek = {
  weekIso: number;
  applications: ProgramApplication[];
};

type ProgramDraft = {
  id: string;
  kind: ProgramKind;
  title: string;
  varietyCode: string;
  varietyLabel: string;
  phenologicalStartWeek: number;
  phenologicalEndWeek: number;
  startWeekIso: number;
  endWeekIso: number;
  modeLabel: string;
  cadenceLabel: string;
  focusLabel: string;
  statusLabel: string;
  weeks: ProgramWeek[];
};

const EMPTY_SLOT: Slot = { productName: "", quantity: "" };

const FALLBACK_PRODUCT_SUGGESTIONS = [
  "AGRAL",
  "ANTRACOL",
  "PREVICUR N",
  "PREVICUR",
  "FULMINANTE",
  "FULMINATE",
  "DIMILIN",
  "SILWET",
  "PHYTON",
  "REVUS",
  "RADIANT",
  "LANCHAFIN EQ",
  "SINODAFEN",
  "ETHOFIN",
  "TELDOR COMBI",
  "PIRESTAR",
  "VERTIMEC",
  "SIVANTO",
  "MANCOZEB",
  "DANTHOTSU",
  "RIDOMIL GOLD",
  "SULFOLAC",
] as const;

const PRODUCT_NAME_ALIASES: Record<string, string> = {
  ANTRACOL: "ANTRACOL 70% PM",
  FITORAZ: "FITORAZ 76 PM",
  FULMINATE: "FULMINANTE",
  PREVICUR: "PREVICUR N",
  CORRIDABUL: "CORRIDA BUL",
  DANTHOTSU: "DANTOTSU 500",
  POLYRAM: "POLYRAM 80%",
  "NIT. CA": "NITRATO DE CALCIO",
  "NIT. MG": "NITRATO DE MAGNESIO",
  "SULF DE K": "SULFATO DE POTASIO AGRICOLA",
  "NITROFOSKA 8-12-24": "NITROFOSKA AZUL 12-12-17+2",
  "METALOZATO DE CALCIO": "METALOSATO DE CALCIO",
  "TRACKING CA-B": "TRAKING CA-B",
  DACONIL: "DACONIL 720",
  AMISTAR: "AMISTAR TOP",
  ORTHENE: "ORTHENE 75%",
  POLO: "POLO 250 8C",
  KARATE: "KARATE ZEON",
  AVISO: "AVISO DF",
  TIFLO: "TIFLO 42",
  ROVRAL: "ROVRAL 50% POLVO",
  "SIVANTO PRIME 200 SL": "SIVANTO",
};

const bodegaProductsFetcher = (url: string) =>
  fetchJson<BodegaProductRecord[]>(url, "No se pudo cargar el maestro de productos de Bodega.");

const PROGRAM_KIND_META: Record<ProgramKind, { label: string; description: string }> = {
  REGULAR: {
    label: "Fumigacion regular",
    description: "Programa estandar del frente regular de fumigacion.",
  },
  DRON: {
    label: "Fumigacion por dron",
    description: "Programa de la hoja de dron con la misma logica de edicion horizontal.",
  },
  LANZAS: {
    label: "Lanzas eficientes",
    description: "Programa de la hoja de lanzas eficientes con matriz equivalente.",
  },
};

function createEmptySlot(): Slot {
  return { ...EMPTY_SLOT };
}

function normalizeLookupValue(value: string) {
  return value.trim().replace(/\s+/g, " ").toUpperCase();
}

function formatQuantityValue(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  const normalized = trimmed.replace(",", ".");
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    return trimmed;
  }

  return parsed.toFixed(2).replace(/\.?0+$/, "");
}

function normalizeSlot(slot: Slot) {
  return {
    ...slot,
    quantity: formatQuantityValue(slot.quantity),
  };
}

function sanitizeDecimalInput(value: string) {
  const normalized = value.replace(",", ".");
  let sanitized = "";
  let hasDecimalSeparator = false;

  for (const character of normalized) {
    if (character >= "0" && character <= "9") {
      sanitized += character;
      continue;
    }

    if (character === "." && !hasDecimalSeparator) {
      sanitized += character;
      hasDecimalSeparator = true;
    }
  }

  return sanitized;
}

function formatFumigationProductOption(product: BodegaProductRecord) {
  return `${product.productCode} · ${product.productName}`;
}

function resolveFumigationProduct(value: string, products: BodegaProductRecord[]) {
  const normalized = normalizeLookupValue(value);
  if (!normalized) {
    return null;
  }

  return products.find((product) => {
    const productCode = normalizeLookupValue(product.productCode);
    const productName = normalizeLookupValue(product.productName);
    const optionLabel = normalizeLookupValue(formatFumigationProductOption(product));
    return normalized === productCode || normalized === productName || normalized === optionLabel;
  }) ?? null;
}

function findCanonicalFumigationProduct(value: string, products: BodegaProductRecord[]) {
  const normalized = normalizeLookupValue(value);
  if (!normalized) {
    return null;
  }

  const aliasValue = PRODUCT_NAME_ALIASES[normalized];
  if (aliasValue) {
    const aliasMatch = products.find((product) => normalizeLookupValue(product.productName) === normalizeLookupValue(aliasValue));
    if (aliasMatch) {
      return aliasMatch;
    }
  }

  return products.find((product) => {
    const productCode = normalizeLookupValue(product.productCode);
    const productName = normalizeLookupValue(product.productName);
    return normalized === productCode || normalized === productName;
  }) ?? resolveFumigationProduct(value, products);
}

function formatCanonicalProductOption(product: BodegaProductRecord) {
  return product.productName;
}

function canonicalizeSlotProductName(slot: Slot, products: BodegaProductRecord[]) {
  const linkedProduct = findCanonicalFumigationProduct(slot.productName, products);
  if (!linkedProduct) {
    return slot;
  }

  return {
    ...slot,
    productName: linkedProduct.productName,
  };
}

function canonicalizeProgramsWithProducts(programs: ProgramDraft[], products: BodegaProductRecord[]) {
  return programs.map((program) => ({
    ...program,
    weeks: program.weeks.map((week) => ({
      ...week,
      applications: week.applications.map((application) => ({
        ...application,
        slots: application.slots.map((slot) => normalizeSlot(canonicalizeSlotProductName(slot, products))),
      })),
    })),
  }));
}

function splitWeekIso(weekIso: number) {
  const isoYear = Math.floor(weekIso / 100);
  const isoWeek = weekIso % 100;
  return { isoYear, isoWeek };
}

function getIsoWeeksInYear(isoYear: number) {
  const fullYear = 2000 + isoYear;
  const december28 = new Date(Date.UTC(fullYear, 11, 28));
  const day = december28.getUTCDay() || 7;
  const adjusted = new Date(december28);
  adjusted.setUTCDate(december28.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(adjusted.getUTCFullYear(), 0, 1));
  return Math.ceil((((adjusted.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function getCurrentIsoWeekValue(date: Date) {
  const currentDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = currentDate.getUTCDay() || 7;
  currentDate.setUTCDate(currentDate.getUTCDate() + 4 - day);
  const isoYear = currentDate.getUTCFullYear() % 100;
  const yearStart = new Date(Date.UTC(currentDate.getUTCFullYear(), 0, 1));
  const isoWeek = Math.ceil((((currentDate.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return (isoYear * 100) + isoWeek;
}

function buildWeekIsoSeries(startWeekIso: number, endWeekIso: number) {
  const series: number[] = [];
  let { isoYear, isoWeek } = splitWeekIso(startWeekIso);
  const end = splitWeekIso(endWeekIso);

  while (isoYear < end.isoYear || (isoYear === end.isoYear && isoWeek <= end.isoWeek)) {
    series.push((isoYear * 100) + isoWeek);
    const weeksInYear = getIsoWeeksInYear(isoYear);
    if (isoWeek >= weeksInYear) {
      isoYear += 1;
      isoWeek = 1;
    } else {
      isoWeek += 1;
    }
  }

  return series;
}

const INITIAL_PROGRAMS: ProgramDraft[] = FUMIGATION_PROGRAM_PROPOSAL_SEED;
const CURRENT_OPERATIONAL_WEEK_ISO = getCurrentIsoWeekValue(new Date());

function clonePrograms(programs: ProgramDraft[]) {
  return programs.map((program) => ({
    ...program,
    weeks: program.weeks.map((week) => ({
      ...week,
      applications: week.applications.map((application) => ({
        ...application,
        slots: application.slots.map((slot) => normalizeSlot({ ...slot })),
      })),
    })),
  }));
}

function ensureProgramWeekChain(program: ProgramDraft) {
  const orderedWeeks = [...program.weeks]
    .filter((week) => week.weekIso >= CURRENT_OPERATIONAL_WEEK_ISO)
    .sort((left, right) => left.weekIso - right.weekIso);
  const effectiveStartWeekIso = Math.max(program.startWeekIso, CURRENT_OPERATIONAL_WEEK_ISO);
  const effectiveEndWeekIso = orderedWeeks[orderedWeeks.length - 1]?.weekIso ?? program.endWeekIso;

  return {
    ...program,
    startWeekIso: effectiveStartWeekIso,
    endWeekIso: effectiveEndWeekIso,
    weeks: orderedWeeks.map((week) => ({
      ...week,
      applications: week.applications.map((application) => ({
        ...application,
        slots: application.slots.map((slot) => normalizeSlot({ ...slot })),
      })),
    })),
  };
}

function formatWeekRange(program: ProgramDraft) {

  return `${program.startWeekIso} - ${program.endWeekIso}`;
}

function formatPhenologicalRange(program: ProgramDraft) {
  return `${program.phenologicalStartWeek} - ${program.phenologicalEndWeek}`;
}

function countConfiguredSlots(program: ProgramDraft) {
  return program.weeks.reduce((total, week) => (
    total + week.applications.reduce((weekTotal, application) => (
      weekTotal + application.slots.filter((slot) => slot.productName.trim() || slot.quantity.trim()).length
    ), 0)
  ), 0);
}

function isSlotComplete(slot: Slot) {
  return Boolean(slot.productName.trim()) && Boolean(slot.quantity.trim());
}

function isWeekComplete(week: ProgramWeek) {
  return week.applications.every((application) => application.slots.every(isSlotComplete));
}

function summarizeApplication(application: ProgramApplication, products: BodegaProductRecord[]) {
  return application.slots.map((slot) => {
    const linkedProduct = findCanonicalFumigationProduct(slot.productName, products);
    return {
      ...slot,
      linkedProduct,
    };
  });
}

export function CampoFumigacionProgramProposalPage() {
  const [programs, setPrograms] = useState<ProgramDraft[]>(() => clonePrograms(INITIAL_PROGRAMS).map(ensureProgramWeekChain));
  const [selectedKind, setSelectedKind] = useState<ProgramKind>("REGULAR");
  const [selectedProgramId, setSelectedProgramId] = useState("regular-xlence-2-8");
  const [query, setQuery] = useState("");
  const [varietyFilter, setVarietyFilter] = useState("TODAS");
  const [weekFilterFrom, setWeekFilterFrom] = useState(String(CURRENT_OPERATIONAL_WEEK_ISO));
  const [hasCanonicalizedSeed, setHasCanonicalizedSeed] = useState(false);
  const [pendingDeleteWeekIso, setPendingDeleteWeekIso] = useState<number | null>(null);
  const [editingApplication, setEditingApplication] = useState<{ weekIso: number; applicationIndex: number } | null>(null);
  const deferredQuery = useDeferredValue(query);
  const deferredWeekFilterFrom = useDeferredValue(weekFilterFrom);
  const { data: bodegaProductsData } = useSWR(
    "/api/bodega/administrar-maestros/productos",
    bodegaProductsFetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000,
    },
  );

  const fumigationBodegaProducts = useMemo(() => (
    (bodegaProductsData ?? [])
      .filter((product) => product.isActive && product.assignments.some((assignment) => FUMIGATION_ACTIVITY_IDS.includes(assignment.activityId)))
      .sort((left, right) => left.productCode.localeCompare(right.productCode))
  ), [bodegaProductsData]);

  const productSuggestions = useMemo(() => {
    if (fumigationBodegaProducts.length) {
      return fumigationBodegaProducts.map(formatCanonicalProductOption);
    }
    return [...FALLBACK_PRODUCT_SUGGESTIONS];
  }, [fumigationBodegaProducts]);

  useEffect(() => {
    if (hasCanonicalizedSeed || fumigationBodegaProducts.length === 0) {
      return;
    }

    setPrograms((currentPrograms) => canonicalizeProgramsWithProducts(currentPrograms, fumigationBodegaProducts));
    setHasCanonicalizedSeed(true);
  }, [fumigationBodegaProducts, hasCanonicalizedSeed]);

  const visiblePrograms = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLowerCase();
    return programs.filter((program) => {
      const matchesKind = program.kind === selectedKind;
      const matchesVariety = varietyFilter === "TODAS" || program.varietyCode === varietyFilter;
      const matchesQuery = !normalizedQuery || [
        program.title,
        program.varietyCode,
        program.varietyLabel,
        program.focusLabel,
        program.cadenceLabel,
        String(program.phenologicalStartWeek),
        String(program.phenologicalEndWeek),
      ].some((value) => value.toLowerCase().includes(normalizedQuery));
      return matchesKind && matchesVariety && matchesQuery;
    });
  }, [deferredQuery, programs, selectedKind, varietyFilter]);

  const selectedProgram = useMemo(() => (
    visiblePrograms.find((program) => program.id === selectedProgramId)
    ?? programs.find((program) => program.id === selectedProgramId && program.kind === selectedKind)
    ?? visiblePrograms[0]
    ?? null
  ), [programs, selectedKind, selectedProgramId, visiblePrograms]);

  const visibleWeeks = useMemo(() => {
    if (!selectedProgram) return [];
    const fromWeek = Number(deferredWeekFilterFrom);
    if (!deferredWeekFilterFrom.trim() || !Number.isFinite(fromWeek)) {
      return selectedProgram.weeks;
    }
    return selectedProgram.weeks.filter((week) => week.weekIso >= fromWeek);
  }, [deferredWeekFilterFrom, selectedProgram]);

  const availableVarieties = useMemo(() => (
    ["TODAS", ...Array.from(new Set(programs.filter((program) => program.kind === selectedKind).map((program) => program.varietyCode)))]
  ), [programs, selectedKind]);

  const applicationCount = Math.max(1, ...visibleWeeks.map((week) => week.applications.length), 1);
  const maxPairsByApplication = Array.from({ length: applicationCount }, (_, applicationIndex) => (
    Math.max(
      1,
      ...visibleWeeks.map((week) => week.applications[applicationIndex]?.slots.length ?? 0),
      1,
    )
  ));
  const totalVisiblePairs = maxPairsByApplication.reduce((total, count) => total + count, 0);
  const lastWeekIsoInProgram = selectedProgram
    ? selectedProgram.weeks[selectedProgram.weeks.length - 1]?.weekIso ?? null
    : null;
  const editingWeek = editingApplication
    ? selectedProgram?.weeks.find((week) => week.weekIso === editingApplication.weekIso) ?? null
    : null;
  const editingApplicationData = editingApplication && editingWeek
    ? editingWeek.applications[editingApplication.applicationIndex] ?? null
    : null;

  function updateProgram(mutator: (current: ProgramDraft) => ProgramDraft) {
    if (!selectedProgram) return;
    setPrograms((currentPrograms) => currentPrograms.map((program) => (
      program.id === selectedProgram.id ? mutator(program) : program
    )));
  }

  function handleSlotChange(weekIso: number, applicationIndex: number, slotIndex: number, field: keyof Slot, value: string) {
    const nextValue = field === "quantity" ? sanitizeDecimalInput(value) : value;
    updateProgram((current) => ({
      ...current,
      weeks: current.weeks.map((week) => (
        week.weekIso === weekIso
          ? {
            ...week,
            applications: week.applications.map((application, currentApplicationIndex) => (
              currentApplicationIndex === applicationIndex
                ? {
                  ...application,
                  slots: application.slots.map((slot, currentSlotIndex) => (
                    currentSlotIndex === slotIndex ? { ...slot, [field]: nextValue } : slot
                  )),
                }
                : application
            )),
          }
          : week
      )),
    }));
  }

  function addSlotPairToWeek(weekIso: number, applicationIndex: number) {
    updateProgram((current) => ({
      ...current,
      weeks: current.weeks.map((week) => (
        week.weekIso === weekIso
          ? {
            ...week,
            applications: week.applications.map((application, currentApplicationIndex) => (
              currentApplicationIndex === applicationIndex
                ? { ...application, slots: [...application.slots, createEmptySlot()] }
                : application
            )),
          }
          : week
      )),
    }));
  }

  function removeLastPairFromWeek(weekIso: number, applicationIndex: number) {
    updateProgram((current) => ({
      ...current,
      weeks: current.weeks.map((week) => {
        if (week.weekIso !== weekIso) {
          return week;
        }

        return {
          ...week,
          applications: week.applications.map((application, currentApplicationIndex) => {
            if (currentApplicationIndex !== applicationIndex || application.slots.length <= 1) {
              return application;
            }
            return {
              ...application,
              slots: application.slots.slice(0, -1),
            };
          }),
        };
      }),
    }));
  }

  function addWeek() {
    if (!selectedProgram) return;
    const lastWeek = selectedProgram.weeks[selectedProgram.weeks.length - 1];
    const nextWeekIso = buildWeekIsoSeries(lastWeek?.weekIso ?? selectedProgram.startWeekIso, selectedProgram.endWeekIso + 100)[1]
      ?? ((lastWeek?.weekIso ?? selectedProgram.endWeekIso) + 1);
    updateProgram((current) => ({
      ...current,
      endWeekIso: nextWeekIso,
      weeks: [
        ...current.weeks,
        {
          weekIso: nextWeekIso,
          applications: lastWeek?.applications.map((application) => ({
            ...application,
            slots: [createEmptySlot()],
          })) ?? [
            { applicationNumber: 1, slots: [createEmptySlot()] },
            { applicationNumber: 2, slots: [createEmptySlot()] },
            { applicationNumber: 3, slots: [createEmptySlot()] },
          ],
        },
      ],
    }));
  }

  function duplicateLastWeek() {
    if (!selectedProgram) return;
    const lastWeek = selectedProgram.weeks[selectedProgram.weeks.length - 1];
    if (!lastWeek) return;
    const nextWeekIso = buildWeekIsoSeries(lastWeek.weekIso, selectedProgram.endWeekIso + 100)[1] ?? (lastWeek.weekIso + 1);
    updateProgram((current) => ({
      ...current,
      endWeekIso: nextWeekIso,
      weeks: [
        ...current.weeks,
        {
          ...lastWeek,
          weekIso: nextWeekIso,
          applications: lastWeek.applications.map((application) => ({
            ...application,
            slots: application.slots.map((slot) => ({ ...slot })),
          })),
        },
      ],
    }));
  }

  function removeWeek(weekIso: number) {
    if (!selectedProgram) return;
    const currentLastWeekIso = selectedProgram.weeks[selectedProgram.weeks.length - 1]?.weekIso;
    if (currentLastWeekIso !== weekIso) {
      return;
    }

    updateProgram((current) => {
      if (current.weeks.length <= 1) {
        return current;
      }
      return {
        ...current,
        endWeekIso: current.weeks[current.weeks.length - 2]?.weekIso ?? current.startWeekIso,
        weeks: current.weeks.filter((week) => week.weekIso !== weekIso),
      };
    });
  }

  function requestRemoveWeek(weekIso: number) {
    if (weekIso !== lastWeekIsoInProgram) {
      return;
    }
    setPendingDeleteWeekIso(weekIso);
  }

  function confirmRemoveWeek() {
    if (pendingDeleteWeekIso == null) {
      return;
    }
    removeWeek(pendingDeleteWeekIso);
    setPendingDeleteWeekIso(null);
  }

  function handleProductBlur(weekIso: number, applicationIndex: number, slotIndex: number) {
    if (!selectedProgram || fumigationBodegaProducts.length === 0) {
      return;
    }

    const week = selectedProgram.weeks.find((programWeek) => programWeek.weekIso === weekIso);
    const slot = week?.applications[applicationIndex]?.slots[slotIndex];
    if (!slot) {
      return;
    }

    const linkedProduct = findCanonicalFumigationProduct(slot.productName, fumigationBodegaProducts);
    if (!linkedProduct || linkedProduct.productName === slot.productName) {
      return;
    }

    handleSlotChange(weekIso, applicationIndex, slotIndex, "productName", linkedProduct.productName);
  }

  function handleQuantityBlur(weekIso: number, applicationIndex: number, slotIndex: number) {
    if (!selectedProgram) {
      return;
    }

    const week = selectedProgram.weeks.find((programWeek) => programWeek.weekIso === weekIso);
    const slot = week?.applications[applicationIndex]?.slots[slotIndex];
    if (!slot) {
      return;
    }

    const formattedQuantity = formatQuantityValue(slot.quantity);
    if (formattedQuantity === slot.quantity) {
      return;
    }

    handleSlotChange(weekIso, applicationIndex, slotIndex, "quantity", formattedQuantity);
  }

  const totalPrograms = programs.filter((program) => program.kind === selectedKind).length;
  const totalWeeks = programs
    .filter((program) => program.kind === selectedKind)
    .reduce((total, program) => total + program.weeks.length, 0);
  const totalConfiguredSlots = programs
    .filter((program) => program.kind === selectedKind)
    .reduce((total, program) => total + countConfiguredSlots(program), 0);

  return (
    <SectionPageShell
      eyebrow="Administracion / Maestros por dominio / Campo / Propuesta visual"
      title="Programacion Fumigacion"
      subtitle="Propuesta visual tipo Excel para administrar programas por tipo de fumigacion, variedad, rango fenologico y semana ISO, con edicion horizontal de pares producto/cantidad."
      icon={<SprayCan className="size-7" />}
      actions={<Badge className="rounded-full bg-emerald-600 px-3 py-1 text-white hover:bg-emerald-600">Propuesta UI</Badge>}
    >
      <FilterPanel>
        <KpiGrid columns={4}>
          <MetricTile label="Programas visuales" value={String(totalPrograms)} hint="Bloques visibles del tipo seleccionado." accent="success" />
          <MetricTile label="Semanas mapeadas" value={String(totalWeeks)} hint="Filas operativas de la ventana activa." />
          <MetricTile label="Celdas configuradas" value={String(totalConfiguredSlots)} hint="Pares producto/cantidad con contenido." />
          <MetricTile label="Ventana activa" value={PROGRAM_KIND_META[selectedKind].label} hint={PROGRAM_KIND_META[selectedKind].description} accent="warning" />
        </KpiGrid>

        <div className="space-y-4">
          <Card className="overflow-hidden border-border/70 bg-[linear-gradient(180deg,rgba(239,246,255,0.9),rgba(255,255,255,0.96))]">
            <CardHeader className="space-y-4 border-b border-border/60 bg-white/60">
              <div className="space-y-3">
                <div className="space-y-1">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Rows4 className="size-4 text-sky-700" />
                    Tipo de fumigacion
                  </CardTitle>
                  <CardDescription>
                    El modulo ahora separa el programa estandar por ventana real: Regular, Dron y Lanzas eficientes.
                  </CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(PROGRAM_KIND_META) as ProgramKind[]).map((kind) => {
                    const active = selectedKind === kind;
                    return (
                      <Button
                        key={kind}
                        type="button"
                        variant={active ? "default" : "outline"}
                        size="sm"
                        className={cn("rounded-full", active ? "shadow-sm" : "bg-white/85")}
                        onClick={() => {
                          setSelectedKind(kind);
                          setSelectedProgramId(INITIAL_PROGRAMS.find((program) => program.kind === kind)?.id ?? "");
                        }}
                      >
                        {PROGRAM_KIND_META[kind].label}
                      </Button>
                    );
                  })}
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4 p-3">
              <div className="grid gap-3">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Buscar variedad, foco o rango fenologico..."
                    className="pl-9"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  {availableVarieties.map((variety) => {
                    const active = varietyFilter === variety;
                    return (
                      <Button
                        key={variety}
                        type="button"
                        variant={active ? "default" : "outline"}
                        size="sm"
                        onClick={() => setVarietyFilter(variety)}
                        className={cn("rounded-full", active ? "shadow-sm" : "bg-white/85")}
                      >
                        {variety === "TODAS" ? "Todas" : variety}
                      </Button>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-3 overflow-x-auto pb-1">
                {visiblePrograms.map((program) => {
                  const isActive = selectedProgram?.id === program.id;
                  return (
                    <button
                      key={program.id}
                      type="button"
                      onClick={() => setSelectedProgramId(program.id)}
                      className={cn(
                        "group min-w-[320px] rounded-[20px] border px-4 py-4 text-left transition-all",
                        isActive
                          ? "border-sky-300 bg-sky-950 text-white shadow-[0_18px_40px_rgba(14,116,144,0.22)]"
                          : "border-border/70 bg-white/80 hover:border-sky-200 hover:bg-sky-50/70",
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge
                              variant="outline"
                              className={cn(
                                "rounded-full px-2.5 py-0.5",
                                isActive ? "border-white/20 bg-white/10 text-white" : "border-sky-200 bg-sky-50 text-sky-700",
                              )}
                            >
                              {program.varietyCode}
                            </Badge>
                            <span className={cn("text-xs", isActive ? "text-white/80" : "text-muted-foreground")}>
                              {program.varietyLabel}
                            </span>
                          </div>
                          <div>
                            <p className="truncate text-sm font-semibold tracking-tight">{program.title}</p>
                            <p className={cn("mt-1 text-xs", isActive ? "text-white/78" : "text-muted-foreground")}>
                              {PROGRAM_KIND_META[program.kind].label} · Semanas fenologicas {formatPhenologicalRange(program)}
                            </p>
                          </div>
                          <div className={cn("flex flex-wrap gap-2 text-[11px]", isActive ? "text-white/72" : "text-muted-foreground")}>
                            <span>ISO {formatWeekRange(program)}</span>
                            <span>{program.cadenceLabel}</span>
                            <span>{countConfiguredSlots(program)} celdas</span>
                          </div>
                        </div>
                        <ChevronRight className={cn("mt-1 size-4 shrink-0", isActive ? "text-white" : "text-muted-foreground")} />
                      </div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {selectedProgram ? (
            <div className="space-y-4">
              <Card className="overflow-hidden border-border/70 bg-[radial-gradient(circle_at_top_right,rgba(125,211,252,0.20),transparent_32%),linear-gradient(180deg,rgba(248,250,252,0.98),rgba(255,255,255,0.98))]">
                <CardHeader className="border-b border-border/60">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className="rounded-full bg-sky-700 text-white hover:bg-sky-700">{selectedProgram.varietyCode}</Badge>
                        <Badge variant="outline" className="rounded-full bg-white/80">{PROGRAM_KIND_META[selectedProgram.kind].label}</Badge>
                        <Badge variant="outline" className="rounded-full bg-white/80">{selectedProgram.statusLabel}</Badge>
                      </div>
                      <div>
                        <CardTitle className="text-xl">{selectedProgram.title}</CardTitle>
                        <CardDescription className="mt-1 max-w-3xl">
                          Esta ventana baja al mismo editor Excel-like, pero ahora diferenciada por tipo real de fumigacion: regular, dron o lanzas eficientes.
                        </CardDescription>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button type="button" variant="outline" size="sm" className="rounded-full bg-white/80" onClick={duplicateLastWeek}>
                        <CopyPlus className="size-4" />
                        Duplicar ultima semana
                      </Button>
                      <Button type="button" variant="outline" size="sm" className="rounded-full bg-white/80" onClick={addWeek}>
                        <Plus className="size-4" />
                        Agregar semana
                      </Button>
                    </div>
                  </div>

                  <div className="grid gap-3 pt-2 md:grid-cols-5">
                    <div className="rounded-[18px] border border-white/70 bg-white/78 px-4 py-3">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Tipo</p>
                      <p className="mt-2 text-sm font-semibold">{PROGRAM_KIND_META[selectedProgram.kind].label}</p>
                    </div>
                    <div className="rounded-[18px] border border-white/70 bg-white/78 px-4 py-3">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Rango fenologico</p>
                      <p className="mt-2 text-lg font-semibold">{formatPhenologicalRange(selectedProgram)}</p>
                    </div>
                    <div className="rounded-[18px] border border-white/70 bg-white/78 px-4 py-3">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Rango ISO</p>
                      <p className="mt-2 text-lg font-semibold">{formatWeekRange(selectedProgram)}</p>
                    </div>
                    <div className="rounded-[18px] border border-white/70 bg-white/78 px-4 py-3">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Cadencia</p>
                      <p className="mt-2 text-sm font-medium">{selectedProgram.cadenceLabel}</p>
                    </div>
                    <div className="rounded-[18px] border border-white/70 bg-white/78 px-4 py-3">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Pares visibles</p>
                      <p className="mt-2 text-lg font-semibold">{totalVisiblePairs}</p>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-dashed border-sky-200 bg-white/88 px-4 py-3 text-sm">
                    <div className="flex items-center gap-2 text-sky-900">
                      <Sparkles className="size-4" />
                      <span className="font-medium">Idea visual</span>
                      <span className="text-muted-foreground">editor semanal solo para semanas futuras, con pares que se agregan por registro y respaldo historico pensado para base de datos.</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <GripHorizontal className="size-4" />
                      pensado para expandirse como Excel
                    </div>
                  </div>

                  <div className="rounded-[18px] border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-900">
                    La programacion visible trabaja solo desde la semana ISO actual {CURRENT_OPERATIONAL_WEEK_ISO} hacia adelante. La historia previa queda pensada para respaldo en base de datos, no para seguir cargandose en esta grilla operativa.
                  </div>

                  <div className="grid gap-3 md:grid-cols-[0.9fr_0.9fr_1.2fr]">
                    <div className="space-y-2 rounded-[18px] border border-border/70 bg-background/85 p-4">
                      <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Filtrar desde semana ISO</Label>
                      <Input
                        value={weekFilterFrom}
                        onChange={(event) => setWeekFilterFrom(event.target.value)}
                        placeholder="Ej. 2412"
                        className="bg-white"
                      />
                    </div>
                    <div className="space-y-2 rounded-[18px] border border-border/70 bg-background/85 p-4">
                      <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Regla de captura</Label>
                      <p className="text-sm text-muted-foreground">
                        Cada semana se divide en 3 aplicaciones. Los pares se agregan dentro de cada aplicación y cada par exige producto y cantidad.
                      </p>
                    </div>
                    <div className="space-y-2 rounded-[18px] border border-border/70 bg-background/85 p-4">
                      <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Bloque activo</Label>
                      <p className="text-sm text-muted-foreground">
                        {selectedProgram.varietyCode} en semanas fenologicas {formatPhenologicalRange(selectedProgram)} y ventana {PROGRAM_KIND_META[selectedProgram.kind].label}.
                      </p>
                    </div>
                  </div>

                  <ScrollFadeTable className="rounded-[22px] border border-border/70 bg-white/92" innerClassName="max-h-[62vh] overflow-auto" topScrollbar>
                    <StandardTable className="min-w-[1180px]">
                      <thead className="sticky top-0 z-20">
                        <tr className="border-b border-border/60">
                          <StandardTh className="w-[140px] min-w-[140px] border-r border-border/60 bg-slate-950 text-white xl:sticky xl:left-0 xl:z-30 xl:w-[170px] xl:min-w-[170px]">Semana ISO</StandardTh>
                          <StandardTh className="w-[220px] min-w-[220px] border-r border-border/60 bg-slate-950 text-white xl:sticky xl:left-[170px] xl:z-30 xl:w-[260px] xl:min-w-[260px]">Variedad</StandardTh>
                          {Array.from({ length: applicationCount }).map((_, applicationIndex) => (
                            <StandardTh key={`application-header-${applicationIndex}`} className="min-w-[250px] border-r border-border/60 bg-slate-100 text-slate-700">
                              Aplicacion {applicationIndex + 1}
                            </StandardTh>
                          ))}
                        </tr>
                      </thead>

                      <tbody>
                        {visibleWeeks.map((week, rowIndex) => {
                          const totalWeekPairs = week.applications.reduce((total, application) => total + application.slots.length, 0);
                          return (
                            <tr
                              key={week.weekIso}
                              className={cn(
                                "border-b border-border/50 align-top",
                                rowIndex % 2 === 0 ? "bg-white" : "bg-slate-50/60",
                                !isWeekComplete(week) && "bg-amber-50/60",
                              )}
                            >
                              <StandardTd className="w-[140px] min-w-[140px] border-r border-border/60 bg-inherit px-3 py-3 xl:sticky xl:left-0 xl:z-20 xl:w-[170px] xl:min-w-[170px]">
                                <div className="space-y-2">
                                  <div className="rounded-[14px] bg-slate-950 px-3 py-2 text-center text-sm font-semibold text-white">
                                    {week.weekIso}
                                  </div>
                                  <Badge
                                    className={cn(
                                      "w-full justify-center rounded-full border-0 text-white",
                                      isWeekComplete(week) ? "bg-emerald-600 hover:bg-emerald-600" : "bg-rose-600 hover:bg-rose-600",
                                    )}
                                  >
                                    {isWeekComplete(week) ? "Completa" : "Incompleta"}
                                  </Badge>
                                  <p className="text-center text-[11px] text-muted-foreground">{totalWeekPairs} pares en 3 aplicaciones</p>
                                </div>
                              </StandardTd>
                              <StandardTd className="w-[220px] min-w-[220px] border-r border-border/60 bg-inherit px-4 py-3 xl:sticky xl:left-[170px] xl:z-20 xl:w-[260px] xl:min-w-[260px]">
                                <div className="space-y-2">
                                  <div className="flex items-start justify-between gap-3">
                                    <p className="text-sm font-semibold">{selectedProgram.varietyCode}</p>
                                    <Button
                                      type="button"
                                      variant="destructive"
                                      size="sm"
                                      className={cn(
                                        "rounded-full transition-opacity",
                                        week.weekIso !== lastWeekIsoInProgram && "pointer-events-none opacity-0",
                                      )}
                                      disabled={week.weekIso !== lastWeekIsoInProgram}
                                      onClick={() => requestRemoveWeek(week.weekIso)}
                                    >
                                      <Trash2 className="size-4" />
                                      Eliminar semana
                                    </Button>
                                  </div>
                                  <div className="space-y-1">
                                    <p className="text-sm font-medium">{selectedProgram.title}</p>
                                    <p className="text-xs leading-4 text-muted-foreground">
                                      {PROGRAM_KIND_META[selectedProgram.kind].label} · Fenologica {formatPhenologicalRange(selectedProgram)}
                                    </p>
                                    <p className="text-xs leading-4 text-muted-foreground">
                                      Semana operativa {week.weekIso}
                                    </p>
                                  </div>
                                </div>
                              </StandardTd>

                              {Array.from({ length: applicationCount }).map((_, applicationIndex) => {
                                const application = week.applications[applicationIndex] ?? { applicationNumber: applicationIndex + 1, slots: [] };
                                const summarizedSlots = summarizeApplication(application, fumigationBodegaProducts);
                                return (
                                  <StandardTd key={`${week.weekIso}-application-${applicationIndex}`} className="border-r border-border/40 px-3 py-3">
                                    <div className="min-w-[250px] space-y-3 rounded-[18px] border border-slate-200 bg-slate-50/70 p-3">
                                      <div className="flex items-center justify-between gap-2">
                                        <div>
                                          <p className="text-sm font-semibold text-slate-900">Aplicacion {applicationIndex + 1}</p>
                                          <p className="text-[11px] text-muted-foreground">
                                            {application.slots.length} {application.slots.length === 1 ? "par" : "pares"}
                                          </p>
                                        </div>
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="sm"
                                          className="rounded-full bg-white"
                                          onClick={() => setEditingApplication({ weekIso: week.weekIso, applicationIndex })}
                                        >
                                          Editar
                                        </Button>
                                      </div>
                                      <div className="space-y-2">
                                        {summarizedSlots.length ? summarizedSlots.map((slot, slotIndex) => (
                                          <div key={`${week.weekIso}-${applicationIndex}-summary-${slotIndex}`} className="rounded-[14px] border border-white bg-white px-3 py-2">
                                            <div className="flex items-start justify-between gap-3">
                                              <div className="min-w-0">
                                                <p className="truncate text-sm font-medium text-slate-900">{slot.productName}</p>
                                                <p className="truncate text-[11px] text-muted-foreground">
                                                  {slot.linkedProduct
                                                    ? `${slot.linkedProduct.productCode} · ${slot.linkedProduct.baseUnitName}`
                                                    : "Sin vinculo confirmado"}
                                                </p>
                                              </div>
                                              <p className="shrink-0 text-sm font-semibold text-slate-900">
                                                {slot.quantity}
                                              </p>
                                            </div>
                                          </div>
                                        )) : (
                                          <div className="rounded-[14px] border border-dashed border-slate-300 bg-white/70 px-3 py-4 text-center text-xs text-muted-foreground">
                                            Sin pares configurados
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </StandardTd>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </StandardTable>
                  </ScrollFadeTable>
                </CardContent>
              </Card>
              {pendingDeleteWeekIso != null ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4">
                  <div className="w-full max-w-md rounded-[24px] border border-border/70 bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.22)]">
                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-slate-950">Eliminar semana {pendingDeleteWeekIso}</p>
                      <p className="text-sm leading-6 text-muted-foreground">
                        Esta accion quita la ultima semana visible de la cadena. Las semanas anteriores se conservan como historial y la semana eliminada dejara de verse en esta programacion.
                      </p>
                    </div>
                    <div className="mt-6 flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => setPendingDeleteWeekIso(null)}>
                        Cancelar
                      </Button>
                      <Button type="button" variant="destructive" onClick={confirmRemoveWeek}>
                        Confirmar eliminacion
                      </Button>
                    </div>
                  </div>
                </div>
              ) : null}
              {editingApplication && editingWeek && editingApplicationData ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-6">
                  <div className="w-full max-w-4xl rounded-[24px] border border-border/70 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.22)]">
                    <div className="flex items-start justify-between gap-4 border-b border-border/60 px-6 py-5">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-slate-950">
                          Editar aplicacion {editingApplication.applicationIndex + 1}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Semana {editingApplication.weekIso} · {selectedProgram.varietyCode} · {selectedProgram.title}
                        </p>
                      </div>
                      <Button type="button" variant="outline" onClick={() => setEditingApplication(null)}>
                        Cerrar
                      </Button>
                    </div>
                    <div className="space-y-4 px-6 py-5">
                      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-sky-100 bg-sky-50/70 px-4 py-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {editingApplicationData.slots.length} {editingApplicationData.slots.length === 1 ? "par" : "pares"} en esta aplicacion
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Aqui puedes corregir productos, cantidades, agregar pares o quitar el ultimo par.
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="rounded-full bg-white"
                            onClick={() => addSlotPairToWeek(editingApplication.weekIso, editingApplication.applicationIndex)}
                          >
                            <Plus className="size-4" />
                            Agregar par
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="rounded-full bg-white"
                            disabled={editingApplicationData.slots.length <= 1}
                            onClick={() => removeLastPairFromWeek(editingApplication.weekIso, editingApplication.applicationIndex)}
                          >
                            <Trash2 className="size-4" />
                            Quitar ultimo par
                          </Button>
                        </div>
                      </div>

                      <div className="grid gap-3">
                        {editingApplicationData.slots.map((slot, slotIndex) => {
                          const linkedProduct = findCanonicalFumigationProduct(slot.productName, fumigationBodegaProducts);
                          const productDatalistId = `fumigation-modal-suggestions-${editingApplication.weekIso}-${editingApplication.applicationIndex}-${slotIndex}`;
                          return (
                            <div key={`modal-slot-${editingApplication.weekIso}-${editingApplication.applicationIndex}-${slotIndex}`} className="rounded-[18px] border border-border/60 bg-slate-50/60 p-4">
                              <div className="mb-3 flex items-center justify-between gap-2">
                                <p className="text-sm font-semibold text-slate-900">Par {slotIndex + 1}</p>
                                <Badge variant="outline" className="rounded-full bg-white">
                                  {linkedProduct ? linkedProduct.baseUnitCode : "Sin unidad"}
                                </Badge>
                              </div>
                              <div className="grid gap-3 md:grid-cols-[1.45fr_0.75fr]">
                                <div className="space-y-1">
                                  <Input
                                    value={slot.productName}
                                    onChange={(event) => handleSlotChange(editingApplication.weekIso, editingApplication.applicationIndex, slotIndex, "productName", event.target.value)}
                                    onBlur={() => handleProductBlur(editingApplication.weekIso, editingApplication.applicationIndex, slotIndex)}
                                    placeholder="Nombre sistema Bodega"
                                    list={productDatalistId}
                                    className={cn("bg-white", !slot.productName.trim() && "border-amber-300")}
                                  />
                                  <datalist id={productDatalistId}>
                                    {productSuggestions.map((option) => (
                                      <option key={`${editingApplication.applicationIndex}-${slotIndex}-modal-${option}`} value={option} />
                                    ))}
                                  </datalist>
                                  <p className={cn("truncate text-[11px]", linkedProduct ? "text-emerald-700" : "text-muted-foreground")}>
                                    {linkedProduct
                                      ? `${linkedProduct.productCode} · ${linkedProduct.baseUnitCode} · ${linkedProduct.categoryLeafName}`
                                      : "Aun sin vinculo real con Bodega/Fumigacion"}
                                  </p>
                                </div>
                                <div className="space-y-1">
                                  <Input
                                    value={slot.quantity}
                                    onChange={(event) => handleSlotChange(editingApplication.weekIso, editingApplication.applicationIndex, slotIndex, "quantity", event.target.value)}
                                    onBlur={() => handleQuantityBlur(editingApplication.weekIso, editingApplication.applicationIndex, slotIndex)}
                                    placeholder="0.00"
                                    type="text"
                                    inputMode="decimal"
                                    pattern="[0-9]*[.,]?[0-9]*"
                                    className={cn("bg-white text-right tabular-nums", !slot.quantity.trim() && "border-amber-300")}
                                  />
                                  <p className="truncate text-right text-[11px] text-muted-foreground">
                                    {linkedProduct ? `${linkedProduct.baseUnitCode} · ${linkedProduct.baseUnitName}` : "Unidad pendiente"}
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <Card>
              <CardContent className="px-6 py-12 text-center text-sm text-muted-foreground">
                No hay programas visibles con el filtro actual.
              </CardContent>
            </Card>
          )}
        </div>
      </FilterPanel>
    </SectionPageShell>
  );
}
