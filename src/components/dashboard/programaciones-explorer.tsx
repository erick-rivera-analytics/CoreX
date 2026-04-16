"use client";

import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Droplets, Leaf, Lightbulb, LoaderCircle, SprayCan } from "lucide-react";
import useSWR from "swr";

import { SectionPageShell } from "@/shared/layout/section-page-shell";
import { FilterPanel } from "@/shared/layout/filter-panel";
import { MultiSelectField } from "@/shared/filters/multi-select-field";
import { formatInteger, formatDate } from "@/shared/lib/format";
import { EmptyState } from "@/shared/data-display/empty-state";
import { AREA_PALETTE, SPTYPE_ACCENT_COLORS, VARIETY_COLORS } from "@/config/programaciones-palettes";
import { fetchJson } from "@/lib/fetch-json";
import { decodeMultiSelectValue } from "@/lib/multi-select";
import { cn } from "@/lib/utils";
import type { ProgramacionRecord } from "@/lib/programaciones";

// ── Types ─────────────────────────────────────────────────────────────────────

type ProgramacionTab = "plantas_muertas" | "iluminacion" | "fumigacion" | "aplicacion_ga3" | "riego";
type FumigacionFilter = "todos" | "dron" | "regular";

const TABS: {
  key: ProgramacionTab;
  label: string;
  icon: React.ElementType;
  activityCode: string | null;
}[] = [
  { key: "plantas_muertas", label: "Plantas Muertas", icon: Leaf,       activityCode: "SPMC" },
  { key: "iluminacion",     label: "Iluminación",     icon: Lightbulb,  activityCode: "ILUMINACION" },
  { key: "fumigacion",      label: "Fumigación",      icon: SprayCan,   activityCode: null },
  { key: "aplicacion_ga3",  label: "Aplicación GA3",  icon: SprayCan,   activityCode: "FM13" },
  { key: "riego",           label: "Riego",           icon: Droplets,   activityCode: null },
];

const DAY_LABELS  = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MONTH_NAMES = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
];
const FASE_OPTIONS = ["Planificado", "Vegetativo", "Cosecha", "Historia"] as const;
type FaseOption = (typeof FASE_OPTIONS)[number] | "";

function strHash(s: string, len: number): number {
  if (!s || len <= 0) return 0;
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % len;
  return Math.abs(h);
}

function getAreaStyle(areaId: string | null): { bg: string; border: string } {
  return AREA_PALETTE[strHash(areaId ?? "?", AREA_PALETTE.length)];
}

function getVarietyColor(variety: string | null): string {
  return VARIETY_COLORS[strHash(variety ?? "?", VARIETY_COLORS.length)];
}

function getSpTypeAccent(spType: string | null): string {
  return SPTYPE_ACCENT_COLORS[strHash(spType ?? "?", SPTYPE_ACCENT_COLORS.length)];
}

function getVarietyAbbr(variety: string | null): string {
  if (!variety) return "?";
  const parts = variety.trim().split(/[\s_\-]+/);
  return parts.length >= 2
    ? (parts[0]![0]! + parts[1]![0]!).toUpperCase()
    : variety.slice(0, 2).toUpperCase();
}

function toDateStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function monthRange(year: number, month: number): { dateFrom: string; dateTo: string } {
  const dateFrom = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const lastDay  = new Date(year, month + 1, 0).getDate();
  const dateTo   = `${year}-${String(month + 1).padStart(2, "0")}-${lastDay}`;
  return { dateFrom, dateTo };
}

function buildCalendarCells(year: number, month: number) {
  const firstWeekday  = new Date(year, month, 1).getDay();
  const daysInMonth   = new Date(year, month + 1, 0).getDate();
  const daysInPrev    = new Date(year, month, 0).getDate();
  const cells: { date: Date; isCurrentMonth: boolean }[] = [];

  // Start with Monday (convert Sunday 0 to 6, shift others by -1)
  const mondayOffset = firstWeekday === 0 ? 6 : firstWeekday - 1;

  for (let i = mondayOffset - 1; i >= 0; i--)
    cells.push({ date: new Date(year, month - 1, daysInPrev - i), isCurrentMonth: false });
  for (let d = 1; d <= daysInMonth; d++)
    cells.push({ date: new Date(year, month, d), isCurrentMonth: true });
  const remaining = 42 - cells.length;
  for (let d = 1; d <= remaining; d++)
    cells.push({ date: new Date(year, month + 1, d), isCurrentMonth: false });

  return cells;
}

