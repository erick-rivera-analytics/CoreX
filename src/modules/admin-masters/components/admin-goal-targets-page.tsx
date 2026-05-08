"use client";

import { startTransition, useDeferredValue, useMemo, useState } from "react";
import useSWR from "swr";
import { ChevronDown, ChevronRight, Plus, RefreshCcw, Search, Target, X } from "lucide-react";
import { toast } from "sonner";

import { fetchJson } from "@/lib/fetch-json";
import { cn } from "@/lib/utils";
import { decodeMultiSelectValue, encodeMultiSelectValue } from "@/lib/multi-select";
import { MetricTile } from "@/shared/data-display/metric-tile";
import { FilterPanel, KpiGrid } from "@/shared/layout/filter-panel";
import { SectionPageShell } from "@/shared/layout/section-page-shell";
import { DateField } from "@/shared/filters/date-field";
import { MultiSelectField } from "@/shared/filters/multi-select-field";
import { SingleSelectField } from "@/shared/filters/single-select-field";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { localDateString } from "@/shared/lib/format";

import {
  AdminGoalTargetEditor,
  type EditorMode,
  type EditorOption,
  type MetaEditorForm,
  type VariantValue,
} from "@/modules/admin-masters/components/admin-goal-target-editor";

// ── Types ──────────────────────────────────────────────────────────────────────

type ScopeLevel = {
  level_index: number;
  level_key: string;
  level_label: string;
  value_code: string;
  value_label: string;
};

type AdminGoalTarget = {
  targetCode: string;
  targetName: string;
  targetDescription: string | null;
  metricCode: string | null;
  metricName: string | null;
  unitSymbol: string | null;
  operatorCode: string | null;
  operatorLabel: string | null;
  valueMin: number | null;
  valueMax: number | null;
  valueText: string | null;
  notesText: string | null;
  domainCodes: string[];
  typeItemCodes: string[];
  validFrom: string;
  validTo: string | null;
  targetGrainCode: string | null;
  targetScopeJsonb: {
    grain_code?: string;
    levels?: ScopeLevel[];
    filters?: Record<string, string>;
  } | null;
};

type AdminMetric = { metricCode: string; metricName: string };
type AdminDomain = { domainCode: string; domainName: string };
type AdminCatalogItem = { itemCode: string; itemLabelEs: string };

type GoalsPayload = {
  targets: AdminGoalTarget[];
  metrics: AdminMetric[];
  domains: AdminDomain[];
  operators: AdminCatalogItem[];
  goalTypes: AdminCatalogItem[];
};

type GrainGroup = {
  grainCode: string;
  label: string;
  metricCode: string | null;
  domainCodes: string[];
  typeItemCodes: string[];
  operatorCode: string | null;
  targets: AdminGoalTarget[];
};

type BulkDraftRow = MetaEditorForm & {
  rowId: string;
};

// ── Constants ──────────────────────────────────────────────────────────────────

const ENDPOINT = "/api/admin/administracion-maestros/metas-objetivos";
const fetcher = (url: string) => fetchJson<GoalsPayload>(url, "No se pudo cargar metas y objetivos.");
const PAGE_SIZE = 50;

const EMPTY_FORM: MetaEditorForm = {
  grainCode: "",
  targetCode: "",
  metricCode: "",
  domainCodesEncoded: "all",
  typeItemCodesEncoded: "all",
  operatorCode: "",
  valueMin: "",
  valueMax: "",
  valueText: "",
  validFromDate: localDateString(),
  notesText: "",
  changeReason: "",
  variantValues: [],
};

function createBulkDraft(seed?: Partial<MetaEditorForm>): BulkDraftRow {
  return {
    ...EMPTY_FORM,
    validFromDate: localDateString(),
    ...seed,
    variantValues: seed?.variantValues?.map((level) => ({ ...level })) ?? [],
    rowId: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
  };
}