const progFetcher = (url: string) =>
  fetchJson<ProgramacionRecord[]>(url, "No se pudo cargar las programaciones.");

// ── Event pill ────────────────────────────────────────────────────────────────

function EventPill({ record, onClick, highlighted }: { record: ProgramacionRecord; onClick?: (e: React.MouseEvent) => void; highlighted?: boolean }) {
  const areaStyle    = getAreaStyle(record.areaId);
  const varietyColor = getVarietyColor(record.variety);
  const spAccent     = getSpTypeAccent(record.spType);
  const abbr         = getVarietyAbbr(record.variety);
  const isDron       = record.activityCode === "03VAFIFMG";

  return (
    <div
      style={{
        background:   areaStyle.bg,
        borderTop:    highlighted ? `1.5px solid ${spAccent}` : `1px solid ${areaStyle.border}`,
        borderRight:  highlighted ? `1.5px solid ${spAccent}` : `1px solid ${areaStyle.border}`,
        borderBottom: highlighted ? `1.5px solid ${spAccent}` : `1px solid ${areaStyle.border}`,
        borderLeft:   `3px solid ${spAccent}`,
        borderRadius: "6px",
        padding:      "2px 5px 2px 5px",
        cursor:       onClick ? "pointer" : "default",
        opacity:      onClick && !highlighted ? 0.72 : 1,
      }}
      className="flex items-center gap-1"
      title={`${record.blockId} · ${record.variety ?? "—"} · SP: ${record.spType ?? "—"} · Área: ${record.areaId ?? "—"}`}
      onClick={onClick}
    >
      {/* Fumigación Dron badge */}
      {isDron && (
        <span style={{ color: "#0ea5e9", fontSize: "9px", fontWeight: 700, flexShrink: 0, textTransform: "uppercase", letterSpacing: "0.04em" }}>
          D
        </span>
      )}
      {/* ilumLabel badge (Inicio / Fin) */}
      {record.ilumLabel && (
        <span style={{ color: spAccent, fontSize: "9px", fontWeight: 700, flexShrink: 0, textTransform: "uppercase", letterSpacing: "0.04em" }}>
          {record.ilumLabel}
        </span>
      )}
      {/* block_id */}
      <span className="min-w-0 flex-1 truncate text-[11px] font-medium leading-tight text-foreground">
        {record.blockId}
      </span>
      {/* variety badge */}
      <span
        style={{
          background:    varietyColor,
          borderRadius:  "4px",
          padding:       "0 4px",
          fontSize:      "9px",
          fontWeight:    700,
          color:         "#fff",
          letterSpacing: "0.02em",
          lineHeight:    "16px",
          flexShrink:    0,
        }}
      >
        {abbr}
      </span>
    </div>
  );
}

// ── Main explorer ─────────────────────────────────────────────────────────────

type ProgramacionesExplorerProps = {
  initialData?: ProgramacionRecord[];
  initialDateFrom?: string;
  initialDateTo?: string;
};