function labelOf(opts: EditorOption[]) {
  const map = new Map(opts.map((option) => [option.code, option.label] as const));
  return (value: string) => map.get(value) ?? value;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function buildGrainGroups(
  targets: AdminGoalTarget[],
  metrics: AdminMetric[],
  domains: AdminDomain[],
): GrainGroup[] {
  const metricMap = new Map(metrics.map((m) => [m.metricCode, m.metricName]));
  const domainMap = new Map(domains.map((d) => [d.domainCode, d.domainName]));
  const grainMap = new Map<string, AdminGoalTarget[]>();
  const noGrain: AdminGoalTarget[] = [];

  for (const t of targets) {
    const grain = t.targetGrainCode ?? t.targetScopeJsonb?.grain_code ?? null;
    if (grain) {
      const list = grainMap.get(grain) ?? [];
      list.push(t);
      grainMap.set(grain, list);
    } else {
      noGrain.push(t);
    }
  }

  const groups: GrainGroup[] = [...grainMap.entries()].map(([grainCode, items]) => {
    const first = items[0]!;
    const metricName = first.metricCode ? (metricMap.get(first.metricCode) ?? first.metricCode) : null;
    const domainNames = first.domainCodes.map((dc) => domainMap.get(dc) ?? dc).join(", ");
    return {
      grainCode,
      label: [metricName, domainNames].filter(Boolean).join(" · ") || grainCode,
      metricCode: first.metricCode,
      domainCodes: first.domainCodes,
      typeItemCodes: first.typeItemCodes,
      operatorCode: first.operatorCode,
      targets: items,
    };
  });

  if (noGrain.length > 0) {
    groups.push({
      grainCode: "__ungrouped__",
      label: "Sin agrupación",
      metricCode: null,
      domainCodes: [],
      typeItemCodes: [],
      operatorCode: null,
      targets: noGrain,
    });
  }

  return groups;
}

function buildScopeJsonb(grainCode: string, variantValues: MetaEditorForm["variantValues"]) {
  if (variantValues.length === 0) return null;
  const levels = variantValues.map((v, i) => ({
    level_index: i + 1,
    level_key: v.level_key.trim(),
    level_label: v.level_label.trim(),
    value_code: v.value_code.trim(),
    value_label: v.value_label.trim(),
  }));
  return {
    grain_code: grainCode.trim() || undefined,
    levels,
    filters: Object.fromEntries(levels.map((l) => [l.level_key, l.value_code])),
  };
}

function slugPart(value: string): string {
  return value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 28);
}

function buildDeterministicTargetCode(metricCode: string, variantValues: VariantValue[]): string {
  const parts = [
    slugPart(metricCode || "target"),
    ...variantValues.map((v) => slugPart(v.value_code || v.value_label)).filter(Boolean),
  ].filter(Boolean);
  return parts.join("_").replace(/_+/g, "_").slice(0, 96);
}

function scopeValidationError(variantValues: VariantValue[]): string | null {
  const keys = new Set<string>();
  for (const [index, level] of variantValues.entries()) {
    const key = level.level_key.trim();
    const value = level.value_code.trim();
    if (!key || !level.level_label.trim() || !value || !level.value_label.trim()) {
      return `Completa todos los campos del nivel ${index + 1}.`;
    }
    if (keys.has(key)) {
      return `La clave ${key} está repetida en el camino.`;
    }
    keys.add(key);
  }
  return null;
}

function buildTargetName(metricName: string | null | undefined, variantValues: MetaEditorForm["variantValues"]): string {
  const labels = variantValues.flatMap((v) => v.value_label.trim() ? [v.value_label.trim()] : []).join(" ");
  return [metricName, labels].filter(Boolean).join(" ");
}

function grainLabelFrom(
  group: Pick<GrainGroup, "metricCode" | "domainCodes" | "grainCode">,
  metrics: AdminMetric[],
  domains: AdminDomain[],
): string {
  const metricName = group.metricCode
    ? metrics.find((m) => m.metricCode === group.metricCode)?.metricName
    : null;
  const domainNames = group.domainCodes
    .map((dc) => domains.find((d) => d.domainCode === dc)?.domainName ?? dc)
    .join(", ");
  return [metricName, domainNames].filter(Boolean).join(" · ") || group.grainCode;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function AdminGoalTargetsPage() {
  const { data, mutate, isValidating } = useSWR(ENDPOINT, fetcher, { revalidateOnFocus: false });

  // Editor state
  const [editorMode, setEditorMode] = useState<EditorMode>("idle");
  const [selectedVariantCode, setSelectedVariantCode] = useState<string | null>(null);
  const [selectedGrainCode, setSelectedGrainCode] = useState<string | null>(null);
  const [form, setForm] = useState<MetaEditorForm>(EMPTY_FORM);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkRows, setBulkRows] = useState<BulkDraftRow[]>([]);

  // List state
  const [search, setSearch] = useState("");
  const [domainFilter, setDomainFilter] = useState<string>("all");
  const [metricFilter, setMetricFilter] = useState<string>("all");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [pageOffset, setPageOffset] = useState(0);
  const deferredSearch = useDeferredValue(search);

  const targets = useMemo(() => data?.targets ?? [], [data?.targets]);
  const metrics = useMemo(() => data?.metrics ?? [], [data?.metrics]);
  const domains = useMemo(() => data?.domains ?? [], [data?.domains]);
  const operators = useMemo(() => data?.operators ?? [], [data?.operators]);
  const goalTypes = useMemo(() => data?.goalTypes ?? [], [data?.goalTypes]);

  const grainGroups = useMemo(
    () => buildGrainGroups(targets, metrics, domains),
    [targets, metrics, domains],
  );

  const filteredTargets = useMemo(() => {
    const normalized = deferredSearch.trim().toLowerCase();
    return targets.filter((t) => {
      if (domainFilter !== "all" && !t.domainCodes.includes(domainFilter)) return false;
      if (metricFilter !== "all" && t.metricCode !== metricFilter) return false;
      if (normalized) {
        const scopeText = (t.targetScopeJsonb?.levels ?? [])
          .map((l) => `${l.level_label} ${l.value_label} ${l.value_code}`)
          .join(" ");
        const hay = `${t.targetCode} ${t.targetName} ${t.targetGrainCode ?? ""} ${scopeText}`.toLowerCase();
        if (!hay.includes(normalized)) return false;
      }
      return true;
    });
  }, [targets, deferredSearch, domainFilter, metricFilter]);

  const filteredGroups = useMemo(() => {
    const matchSet = new Set(filteredTargets.map((t) => t.targetCode));
    return grainGroups.flatMap((g) => {
      const targets = g.targets.filter((t) => matchSet.has(t.targetCode));
      return targets.length > 0 ? [{ ...g, targets }] : [];
    });
  }, [grainGroups, filteredTargets]);

  const pagedGroups = useMemo(
    () => filteredGroups.slice(pageOffset, pageOffset + PAGE_SIZE),
    [filteredGroups, pageOffset],
  );
  const hasMore = pageOffset + PAGE_SIZE < filteredGroups.length;

  const selectedVariant = selectedVariantCode
    ? targets.find((t) => t.targetCode === selectedVariantCode) ?? null
    : null;
  const selectedGrain = selectedGrainCode
    ? grainGroups.find((g) => g.grainCode === selectedGrainCode) ?? null
    : null;

  const metricOptions: EditorOption[] = useMemo(
    () => metrics.map((m) => ({ code: m.metricCode, label: m.metricName })),
    [metrics],
  );
  const domainOptions: EditorOption[] = useMemo(
    () => domains.map((d) => ({ code: d.domainCode, label: d.domainName })),
    [domains],
  );
  const operatorOptions: EditorOption[] = useMemo(
    () => operators.map((o) => ({ code: o.itemCode, label: o.itemLabelEs })),
    [operators],
  );
  const goalTypeOptions: EditorOption[] = useMemo(
    () => goalTypes.map((g) => ({ code: g.itemCode, label: g.itemLabelEs })),
    [goalTypes],
  );

  // ── Editor actions ─────────────────────────────────────────────────────────

  function cancelEditor() {
    setEditorMode("idle");
    setSelectedVariantCode(null);
    setSelectedGrainCode(null);
  }

  function openCreateMeta() {
    startTransition(() => {
      setEditorMode("create-meta");
      setSelectedVariantCode(null);
      setSelectedGrainCode(null);
      setForm({ ...EMPTY_FORM, validFromDate: localDateString() });
    });
  }

  function openAddVariant(grain: GrainGroup) {
    startTransition(() => {
      setEditorMode("add-variant");
      setSelectedVariantCode(null);
      setSelectedGrainCode(grain.grainCode);
      // Inherit dimension schema from existing variants; user only fills value_code + value_label
      const schema = (grain.targets[0]?.targetScopeJsonb?.levels ?? []).map((l) => ({
        level_key: l.level_key,
        level_label: l.level_label,
        value_code: "",
        value_label: "",
      }));
      setForm({
        ...EMPTY_FORM,
        grainCode: grain.grainCode,
        metricCode: grain.metricCode ?? "",
        domainCodesEncoded: encodeMultiSelectValue(grain.domainCodes),
        typeItemCodesEncoded: encodeMultiSelectValue(grain.typeItemCodes),
        operatorCode: grain.operatorCode ?? "",
        validFromDate: localDateString(),
        variantValues: schema,
      });
    });
  }

  function openEditVariant(t: AdminGoalTarget) {
    startTransition(() => {
      setEditorMode("edit-variant");
      setSelectedVariantCode(t.targetCode);
      setSelectedGrainCode(t.targetGrainCode ?? null);
      setForm({
        ...EMPTY_FORM,
        grainCode: t.targetGrainCode ?? t.targetScopeJsonb?.grain_code ?? "",
        targetCode: t.targetCode,
        metricCode: t.metricCode ?? "",
        domainCodesEncoded: encodeMultiSelectValue(t.domainCodes),
        typeItemCodesEncoded: encodeMultiSelectValue(t.typeItemCodes),
        operatorCode: t.operatorCode ?? "",
        valueMin: t.valueMin !== null ? String(t.valueMin) : "",
        valueMax: t.valueMax !== null ? String(t.valueMax) : "",
        valueText: t.valueText ?? "",
        validFromDate: t.validFrom ? t.validFrom.slice(0, 10) : localDateString(),
        notesText: t.notesText ?? "",
        changeReason: "",
        variantValues: (t.targetScopeJsonb?.levels ?? []).map((l) => ({
          level_key: l.level_key,
          level_label: l.level_label,
          value_code: l.value_code,
          value_label: l.value_label,
        })),
      });
    });
  }

  // ── Submit ─────────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!form.validFromDate) {
      toast.error("La fecha de inicio es obligatoria.");
      return;
    }

    if (editorMode !== "edit-variant") {
      const scopeError = scopeValidationError(form.variantValues);
      if (scopeError) {
        toast.error(scopeError);
        return;
      }
    }

    const metricName = metrics.find((m) => m.metricCode === form.metricCode)?.metricName;
    const generatedTargetCode = form.targetCode.trim()
      || buildDeterministicTargetCode(form.metricCode, form.variantValues);
    const targetName = buildTargetName(metricName, form.variantValues) || generatedTargetCode || form.grainCode;
    const scopeJsonb = buildScopeJsonb(form.grainCode, form.variantValues);

    if (editorMode === "edit-variant") {
      if (!selectedVariant) return;
      if (form.validFromDate <= selectedVariant.validFrom.slice(0, 10)) {
        toast.error("La nueva fecha de inicio debe ser posterior a la versión vigente.");
        return;
      }
      try {
        await fetchJson(ENDPOINT, "No se pudo actualizar.", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "update",
            targetCode: form.targetCode,
            targetName,
            metricCode: form.metricCode || null,
            operatorCode: form.operatorCode || null,
            valueMin: form.valueMin === "" ? null : Number(form.valueMin),
            valueMax: form.valueMax === "" ? null : Number(form.valueMax),
            valueText: form.valueText.trim() || null,
            notesText: form.notesText.trim() || null,
            domainCodes: decodeMultiSelectValue(form.domainCodesEncoded),
            typeItemCodes: decodeMultiSelectValue(form.typeItemCodesEncoded),
            validFromDate: form.validFromDate,
            changeReason: form.changeReason.trim() || "manual_update",
            targetScopeJsonb: scopeJsonb,
          }),
        });
        toast.success("Variante actualizada (nueva versión SCD2).");
        await mutate(undefined, { revalidate: true });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Error al guardar.");
      }
      return;
    }

    // create-meta or add-variant → POST
    if (!generatedTargetCode) {
      toast.error("No se pudo generar el código de variante. Completa métrica o niveles.");
      return;
    }

    try {
      await fetchJson(ENDPOINT, "No se pudo crear.", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetCode: generatedTargetCode,
          targetName,
          metricCode: form.metricCode || null,
          operatorCode: form.operatorCode || null,
          valueMin: form.valueMin === "" ? null : Number(form.valueMin),
          valueMax: form.valueMax === "" ? null : Number(form.valueMax),
          valueText: form.valueText.trim() || null,
          notesText: form.notesText.trim() || null,
          domainCodes: decodeMultiSelectValue(form.domainCodesEncoded),
          typeItemCodes: decodeMultiSelectValue(form.typeItemCodesEncoded),
          validFromDate: form.validFromDate,
          changeReason: editorMode === "add-variant" ? "add_variant" : "manual_create",
          targetScopeJsonb: scopeJsonb,
        }),
      });
      toast.success(editorMode === "add-variant" ? "Variante agregada." : "Meta creada.");
      await mutate(undefined, { revalidate: true });
      cancelEditor();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al crear.");
    }
  }

  async function deactivateVariant() {
    if (!selectedVariant) return;
    try {
      await fetchJson(ENDPOINT, "No se pudo desactivar.", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set-validity",
          targetCode: selectedVariant.targetCode,
          isValid: false,
        }),
      });
      toast.success("Variante desactivada.");
      cancelEditor();
      await mutate(undefined, { revalidate: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo desactivar.");
    }
  }

  // ── List helpers ───────────────────────────────────────────────────────────

  function addBulkRow(seed?: Partial<MetaEditorForm>) {
    setBulkOpen(true);
    setBulkRows((rows) => [...rows, createBulkDraft(seed)]);
  }

  function updateBulkRow(rowId: string, patch: Partial<MetaEditorForm>) {
    setBulkRows((rows) =>
      rows.map((row) => (row.rowId === rowId ? { ...row, ...patch } : row)),
    );
  }

  function updateBulkLevel(rowId: string, index: number, patch: Partial<VariantValue>) {
    setBulkRows((rows) =>
      rows.map((row) => {
        if (row.rowId !== rowId) return row;
        return {
          ...row,
          variantValues: row.variantValues.map((level, i) =>
            i === index ? { ...level, ...patch } : level,
          ),
        };
      }),
    );
  }

  async function submitBulkRows() {
    if (bulkRows.length === 0) {
      toast.error("Agrega al menos una fila.");
      return;
    }

    const rows = [];
    for (const [index, row] of bulkRows.entries()) {
      const scopeError = scopeValidationError(row.variantValues);
      if (scopeError) {
        toast.error(`Fila ${index + 1}: ${scopeError}`);
        return;
      }
      const targetCode = row.targetCode.trim()
        || buildDeterministicTargetCode(row.metricCode, row.variantValues);
      if (!targetCode) {
        toast.error(`Fila ${index + 1}: no se pudo generar el código.`);
        return;
      }
      const metricName = metrics.find((m) => m.metricCode === row.metricCode)?.metricName;
      rows.push({
        targetCode,
        targetName: buildTargetName(metricName, row.variantValues) || targetCode,
        metricCode: row.metricCode || null,
        operatorCode: row.operatorCode || null,
        valueMin: row.valueMin === "" ? null : Number(row.valueMin),
        valueMax: row.valueMax === "" ? null : Number(row.valueMax),
        valueText: row.valueText.trim() || null,
        notesText: row.notesText.trim() || null,
        domainCodes: decodeMultiSelectValue(row.domainCodesEncoded),
        typeItemCodes: decodeMultiSelectValue(row.typeItemCodesEncoded),
        validFromDate: row.validFromDate,
        changeReason: "bulk_create",
        targetScopeJsonb: buildScopeJsonb(row.grainCode, row.variantValues),
      });
    }

    try {
      await fetchJson<{ targets: AdminGoalTarget[] }>(
        `${ENDPOINT}/bulk`,
        "No se pudo cargar metas en bloque.",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rows }),
        },
      );
      toast.success(`${bulkRows.length} metas creadas.`);
      setBulkRows([]);
      setBulkOpen(false);
      await mutate(undefined, { revalidate: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al cargar metas.");
    }
  }

  function toggleGroup(grain: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(grain)) next.delete(grain); else next.add(grain);
      return next;
    });
  }

  function resetFilters() {
    setSearch("");
    setDomainFilter("all");
    setMetricFilter("all");
    setPageOffset(0);
  }

  function renderVariantRow(t: AdminGoalTarget): React.ReactNode {
    const isSelected = selectedVariantCode === t.targetCode && editorMode === "edit-variant";
    const levels = t.targetScopeJsonb?.levels ?? [];
    const targetValue =
      t.valueText
      ?? (t.valueMin !== null && t.valueMax !== null ? `${t.valueMin}–${t.valueMax}` : null)
      ?? (t.valueMin !== null ? `≥ ${t.valueMin}` : null)
      ?? (t.valueMax !== null ? `≤ ${t.valueMax}` : null)
      ?? null;

    return (
      <button
        key={t.targetCode}
        type="button"
        className={cn(
          "w-full rounded-[14px] border px-3 py-2.5 text-left transition-colors",
          isSelected
            ? "border-slate-900 bg-slate-900 text-white"
            : "border-border/60 bg-background/80 hover:border-slate-300",
        )}
        onClick={() => openEditVariant(t)}
      >
        <div className="flex flex-wrap items-center gap-1.5">
          {levels.length > 0
            ? levels.map((l) => (
                <Badge
                  key={l.level_key}
                  variant="outline"
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-normal",
                    isSelected && "border-white/20 bg-white/12 text-white",
                  )}
                >
                  <span className="font-medium">{l.level_label}:</span>&nbsp;{l.value_label}
                </Badge>
              ))
            : <span className="text-sm font-medium">{t.targetName}</span>
          }
          {targetValue !== null && (
            <Badge
              variant={isSelected ? "secondary" : "outline"}
              className={cn(
                "ml-auto shrink-0 rounded-full px-2 py-0.5 text-[10px]",
                isSelected && "border-white/20 bg-white/12 text-white",
              )}
            >
              {t.operatorLabel ? `${t.operatorLabel} ` : ""}{targetValue}
              {t.unitSymbol ? ` ${t.unitSymbol}` : ""}
            </Badge>
          )}
        </div>
        <p className={cn("mt-0.5 text-[10px]", isSelected ? "text-white/60" : "text-muted-foreground/70")}>
          {t.targetCode}
        </p>
      </button>
    );
  }

  // ── Derived ────────────────────────────────────────────────────────────────

  const hasFilters = !!(search || domainFilter !== "all" || metricFilter !== "all");
  const totalFilteredTargets = filteredTargets.length;

  const editorGrainLabel =
    editorMode === "edit-variant" && selectedVariant
      ? grainLabelFrom(
          {
            metricCode: selectedVariant.metricCode,
            domainCodes: selectedVariant.domainCodes,
            grainCode: selectedVariant.targetGrainCode ?? selectedVariant.targetScopeJsonb?.grain_code ?? "",
          },
          metrics,
          domains,
        )
      : editorMode === "add-variant" && selectedGrain
        ? grainLabelFrom(selectedGrain, metrics, domains)
        : null;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      <SectionPageShell
        eyebrow="Administración / Maestros globales / Metas y objetivos"
        title="Metas y objetivos"
        subtitle="Una meta = métrica + dominio + grain_code. Cada grain agrupa todas sus variantes de alcance (por variedad, semana, origen, etc.)."
        icon={<Target className="size-5" aria-hidden="true" />}
        actions={(
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" className="rounded-full" onClick={() => void mutate()}>
              <RefreshCcw className={cn("size-4", isValidating && "animate-spin")} />
              Recargar
            </Button>
            <Button type="button" className="rounded-full" onClick={openCreateMeta}>
              <Plus className="size-4" />
              Nueva meta
            </Button>
            <Button type="button" variant="outline" className="rounded-full" onClick={() => addBulkRow()}>
              <Plus className="size-4" />
              Carga rápida
            </Button>
          </div>
        )}
      >
        <FilterPanel>
          <div className="flex flex-wrap items-end gap-3">
            <SingleSelectField
              id="goal-domain-filter"
              label="Dominio"
              value={domainFilter}
              options={domains.map((d) => d.domainCode)}
              displayValue={(v) => domains.find((d) => d.domainCode === v)?.domainName ?? v}
              emptyLabel="Todos los dominios"
              onChange={(v) => { setDomainFilter(v); setPageOffset(0); }}
            />
            <SingleSelectField
              id="goal-metric-filter"
              label="Métrica"
              value={metricFilter}
              options={metrics.map((m) => m.metricCode)}
              displayValue={(v) => metrics.find((m) => m.metricCode === v)?.metricName ?? v}
              emptyLabel="Todas las métricas"
              onChange={(v) => { setMetricFilter(v); setPageOffset(0); }}
            />
            {hasFilters && (
              <div className="flex items-end pb-0.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-9 gap-1.5 text-muted-foreground"
                  onClick={resetFilters}
                >
                  <X className="size-3.5" />
                  Restablecer filtros
                </Button>
              </div>
            )}
          </div>
          <KpiGrid columns={4}>
            <MetricTile
              label="Variantes activas"
              value={String(totalFilteredTargets)}
              hint={`Total catálogo: ${targets.length}`}
            />
            <MetricTile
              label="Metas (grains)"
              value={String(grainGroups.filter((g) => g.grainCode !== "__ungrouped__").length)}
              hint="Metas distintas agrupadas por grain_code."
            />
            <MetricTile label="Dominios" value={String(domains.length)} hint="Macro-dominios disponibles." />
            <MetricTile label="Métricas" value={String(metrics.length)} hint="Métricas con metas definidas." />
          </KpiGrid>
        </FilterPanel>
      </SectionPageShell>

      {bulkOpen && (
        <Card className="starter-panel border-border/70 bg-card/84">
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="text-lg">Carga rápida de caminos</CardTitle>
                <CardDescription>
                  Tabla editable para crear varias hojas con niveles libres. Cada fila genera su propio JSONB de alcance.
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" className="rounded-full" onClick={() => addBulkRow()}>
                  <Plus className="size-4" />
                  Agregar fila
                </Button>
                <Button type="button" className="rounded-full" onClick={() => void submitBulkRows()}>
                  Guardar filas
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="rounded-full"
                  onClick={() => {
                    setBulkOpen(false);
                    setBulkRows([]);
                  }}
                >
                  Cerrar
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {bulkRows.map((row, rowIndex) => (
              <div key={row.rowId} className="rounded-[18px] border border-border/70 bg-background/80 p-3">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold">Fila {rowIndex + 1}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="rounded-full text-muted-foreground"
                    onClick={() => setBulkRows((rows) => rows.filter((item) => item.rowId !== row.rowId))}
                  >
                    <X className="size-4" />
                    Quitar
                  </Button>
                </div>
                <div className="grid gap-3 lg:grid-cols-4">
                  <div className="space-y-2">
                    <Label>Código</Label>
                    <Input
                      className="rounded-xl font-mono text-xs"
                      value={row.targetCode}
                      placeholder="Auto"
                      onChange={(e) => updateBulkRow(row.rowId, { targetCode: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Grain code</Label>
                    <Input
                      className="rounded-xl font-mono text-xs"
                      value={row.grainCode}
                      onChange={(e) => updateBulkRow(row.rowId, { grainCode: e.target.value })}
                    />
                  </div>
                  <SingleSelectField
                    id={`bulk-metric-${row.rowId}`}
                    label="Métrica"
                    value={row.metricCode || "all"}
                    options={metricOptions.map((o) => o.code)}
                    displayValue={labelOf(metricOptions)}
                    emptyLabel="Sin métrica"
                    onChange={(value) => updateBulkRow(row.rowId, { metricCode: value === "all" ? "" : value })}
                  />
                  <SingleSelectField
                    id={`bulk-operator-${row.rowId}`}
                    label="Operador"
                    value={row.operatorCode || "all"}
                    options={operatorOptions.map((o) => o.code)}
                    displayValue={labelOf(operatorOptions)}
                    emptyLabel="Sin operador"
                    onChange={(value) => updateBulkRow(row.rowId, { operatorCode: value === "all" ? "" : value })}
                  />
                  <MultiSelectField
                    id={`bulk-domain-${row.rowId}`}
                    label="Dominios"
                    value={row.domainCodesEncoded}
                    options={domainOptions.map((o) => o.code)}
                    displayValue={labelOf(domainOptions)}
                    onChange={(value) => updateBulkRow(row.rowId, { domainCodesEncoded: value })}
                  />
                  <MultiSelectField
                    id={`bulk-type-${row.rowId}`}
                    label="Tipo"
                    value={row.typeItemCodesEncoded}
                    options={goalTypeOptions.map((o) => o.code)}
                    displayValue={labelOf(goalTypeOptions)}
                    onChange={(value) => updateBulkRow(row.rowId, { typeItemCodesEncoded: value })}
                  />
                  <div className="space-y-2">
                    <Label>Valor</Label>
                    <Input
                      type="number"
                      className="rounded-xl"
                      value={row.valueMin}
                      onChange={(e) => updateBulkRow(row.rowId, { valueMin: e.target.value })}
                    />
                  </div>
                  <DateField
                    id={`bulk-valid-${row.rowId}`}
                    label="Vigente desde"
                    value={row.validFromDate}
                    onChange={(value) => updateBulkRow(row.rowId, { validFromDate: value })}
                  />
                </div>
                <div className="mt-3 overflow-x-auto rounded-xl border border-border/60">
                  <table className="w-full min-w-[920px] text-xs">
                    <thead className="bg-muted/50 text-muted-foreground">
                      <tr>
                        <th className="px-2 py-2 text-left">Nivel</th>
                        <th className="px-2 py-2 text-left">level_key</th>
                        <th className="px-2 py-2 text-left">Etiqueta nivel</th>
                        <th className="px-2 py-2 text-left">value_code</th>
                        <th className="px-2 py-2 text-left">Etiqueta valor</th>
                        <th className="px-2 py-2 text-right">Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {row.variantValues.map((level, levelIndex) => (
                        <tr key={`${row.rowId}-${levelIndex}`} className="border-t border-border/60">
                          <td className="px-2 py-2 font-mono">{levelIndex + 1}</td>
                          <td className="px-2 py-2">
                            <Input className="h-8 font-mono text-xs" value={level.level_key} onChange={(e) => updateBulkLevel(row.rowId, levelIndex, { level_key: e.target.value })} />
                          </td>
                          <td className="px-2 py-2">
                            <Input className="h-8 text-xs" value={level.level_label} onChange={(e) => updateBulkLevel(row.rowId, levelIndex, { level_label: e.target.value })} />
                          </td>
                          <td className="px-2 py-2">
                            <Input className="h-8 font-mono text-xs" value={level.value_code} onChange={(e) => updateBulkLevel(row.rowId, levelIndex, { value_code: e.target.value })} />
                          </td>
                          <td className="px-2 py-2">
                            <Input className="h-8 text-xs" value={level.value_label} onChange={(e) => updateBulkLevel(row.rowId, levelIndex, { value_label: e.target.value })} />
                          </td>
                          <td className="px-2 py-2 text-right">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="rounded-full"
                              onClick={() =>
                                updateBulkRow(row.rowId, {
                                  variantValues: row.variantValues.filter((_, index) => index !== levelIndex),
                                })
                              }
                            >
                              Quitar
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    onClick={() =>
                      updateBulkRow(row.rowId, {
                        variantValues: [
                          ...row.variantValues,
                          { level_key: "", level_label: "", value_code: "", value_label: "" },
                        ],
                      })
                    }
                  >
                    <Plus className="size-3.5" />
                    Agregar nivel
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        {/* ── Left: catálogo de metas ──────────────────────────────────── */}
        <Card className="starter-panel border-border/70 bg-card/84">
          <CardHeader className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-slate-900/10 p-3 text-slate-700 dark:bg-slate-900/20 dark:text-white">
                <Target className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <CardTitle className="text-lg">Catálogo de metas</CardTitle>
                <CardDescription>
                  {filteredGroups.length} {filteredGroups.length === 1 ? "meta" : "metas"} ·{" "}
                  {totalFilteredTargets} variantes
                </CardDescription>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="goal-search">Buscar</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="goal-search"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPageOffset(0); }}
                  placeholder="variedad, semana, origen, código…"
                  className="pl-10"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-1">
            <div className="max-h-[calc(100dvh-22rem)] space-y-2 overflow-y-auto pr-1">
              {pagedGroups.length > 0
                ? pagedGroups.map((group) => {
                    const isOpen = expandedGroups.has(group.grainCode);
                    const PREVIEW = 5;
                    const visibleTargets = isOpen ? group.targets : group.targets.slice(0, PREVIEW);
                    const hiddenCount = group.targets.length - PREVIEW;
                    const isAddingToThisGrain =
                      editorMode === "add-variant" && selectedGrainCode === group.grainCode;

                    return (
                      <div
                        key={group.grainCode}
                        className="overflow-hidden rounded-[18px] border border-border/70 bg-background/80"
                      >
                        {/* Group header */}
                        <div className="flex items-center gap-1 px-2 py-1.5">
                          <button
                            type="button"
                            className="flex min-w-0 flex-1 items-center gap-2 rounded-[12px] px-1 py-1 text-left transition-colors hover:bg-muted/40"
                            onClick={() => toggleGroup(group.grainCode)}
                          >
                            {isOpen
                              ? <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                              : <ChevronRight className="size-4 shrink-0 text-muted-foreground" />}
                            <div className="min-w-0 flex-1">
                              <span className="text-sm font-semibold">
                                {grainLabelFrom(group, metrics, domains)}
                              </span>
                              <span className="ml-2 text-[11px] text-muted-foreground">
                                {group.targets.length} variantes
                              </span>
                            </div>
                            {group.grainCode !== "__ungrouped__" && (
                              <Badge
                                variant="outline"
                                className="shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px]"
                              >
                                {group.grainCode}
                              </Badge>
                            )}
                          </button>
                          {/* "+" button to add a variant to this grain */}
                          {group.grainCode !== "__ungrouped__" && (
                            <button
                              type="button"
                              title="Agregar variante a esta meta"
                              className={cn(
                                "shrink-0 rounded-full p-1.5 transition-colors",
                                isAddingToThisGrain
                                  ? "bg-slate-900 text-white"
                                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                              )}
                              onClick={(e) => { e.stopPropagation(); openAddVariant(group); }}
                            >
                              <Plus className="size-3.5" />
                            </button>
                          )}
                        </div>

                        {/* Variant rows */}
                        <div className="space-y-1 px-2 pb-2">
                          {visibleTargets.map((t) => renderVariantRow(t))}
                          {!isOpen && hiddenCount > 0 && (
                            <button
                              type="button"
                              className="w-full rounded-[10px] py-1.5 text-center text-[11px] text-muted-foreground transition-colors hover:text-foreground"
                              onClick={() => toggleGroup(group.grainCode)}
                            >
                              Ver {hiddenCount} variantes más…
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                : (
                  <div className="rounded-[18px] border border-dashed border-border/70 px-4 py-8 text-center text-sm text-muted-foreground">
                    No hay metas que coincidan con los filtros.
                  </div>
                )}

              {hasMore && (
                <div className="flex justify-center pt-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-full"
                    onClick={() => setPageOffset((p) => p + PAGE_SIZE)}
                  >
                    Mostrar más metas
                  </Button>
                </div>
              )}
              {pageOffset > 0 && (
                <div className="flex justify-center pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="rounded-full"
                    onClick={() => setPageOffset(0)}
                  >
                    Volver al inicio
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ── Right: editor ───────────────────────────────────────────── */}
        <AdminGoalTargetEditor
          mode={editorMode}
          form={form}
          setForm={setForm}
          grainLabel={editorGrainLabel}
          metricOptions={metricOptions}
          domainOptions={domainOptions}
          goalTypeOptions={goalTypeOptions}
          operatorOptions={operatorOptions}
          onSubmit={handleSubmit}
          onDeactivate={editorMode === "edit-variant" ? deactivateVariant : undefined}
          onCancel={cancelEditor}
        />
      </div>
    </div>
  );
}