export function ProgramacionesExplorer({
  initialData = [],
  initialDateFrom,
  initialDateTo,
}: ProgramacionesExplorerProps) {
  const today    = new Date();
  const todayStr = toDateStr(today);

  const [activeTab,           setActiveTab]           = useState<ProgramacionTab>("plantas_muertas");
  const [viewDate,            setViewDate]            = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected,            setSelected]            = useState<string | null>(null);
  const [selectedIlumCycleKey, setSelectedIlumCycleKey] = useState<string | null>(null);
  const [areaFilter,          setAreaFilter]          = useState("all");
  const [faseFilter,          setFaseFilter]          = useState<FaseOption>("");
  const [fumigacionFilter,    setFumigacionFilter]    = useState<FumigacionFilter>("todos");

  const { dateFrom, dateTo } = useMemo(
    () => monthRange(viewDate.getFullYear(), viewDate.getMonth()),
    [viewDate],
  );

  const isCurrentInitialRange =
    dateFrom === initialDateFrom && dateTo === initialDateTo;

  // SWR — skips initial fetch if server already gave us the right month
  const { data: swrData, isLoading } = useSWR<ProgramacionRecord[]>(
    `/api/programaciones?dateFrom=${dateFrom}&dateTo=${dateTo}`,
    progFetcher,
    {
      fallbackData: isCurrentInitialRange ? initialData : undefined,
      keepPreviousData: true,
      dedupingInterval: 60_000,
    },
  );

  const allRecords = useMemo(() => swrData ?? [], [swrData]);

  // Derived option lists (unique areas from loaded data)
  const areaOptions = useMemo(
    () => Array.from(new Set(allRecords.map((r) => r.areaId).filter(Boolean) as string[])).sort(),
    [allRecords],
  );

  const selectedAreas = useMemo(() => decodeMultiSelectValue(areaFilter), [areaFilter]);

  // Active tab → activity code filter
  const activeCode = TABS.find((t) => t.key === activeTab)?.activityCode ?? null;

  // Filtered records — Riego sin activityCode → vacío
  const filtered = useMemo(() => {
    if (activeTab === "riego" || (!activeCode && activeTab !== "fumigacion")) return [];
    return allRecords.filter((r) => {
      // Fumigación: match both dron (03VAFIFMG) and regular (FMGYP)
      if (activeTab === "fumigacion") {
        if (r.activityCode !== "03VAFIFMG" && r.activityCode !== "FMGYP") return false;
        // Apply dron filter
        if (fumigacionFilter === "dron" && r.activityCode !== "03VAFIFMG") return false;
        if (fumigacionFilter === "regular" && r.activityCode !== "FMGYP") return false;
      } else {
        if (r.activityCode !== activeCode) return false;
      }
      if (selectedAreas.length && !selectedAreas.includes(r.areaId ?? "")) return false;
      if (faseFilter && r.fase !== faseFilter) return false;
      return true;
    });
  }, [allRecords, activeCode, activeTab, selectedAreas, faseFilter, fumigacionFilter]);

  // Index by date
  const byDate = useMemo(() => {
    const map = new Map<string, ProgramacionRecord[]>();
    for (const rec of filtered) {
      const list = map.get(rec.eventDate) ?? [];
      list.push(rec);
      map.set(rec.eventDate, list);
    }
    return map;
  }, [filtered]);

  const cells = useMemo(
    () => buildCalendarCells(viewDate.getFullYear(), viewDate.getMonth()),
    [viewDate],
  );

  // Iluminación: ciclo seleccionado y sus dos extremos (INICIO / FIN)
  const ilumCycleRecords = useMemo(
    () => selectedIlumCycleKey
      ? filtered.filter((r) => r.cycleKey === selectedIlumCycleKey)
      : [],
    [filtered, selectedIlumCycleKey],
  );
  // Fetch correct min/max from API (includes all months, not just current month)
  const { data: cycleRangeData } = useSWR<{ min: string | null; max: string | null }>(
    selectedIlumCycleKey ? `/api/programaciones/cycle-range/${encodeURIComponent(selectedIlumCycleKey)}` : null,
    (url) => fetch(url).then((r) => r.json()),
    { revalidateOnFocus: false, dedupingInterval: 60000 }
  );

  const ilumCycleDateRange = cycleRangeData?.min && cycleRangeData?.max
    ? { min: cycleRangeData.min, max: cycleRangeData.max }
    : null;

  const ilumDays = ilumCycleDateRange?.min && ilumCycleDateRange?.max
    ? Math.round(
        (new Date(ilumCycleDateRange.max).getTime() - new Date(ilumCycleDateRange.min).getTime())
        / 86_400_000,
      )
    : null;

  function prevMonth() { setViewDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1)); setSelected(null); setSelectedIlumCycleKey(null); }
  function nextMonth() { setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1)); setSelected(null); setSelectedIlumCycleKey(null); }

  const selectedEvents = selected ? (byDate.get(selected) ?? []) : [];

  return (
    <div className="space-y-4">
      <SectionPageShell
        eyebrow="Gestión"
        title="Programaciones"
        subtitle="Calendario mensual de actividades programadas por bloque, area y fase de cultivo."
        icon={<CalendarDays className="size-6" aria-hidden="true" />}
      >
        <FilterPanel>
          {/* ── Activity tabs ───────────────────────────────────────────────── */}
          <div className="flex flex-wrap gap-2">
            {TABS.map((tab) => {
              const Icon   = tab.icon;
              const active = activeTab === tab.key;
              let hasData = false;
              if (tab.key === "fumigacion") {
                hasData = allRecords.some((r) => r.activityCode === "03VAFIFMG" || r.activityCode === "FMGYP");
              } else if (tab.key === "aplicacion_ga3") {
                hasData = true; // FM13 is in the database, never show PRONTO
              } else if (tab.activityCode) {
                hasData = allRecords.some((r) => r.activityCode === tab.activityCode);
              }
              // Reset fumigacion filter when switching tabs
              if (active && activeTab !== "fumigacion" && fumigacionFilter !== "todos") {
                setFumigacionFilter("todos");
              }
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => { setActiveTab(tab.key); setSelected(null); }}
                  className={cn(
                    "flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-all",
                    active
                      ? "border-white bg-white text-slate-900 shadow-sm dark:border-white dark:bg-white dark:text-slate-900"
                      : "border-border/60 bg-card text-muted-foreground hover:border-border hover:text-foreground",
                  )}
                >
                  <Icon className="size-4 shrink-0" aria-hidden />
                  {tab.label}
                  {!hasData && tab.activityCode && (
                    <span className="rounded-full bg-border/50 px-1.5 text-[9px] font-semibold uppercase tracking-wide">
                      pronto
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* ── Filters ─────────────────────────────────────────────────────── */}
          <div className="flex flex-wrap items-end gap-4">
            <div className="w-56">
              <MultiSelectField
                id="prog-area"
                label="Área"
                value={areaFilter}
                options={areaOptions}
                onChange={setAreaFilter}
              />
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium leading-none">Fase</p>
              <div className="flex items-center gap-1 rounded-xl border border-border/60 bg-card p-1">
                <button
                  type="button"
                  onClick={() => setFaseFilter("")}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                    faseFilter === "" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  Todas
                </button>
                {FASE_OPTIONS.map((fase) => (
                  <button
                    key={fase}
                    type="button"
                    onClick={() => setFaseFilter(fase)}
                    className={cn(
                      "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                      faseFilter === fase
                        ? "bg-foreground text-background"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {fase}
                  </button>
                ))}
              </div>
            </div>

            {activeTab === "fumigacion" && (
              <div className="space-y-2">
                <p className="text-sm font-medium leading-none">Tipo</p>
                <div className="flex items-center gap-1 rounded-xl border border-border/60 bg-card p-1">
                  <button
                    type="button"
                    onClick={() => setFumigacionFilter("todos")}
                    className={cn(
                      "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                      fumigacionFilter === "todos" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    Todos
                  </button>
                  <button
                    type="button"
                    onClick={() => setFumigacionFilter("dron")}
                    className={cn(
                      "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                      fumigacionFilter === "dron" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    Dron
                  </button>
                  <button
                    type="button"
                    onClick={() => setFumigacionFilter("regular")}
                    className={cn(
                      "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                      fumigacionFilter === "regular" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    Regular
                  </button>
                </div>
              </div>
            )}

            {isLoading && (
              <LoaderCircle className="size-4 animate-spin text-muted-foreground" />
            )}
          </div>
        </FilterPanel>
      </SectionPageShell>

      {/* ── Visual legend ────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-5 rounded-xl border border-border/50 bg-muted/20 px-4 py-2.5 text-[11px] text-muted-foreground">
        <span className="font-semibold uppercase tracking-wide">Leyenda</span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-1 rounded-full" style={{ background: SPTYPE_ACCENT_COLORS[0] }} />
          Borde izq. = Tipo SP
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-3 rounded" style={{ background: AREA_PALETTE[0]!.bg, border: `1px solid ${AREA_PALETTE[0]!.border}` }} />
          Fondo = Área
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block rounded px-1 text-[9px] font-bold text-white" style={{ background: VARIETY_COLORS[0] }}>Va</span>
          Badge = Variedad
        </span>
      </div>

      {/* ── Main grid ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_300px]">

        {/* Calendar card */}
        {cells.length === 0 ? <EmptyState label="No hay programaciones para mostrar." /> :
        <div className="rounded-2xl border border-border/60 bg-card shadow-sm">

          {/* Month nav */}
          <div className="flex items-center justify-between border-b border-border/50 px-6 py-4">
            <button type="button" onClick={prevMonth} aria-label="Mes anterior"
              className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              <ChevronLeft className="size-4" aria-hidden />
            </button>
            <h2 className="text-sm font-semibold">
              {MONTH_NAMES[viewDate.getMonth()]} {viewDate.getFullYear()}
            </h2>
            <button type="button" onClick={nextMonth} aria-label="Mes siguiente"
              className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              <ChevronRight className="size-4" aria-hidden />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-border/50">
            {DAY_LABELS.map((d) => (
              <div key={d} className="py-3 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70">
                {d}
              </div>
            ))}
          </div>

          {/* Grid */}
          <div className="grid grid-cols-7">
            {cells.map((cell, i) => {
              const dateStr     = toDateStr(cell.date);
              const events      = byDate.get(dateStr) ?? [];
              const isToday     = dateStr === todayStr;
              const isSel       = dateStr === selected;
              const isIlumHL    = activeTab === "iluminacion" && ilumCycleDateRange != null
                                    && dateStr >= ilumCycleDateRange.min && dateStr <= ilumCycleDateRange.max;
              const isIlumStart = activeTab === "iluminacion" && ilumCycleDateRange?.min === dateStr;
              const isIlumEnd   = activeTab === "iluminacion" && ilumCycleDateRange?.max === dateStr;
              const isLastRow   = i >= 35;
              const isLastCol   = (i + 1) % 7 === 0;

              return (
                <button
                  key={dateStr}
                  type="button"
                  onClick={() => setSelected(isSel ? null : dateStr)}
                  className={cn(
                    "group relative min-h-[88px] border-b border-r border-border/40 p-2 text-left transition-colors",
                    isLastRow && "border-b-0",
                    isLastCol && "border-r-0",
                    !cell.isCurrentMonth && "bg-muted/20",
                    isSel && "ring-1 ring-inset ring-border bg-muted/40",
                    isIlumHL && !isSel && "bg-slate-50/30 dark:bg-slate-900/10",
                    cell.isCurrentMonth && !isSel && !isIlumHL && "hover:bg-muted/25",
                  )}
                >
                  {/* Gantt-style range bar - continuous visual */}
                  {isIlumHL && (
                    <>
                      {/* Thick continuous bar */}
                      <span
                        aria-hidden
                        className={cn(
                          "pointer-events-none absolute bottom-0.5 h-3 bg-gradient-to-r from-amber-500 to-orange-500 shadow-sm",
                          isIlumStart ? "left-1/2 rounded-l-lg" : "left-0",
                          isIlumEnd   ? "right-1/2 rounded-r-lg" : "right-0",
                          isIlumStart && isIlumEnd && "left-[20%] right-[20%] rounded-lg",
                        )}
                      />
                      {/* Subtle background tint */}
                      <span
                        aria-hidden
                        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-amber-100/30 to-orange-100/20 dark:from-amber-900/15 dark:to-orange-900/10"
                      />
                    </>
                  )}
                  {/* Day number */}
                  <span className={cn(
                    "flex size-7 items-center justify-center rounded-full text-sm font-medium leading-none",
                    isToday     && "bg-foreground text-background",
                    isIlumStart && !isToday && "bg-slate-400 text-white",
                    isIlumEnd   && !isToday && !isIlumStart && "bg-slate-400 text-white",
                    !isToday && cell.isCurrentMonth  && "text-foreground",
                    !isToday && !cell.isCurrentMonth && "text-muted-foreground/40",
                  )}>
                    {cell.date.getDate()}
                  </span>

                  {/* Event pills */}
                  <div className="mt-1 space-y-[3px]">
                    {events.slice(0, 4).map((ev, ei) => (
                      <EventPill
                        key={`${ev.cycleKey}-${ei}`}
                        record={ev}
                        highlighted={activeTab === "iluminacion" && selectedIlumCycleKey === ev.cycleKey}
                        onClick={activeTab === "iluminacion" ? (e) => {
                          e.stopPropagation();
                          const newKey = ev.cycleKey === selectedIlumCycleKey ? null : ev.cycleKey;
                          if (newKey) {
                            // Find start/end dates for this cycle
                            const cycleRecs = filtered.filter((r) => r.cycleKey === newKey);
                            const startRec = cycleRecs.find((r) => r.ilumLabel === "Inicio");
                            const endRec = cycleRecs.find((r) => r.ilumLabel === "Fin");
                            const firstDate = startRec || endRec;
                            // Auto-navigate to the month of the first available date
                            if (firstDate) {
                              const eventDate = new Date(firstDate.eventDate);
                              setViewDate(new Date(eventDate.getFullYear(), eventDate.getMonth(), 1));
                            }
                          }
                          setSelectedIlumCycleKey(newKey);
                        } : undefined}
                      />
                    ))}
                    {events.length > 4 && (
                      <p className="px-1 text-[10px] text-muted-foreground">
                        +{events.length - 4} más
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
        }

        {/* Side panel */}
        <div className="space-y-4">

          {/* Iluminación cycle detail */}
          {activeTab === "iluminacion" && (
            <div className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden">
              <div className="border-b border-border/50 bg-slate-50/40 dark:bg-slate-900/10 px-5 py-4 flex items-center gap-2">
                <Lightbulb className="size-4 shrink-0 text-slate-500" aria-hidden />
                <h3 className="text-sm font-semibold">
                  {selectedIlumCycleKey ? "Ciclo de iluminación" : "Iluminación"}
                </h3>
              </div>
              <div className="px-5 py-4">
                {!selectedIlumCycleKey ? (
                  <p className="py-3 text-center text-sm text-muted-foreground/60">
                    Haz clic en una etiqueta de iluminación para ver el detalle del ciclo.
                  </p>
                ) : (() => {
                  const rec = ilumCycleRecords[0] ?? null;
                  const spAccent     = rec ? getSpTypeAccent(rec.spType) : undefined;
                  const varietyColor = rec ? getVarietyColor(rec.variety) : undefined;
                  return (
                    <div className="space-y-3">
                      {rec ? (
                        <>
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-base font-semibold">{rec.blockId}</p>
                            {rec.variety && (
                              <span
                                style={{ background: varietyColor, color: "#fff", borderRadius: "4px", padding: "1px 6px", fontSize: "10px", fontWeight: 700 }}
                              >
                                {getVarietyAbbr(rec.variety)}
                              </span>
                            )}
                          </div>
                          <dl className="space-y-1.5 text-[12px]">
                            {rec.variety && (
                              <div className="flex justify-between gap-2">
                                <dt className="text-muted-foreground">Variedad</dt>
                                <dd className="font-medium text-right">{rec.variety}</dd>
                              </div>
                            )}
                            {rec.areaId && (
                              <div className="flex justify-between gap-2">
                                <dt className="text-muted-foreground">Área</dt>
                                <dd className="font-medium text-right">{rec.areaId}</dd>
                              </div>
                            )}
                            {rec.spType && (
                              <div className="flex justify-between gap-2">
                                <dt className="text-muted-foreground">Tipo SP</dt>
                                <dd className="font-medium text-right" style={{ color: spAccent }}>{rec.spType}</dd>
                              </div>
                            )}
                            {rec.fase && (
                              <div className="flex justify-between gap-2">
                                <dt className="text-muted-foreground">Fase</dt>
                                <dd className="font-medium text-right">{rec.fase}</dd>
                              </div>
                            )}
                          </dl>
                        </>
                      ) : (
                        <p className="py-3 text-center text-sm text-muted-foreground">Sin datos para este ciclo en el mes actual.</p>
                      )}

                      <div className="mt-3 space-y-2">
                        {ilumCycleDateRange?.min && (
                          <div className="flex items-center justify-between rounded-lg bg-slate-50/50 dark:bg-slate-900/20 px-3 py-2">
                            <span className="flex items-center gap-2">
                              <span className="inline-block size-2.5 rounded-full bg-slate-400 shadow-sm" />
                              <span className="text-xs text-muted-foreground">Inicio</span>
                            </span>
                            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{formatDate(ilumCycleDateRange.min)}</span>
                          </div>
                        )}
                        {ilumCycleDateRange?.max && (
                          <div className="flex items-center justify-between rounded-lg bg-slate-50/50 dark:bg-slate-900/20 px-3 py-2">
                            <span className="flex items-center gap-2">
                              <span className="inline-block size-2.5 rounded-full bg-slate-400 shadow-sm" />
                              <span className="text-xs text-muted-foreground">Fin</span>
                            </span>
                            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{formatDate(ilumCycleDateRange.max)}</span>
                          </div>
                        )}
                        {ilumDays !== null && (
                          <div className="flex items-center justify-between rounded-lg bg-slate-100/60 dark:bg-slate-900/40 px-3 py-2">
                            <span className="text-xs text-muted-foreground">Duración</span>
                            <span className="text-sm font-bold text-slate-600 dark:text-slate-400">{ilumDays} días</span>
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => setSelectedIlumCycleKey(null)}
                        className="w-full rounded-lg border border-border/60 py-1.5 text-[11px] text-muted-foreground hover:text-foreground hover:border-border transition-colors"
                      >
                        Limpiar selección
                      </button>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* Day detail */}
          <div className="rounded-2xl border border-border/60 bg-card shadow-sm">
            <div className="border-b border-border/50 bg-muted/20 px-5 py-4">
              <h3 className="text-sm font-semibold">
                {selected
                  ? new Date(selected + "T00:00:00").toLocaleDateString("es-ES", {
                      weekday: "long", day: "numeric", month: "long",
                    })
                  : "Selecciona un día"}
              </h3>
              {selected && (
                <p className="mt-0.5 text-[12px] text-muted-foreground">
                  {selectedEvents.length === 0
                    ? "Sin programaciones"
                    : `${selectedEvents.length} programación${selectedEvents.length !== 1 ? "es" : ""}`}
                </p>
              )}
            </div>

            <div className="px-5 py-4">
              {!selected && (
                <p className="py-4 text-center text-sm text-muted-foreground/60">
                  Haz clic en un día para ver el detalle.
                </p>
              )}
              {selected && selectedEvents.length === 0 && (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  Sin programaciones para este día.
                </p>
              )}
              {selected && selectedEvents.length > 0 && (
                <div className="space-y-2">
                  {selectedEvents.map((ev, i) => {
                    const areaStyle    = getAreaStyle(ev.areaId);
                    const spAccent     = getSpTypeAccent(ev.spType);
                    const varietyColor = getVarietyColor(ev.variety);
                    return (
                      <div
                        key={i}
                        style={{ background: areaStyle.bg, borderTop: `1px solid ${areaStyle.border}`, borderRight: `1px solid ${areaStyle.border}`, borderBottom: `1px solid ${areaStyle.border}`, borderLeft: `4px solid ${spAccent}` }}
                        className="rounded-xl px-4 py-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold">{ev.blockId}</p>
                          <span
                            style={{ background: varietyColor, color: "#fff", borderRadius: "4px", padding: "1px 5px", fontSize: "10px", fontWeight: 700 }}
                          >
                            {getVarietyAbbr(ev.variety)}
                          </span>
                        </div>
                        <dl className="mt-1.5 space-y-0.5 text-[12px] text-muted-foreground">
                          {ev.variety  && <div className="flex gap-1.5"><dt>Variedad:</dt><dd className="font-medium text-foreground">{ev.variety}</dd></div>}
                          {ev.spType   && <div className="flex gap-1.5"><dt>Tipo SP:</dt><dd className="font-medium text-foreground">{ev.spType}</dd></div>}
                          {ev.areaId   && <div className="flex gap-1.5"><dt>Área:</dt><dd className="font-medium text-foreground">{ev.areaId}</dd></div>}
                          {ev.fase     && <div className="flex gap-1.5"><dt>Fase:</dt><dd className="font-medium text-foreground">{ev.fase}</dd></div>}
                        </dl>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Month summary */}
          <div className="rounded-2xl border border-border/60 bg-card shadow-sm">
            <div className="border-b border-border/50 bg-muted/20 px-5 py-4">
              <h3 className="text-sm font-semibold">Resumen del mes</h3>
            </div>
            <div className="px-5 py-4">
              {filtered.length === 0 ? (
                <p className="py-2 text-center text-sm text-muted-foreground/60">
                  Sin registros para los filtros actuales.
                </p>
              ) : (
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Total registros</dt>
                    <dd className="font-semibold">{formatInteger(filtered.length)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Días con actividad</dt>
                    <dd className="font-semibold">{byDate.size}</dd>
                  </div>
                  {areaOptions.length > 0 && (
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Áreas</dt>
                      <dd className="font-semibold">{areaOptions.length}</dd>
                    </div>
                  )}
                </dl>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
