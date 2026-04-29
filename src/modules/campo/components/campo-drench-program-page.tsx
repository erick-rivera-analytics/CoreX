"use client";

import { startTransition, useDeferredValue, useEffect, useMemo, useState } from "react";
import {
  Beaker,
  DatabaseZap,
  PencilLine,
  Plus,
  RefreshCcw,
  Save,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import useSWR from "swr";

import type { BodegaProductRecord } from "@/lib/bodega-master-types";
import { DRENCH_PROGRAM_ACTIVITY_ID } from "@/lib/campo-drench-program-types";
import type {
  DrenchProgramLineInput,
  DrenchProgramRuleInput,
  DrenchProgramRulePayload,
  DrenchProgramRuleRecord,
} from "@/lib/campo-drench-program-types";
import { fetchJson } from "@/lib/fetch-json";
import { cn } from "@/lib/utils";
import { MetricTile } from "@/shared/data-display/metric-tile";
import { FilterPanel, KpiGrid } from "@/shared/layout/filter-panel";
import { SectionPageShell } from "@/shared/layout/section-page-shell";
import { formatDateTime } from "@/shared/lib/format";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";

type CampoDrenchProgramPageProps = {
  initialRules: DrenchProgramRuleRecord[];
  initialAssignableProducts: BodegaProductRecord[];
  initialSummary: { rules: number; lines: number };
  initialError?: string | null;
};

type DrenchProgramSnapshot = {
  rules: DrenchProgramRuleRecord[];
  assignableProducts: BodegaProductRecord[];
};

type EditorMode = "create" | "edit";
type FormErrors = Partial<Record<Exclude<keyof DrenchProgramRuleInput, "lines">, string>> & {
  lines?: string;
  lineErrors?: Array<{
    sourceProductName?: string;
    quantityValue?: string;
  }>;
};

const EMPTY_LINE: DrenchProgramLineInput = {
  applicationMethod: "",
  litersPerBed: 50,
  productId: null,
  sourceProductName: "",
  sourceProductCode: "",
  sourceUnitCode: "",
  quantityValue: null,
  quantityReference: "",
  notes: "",
  isActive: true,
};

const EMPTY_FORM_VALUES: DrenchProgramRuleInput = {
  phenologicalWeek: 1,
  cycleType: "S",
  varietyCode: "",
  activityId: DRENCH_PROGRAM_ACTIVITY_ID,
  isActive: true,
  notes: "",
  lines: [{ ...EMPTY_LINE }],
  changeReason: "",
};

const snapshotFetcher = (url: string) =>
  fetchJson<DrenchProgramSnapshot>(url, "No se pudo cargar la programacion de drench.");

function buildRuleCode(values: Pick<DrenchProgramRuleInput, "phenologicalWeek" | "cycleType" | "varietyCode">) {
  const variety = String(values.varietyCode ?? "").trim().toUpperCase();
  if (!variety) {
    return `${values.phenologicalWeek} ${values.cycleType}`;
  }
  return `${values.phenologicalWeek} ${values.cycleType} ${variety}`;
}

function formatProductOption(product: BodegaProductRecord) {
  return `${product.productCode} · ${product.productName}`;
}

function findProductFromSearch(value: string, products: BodegaProductRecord[]) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;

  return products.find((product) => {
    return [
      product.productCode,
      product.productName,
      formatProductOption(product),
    ].some((candidate) => candidate.trim().toLowerCase() === normalized);
  }) ?? null;
}

function findProductCandidates(value: string, products: BodegaProductRecord[]) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return [];

  return products.filter((product) => {
    return [
      product.productCode,
      product.productName,
      formatProductOption(product),
    ].some((candidate) => candidate.trim().toLowerCase().includes(normalized));
  });
}

function mapRecordToFormValues(record: DrenchProgramRuleRecord): DrenchProgramRuleInput {
  return {
    phenologicalWeek: record.phenologicalWeek,
    cycleType: record.cycleType,
    varietyCode: record.varietyCode,
    activityId: record.activityId,
    isActive: record.isActive,
    notes: record.notes ?? "",
    lines: record.lines.map((line) => ({
      lineOrder: line.lineOrder,
      applicationMethod: line.applicationMethod ?? "",
      litersPerBed: line.litersPerBed,
      productId: line.productId,
      sourceProductName: line.sourceProductName ?? line.productName ?? "",
      sourceProductCode: line.sourceProductCode ?? line.productCode ?? "",
      sourceUnitCode: line.sourceUnitCode ?? "",
      quantityValue: line.quantityValue,
      quantityReference: line.quantityReference ?? "",
      notes: line.notes ?? "",
      isActive: line.isActive,
    })),
    changeReason: "",
  };
}

function buildPayload(values: DrenchProgramRuleInput): DrenchProgramRuleInput {
  return {
    phenologicalWeek: Math.max(Math.trunc(Number(values.phenologicalWeek) || 0), 0),
    cycleType: values.cycleType === "P" ? "P" : "S",
    varietyCode: String(values.varietyCode ?? "").trim().toUpperCase(),
    activityId: DRENCH_PROGRAM_ACTIVITY_ID,
    isActive: values.isActive,
    notes: values.notes?.trim() || null,
    lines: values.lines.map((line, index) => ({
      lineOrder: index + 1,
      applicationMethod: line.applicationMethod?.trim() || null,
      litersPerBed: line.litersPerBed === null || line.litersPerBed === undefined
        ? null
        : Number(line.litersPerBed),
      productId: line.productId?.trim() || null,
      sourceProductName: line.sourceProductName?.trim() || null,
      sourceProductCode: line.sourceProductCode?.trim().toUpperCase() || null,
      sourceUnitCode: line.sourceUnitCode?.trim().toUpperCase() || null,
      quantityValue: line.quantityValue === null || line.quantityValue === undefined
        ? null
        : Number(line.quantityValue),
      quantityReference: line.quantityReference?.trim() || null,
      notes: line.notes?.trim() || null,
      isActive: line.isActive ?? true,
    })),
    changeReason: values.changeReason?.trim() || null,
  };
}

function validateForm(values: DrenchProgramRuleInput): FormErrors {
  const payload = buildPayload(values);
  const errors: FormErrors = {};
  const lineErrors: NonNullable<FormErrors["lineErrors"]> = [];

  if (!payload.phenologicalWeek || payload.phenologicalWeek <= 0) {
    errors.phenologicalWeek = "La semana fenologica debe ser mayor a cero.";
  }
  if (!payload.varietyCode) {
    errors.varietyCode = "La variedad es obligatoria.";
  }
  payload.lines.forEach((line, index) => {
    const itemErrors: NonNullable<FormErrors["lineErrors"]>[number] = {};
    if (!line.productId && !line.sourceProductName) {
      itemErrors.sourceProductName = "Debes vincular un producto o dejar un nombre fuente.";
    }
    if (line.quantityValue === null || Number.isNaN(line.quantityValue)) {
      itemErrors.quantityValue = "La cantidad es obligatoria.";
    }
    lineErrors[index] = itemErrors;
  });

  if (lineErrors.some((item) => Object.keys(item).length > 0)) {
    errors.lineErrors = lineErrors;
    errors.lines = "Hay lineas con datos incompletos.";
  }

  return errors;
}

function countUnresolvedLines(rules: DrenchProgramRuleRecord[]) {
  return rules.reduce((accumulator, rule) => {
    return accumulator + rule.lines.filter((line) => !line.productId).length;
  }, 0);
}

export function CampoDrenchProgramPage({
  initialRules,
  initialAssignableProducts,
  initialSummary,
  initialError,
}: CampoDrenchProgramPageProps) {
  const [editorMode, setEditorMode] = useState<EditorMode>("create");
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(initialRules[0]?.ruleId ?? null);
  const [search, setSearch] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [formValues, setFormValues] = useState<DrenchProgramRuleInput>(EMPTY_FORM_VALUES);
  const [lineProductSearchValues, setLineProductSearchValues] = useState<string[]>([""]);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const deferredSearch = useDeferredValue(search);

  const { data: snapshot, isValidating, mutate } = useSWR(
    "/api/campo/administrar-maestros/programacion-drench",
    snapshotFetcher,
    {
      fallbackData: {
        rules: initialRules,
        assignableProducts: initialAssignableProducts,
      },
      revalidateOnFocus: false,
      dedupingInterval: 15000,
      onError: (error) => toast.error(error?.message || "No se pudo cargar la programacion de drench."),
    },
  );

  const rules = snapshot?.rules ?? initialRules;
  const assignableProducts = snapshot?.assignableProducts ?? initialAssignableProducts;

  const selectedRule = editorMode === "edit"
    ? rules.find((rule) => rule.ruleId === selectedRuleId) ?? null
    : null;

  const baselinePayload = useMemo(
    () => buildPayload(selectedRule ? mapRecordToFormValues(selectedRule) : EMPTY_FORM_VALUES),
    [selectedRule],
  );
  const currentPayload = useMemo(() => buildPayload(formValues), [formValues]);
  const isDirty = JSON.stringify(currentPayload) !== JSON.stringify(baselinePayload);

  const filteredRules = useMemo(() => {
    const normalized = deferredSearch.trim().toLowerCase();
    if (!normalized) return rules;

    return rules.filter((rule) => {
      return [
        rule.ruleCode,
        rule.varietyCode,
        rule.cycleType,
        String(rule.phenologicalWeek),
      ].some((value) => String(value ?? "").toLowerCase().includes(normalized));
    });
  }, [deferredSearch, rules]);

  const summary = useMemo(() => {
    const latest = [...rules]
      .filter((rule) => rule.loadedAt)
      .sort((left, right) => String(right.loadedAt).localeCompare(String(left.loadedAt)))[0] ?? null;

    return {
      rules: rules.length || initialSummary.rules,
      lines: rules.reduce((accumulator, rule) => accumulator + rule.lines.length, 0) || initialSummary.lines,
      products: assignableProducts.length,
      unresolvedLines: countUnresolvedLines(rules),
      latest,
    };
  }, [assignableProducts.length, initialSummary.lines, initialSummary.rules, rules]);

  useEffect(() => {
    const nextForm = selectedRule ? mapRecordToFormValues(selectedRule) : EMPTY_FORM_VALUES;
    setFormValues(nextForm);
    setLineProductSearchValues(
      nextForm.lines.map((line) => {
        if (!line.productId) {
          return line.sourceProductName ?? "";
        }
        const match = assignableProducts.find((product) => product.productId === line.productId);
        return match ? formatProductOption(match) : (line.sourceProductName ?? "");
      }),
    );
    setFormErrors({});
  }, [selectedRule, assignableProducts]);

  function updateField<Key extends keyof DrenchProgramRuleInput>(field: Key, value: DrenchProgramRuleInput[Key]) {
    setFormValues((current) => ({ ...current, [field]: value }));
    setFormErrors((current) => ({ ...current, [field]: undefined }));
  }

  function updateLine(index: number, patch: Partial<DrenchProgramLineInput>) {
    setFormValues((current) => ({
      ...current,
      lines: current.lines.map((line, lineIndex) => (
        lineIndex === index ? { ...line, ...patch } : line
      )),
    }));
    setFormErrors((current) => ({ ...current, lines: undefined }));
  }

  function updateLineSearch(index: number, value: string) {
    setLineProductSearchValues((current) => current.map((item, itemIndex) => itemIndex === index ? value : item));
    const match = findProductFromSearch(value, assignableProducts);
    if (match) {
      updateLine(index, {
        productId: match.productId,
        sourceProductName: match.productName,
        sourceProductCode: match.productCode,
        sourceUnitCode: match.baseUnitCode,
      });
      return;
    }

    updateLine(index, {
      productId: null,
      sourceProductName: value,
      sourceProductCode: formValues.lines[index]?.sourceProductCode ?? "",
      sourceUnitCode: formValues.lines[index]?.sourceUnitCode ?? "",
    });
  }

  function resolveLineSearch(index: number) {
    const currentValue = lineProductSearchValues[index] ?? "";
    const exactMatch = findProductFromSearch(currentValue, assignableProducts);

    if (exactMatch) {
      setLineProductSearchValues((current) => current.map((item, itemIndex) => itemIndex === index ? formatProductOption(exactMatch) : item));
      updateLine(index, {
        productId: exactMatch.productId,
        sourceProductName: exactMatch.productName,
        sourceProductCode: exactMatch.productCode,
        sourceUnitCode: exactMatch.baseUnitCode,
      });
      return;
    }

    const candidates = findProductCandidates(currentValue, assignableProducts);
    if (candidates.length === 1) {
      const candidate = candidates[0];
      setLineProductSearchValues((current) => current.map((item, itemIndex) => itemIndex === index ? formatProductOption(candidate) : item));
      updateLine(index, {
        productId: candidate.productId,
        sourceProductName: candidate.productName,
        sourceProductCode: candidate.productCode,
        sourceUnitCode: candidate.baseUnitCode,
      });
      return;
    }

    updateLine(index, {
      productId: null,
      sourceProductName: currentValue,
    });
  }

  function addLine() {
    setFormValues((current) => ({
      ...current,
      lines: [
        ...current.lines,
        {
          ...EMPTY_LINE,
          lineOrder: current.lines.length + 1,
          litersPerBed: current.lines[0]?.litersPerBed ?? 50,
          applicationMethod: current.lines[0]?.applicationMethod ?? "",
        },
      ],
    }));
    setLineProductSearchValues((current) => [...current, ""]);
  }

  function removeLine(index: number) {
    setFormValues((current) => ({
      ...current,
      lines: current.lines.filter((_, lineIndex) => lineIndex !== index),
    }));
    setLineProductSearchValues((current) => current.filter((_, lineIndex) => lineIndex !== index));
  }

  function openCreateMode() {
    startTransition(() => {
      setEditorMode("create");
      setSelectedRuleId(null);
    });
  }

  function openEditMode(ruleId: string) {
    startTransition(() => {
      setEditorMode("edit");
      setSelectedRuleId(ruleId);
    });
  }

  function resetForm() {
    const nextForm = selectedRule ? mapRecordToFormValues(selectedRule) : EMPTY_FORM_VALUES;
    setFormValues(nextForm);
    setLineProductSearchValues(
      nextForm.lines.map((line) => {
        if (!line.productId) return line.sourceProductName ?? "";
        const match = assignableProducts.find((product) => product.productId === line.productId);
        return match ? formatProductOption(match) : (line.sourceProductName ?? "");
      }),
    );
    setFormErrors({});
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextErrors = validateForm(formValues);
    setFormErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      toast.error("Revisa la semana, la variedad y las lineas antes de guardar.");
      return;
    }

    setIsSaving(true);
    try {
      const isEditing = editorMode === "edit" && selectedRuleId;
      const endpoint = isEditing
        ? `/api/campo/administrar-maestros/programacion-drench/${encodeURIComponent(selectedRuleId)}`
        : "/api/campo/administrar-maestros/programacion-drench";
      const method = isEditing ? "PATCH" : "POST";

      const response = await fetchJson<DrenchProgramRulePayload>(
        endpoint,
        "No se pudo guardar la regla de drench.",
        {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(currentPayload),
        },
      );

      toast.success(isEditing ? "Regla de drench actualizada." : "Regla de drench creada.");
      await mutate();
      startTransition(() => {
        setEditorMode("edit");
        setSelectedRuleId(response.data.ruleId);
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar la regla de drench.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <SectionPageShell
        eyebrow="Gestion / Campo / Administrar Maestros"
        title="Programacion Drench"
        subtitle="Reglas editables por semana fenologica, tipo de ciclo y variedad. Las lineas son abiertas y solo pueden vincular productos de Bodega marcados con la actividad FM11."
        icon={<Beaker className="size-5" aria-hidden="true" />}
        actions={(
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" className="rounded-full" onClick={() => void mutate()}>
              <RefreshCcw className={cn("size-4", isValidating && "animate-spin")} />
              Recargar
            </Button>
            <Button type="button" className="rounded-full" onClick={openCreateMode}>
              <Plus className="size-4" />
              Nueva regla
            </Button>
          </div>
        )}
      >
        <FilterPanel>
          <KpiGrid>
            <MetricTile label="Reglas vigentes" value={String(summary.rules)} hint="Claves activas semana + tipo + variedad." />
            <MetricTile label="Lineas vigentes" value={String(summary.lines)} hint="Total de lineas de aplicacion editables." />
            <MetricTile label="Productos FM11" value={String(summary.products)} hint="Productos de Bodega disponibles para Drench." />
            <MetricTile label="Lineas sin homologar" value={String(summary.unresolvedLines)} hint="Productos aun cargados solo como nombre fuente." />
            <MetricTile label="Ultima carga" value={summary.latest?.loadedAt ? formatDateTime(summary.latest.loadedAt) : "-"} hint="Ultima regla creada o actualizada." />
          </KpiGrid>

          {initialError ? (
            <div className="rounded-[24px] border border-slate-300/60 bg-slate-500/10 px-4 py-3 text-sm text-slate-950 dark:text-slate-100">
              {initialError}
            </div>
          ) : null}
        </FilterPanel>
      </SectionPageShell>

      <div className="grid gap-4 xl:grid-cols-[0.88fr_1.12fr]">
        <Card className="starter-panel border-border/70 bg-card/84">
          <CardHeader className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-slate-900/10 p-3 text-slate-700 dark:bg-slate-900/20 dark:text-white">
                <DatabaseZap className="size-5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <CardTitle className="text-lg">Reglas cargadas</CardTitle>
                <CardDescription>Selecciona una clave vigente o crea una nueva.</CardDescription>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="drench-rule-search">Buscar regla</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="drench-rule-search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar por semana, tipo o variedad..."
                  className="pl-10"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="relative overflow-hidden pt-1">
            <div className="max-h-[calc(100dvh-16rem)] space-y-3 overflow-y-auto pr-1 pb-6">
              {filteredRules.length ? filteredRules.map((rule) => {
                const isSelected = editorMode === "edit" && selectedRuleId === rule.ruleId;
                const unresolved = rule.lines.filter((line) => !line.productId).length;

                return (
                  <button
                    key={rule.ruleId}
                    type="button"
                    onClick={() => openEditMode(rule.ruleId)}
                    className={cn(
                      "w-full rounded-[24px] border px-5 py-4 text-left transition-colors",
                      isSelected
                        ? "border-slate-900 bg-slate-900 text-white shadow-lg shadow-slate-900/20"
                        : "border-border/70 bg-background/80 hover:border-slate-300 hover:bg-background",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-base font-semibold">{rule.ruleCode}</p>
                          <Badge
                            variant={isSelected ? "secondary" : "outline"}
                            className={cn("rounded-full px-3 py-1", isSelected && "border-white/20 bg-white/12 text-white")}
                          >
                            {rule.lines.length} lineas
                          </Badge>
                          {unresolved ? (
                            <Badge
                              variant={isSelected ? "secondary" : "outline"}
                              className={cn("rounded-full px-3 py-1", isSelected && "border-white/20 bg-white/12 text-white")}
                            >
                              {unresolved} pendientes
                            </Badge>
                          ) : null}
                        </div>
                        <p className={cn("text-sm font-medium", isSelected ? "text-white/90" : "text-foreground")}>
                          Semana {rule.phenologicalWeek} · {rule.cycleType} · {rule.varietyCode}
                        </p>
                        <p className={cn("text-xs", isSelected ? "text-white/75" : "text-muted-foreground")}>
                          Actividad fija: {rule.activityId}
                        </p>
                      </div>
                      <PencilLine className={cn("size-4 shrink-0", isSelected ? "text-white" : "text-muted-foreground")} />
                    </div>
                  </button>
                );
              }) : (
                <div className="rounded-[24px] border border-dashed border-border/70 bg-background/80 px-4 py-8 text-center text-sm text-muted-foreground">
                  No hay reglas que coincidan con el filtro actual.
                </div>
              )}
            </div>
            <div className="pointer-events-none absolute inset-x-6 bottom-0 h-12 rounded-b-[24px] bg-gradient-to-t from-card via-card/96 to-transparent" />
          </CardContent>
        </Card>

        <Card className="starter-panel border-border/70 bg-card/84 xl:sticky xl:top-4 xl:self-start">
          <CardHeader className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="rounded-full px-3 py-1">
                    {editorMode === "edit" ? "Editar regla vigente" : "Nueva regla"}
                  </Badge>
                      <Badge variant="secondary" className="rounded-full px-3 py-1">
                    Actividad fija {DRENCH_PROGRAM_ACTIVITY_ID}
                  </Badge>
                </div>
                <div>
                  <CardTitle className="text-lg">
                    {selectedRule ? selectedRule.ruleCode : "Registrar regla de drench"}
                  </CardTitle>
                  <CardDescription>
                    La clave se construye con semana fenologica + tipo de ciclo + variedad.
                  </CardDescription>
                </div>
              </div>
              <div className="rounded-full bg-slate-900/10 p-3 text-slate-700 dark:bg-slate-900/20 dark:text-white">
                <Beaker className="size-5" aria-hidden="true" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form className="space-y-6" onSubmit={onSubmit}>
              <div className="grid gap-5 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="drench-week">Semana fenologica</Label>
                  <Input
                    id="drench-week"
                    type="number"
                    min={1}
                    className="rounded-xl"
                    value={formValues.phenologicalWeek}
                    onChange={(event) => updateField("phenologicalWeek", Number(event.target.value))}
                  />
                  {formErrors.phenologicalWeek ? <p className="text-xs text-destructive">{formErrors.phenologicalWeek}</p> : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="drench-cycle-type">Tipo de ciclo</Label>
                  <select
                    id="drench-cycle-type"
                    className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                    value={formValues.cycleType}
                    onChange={(event) => updateField("cycleType", event.target.value as DrenchProgramRuleInput["cycleType"])}
                  >
                    <option value="S">Siembra (S)</option>
                    <option value="P">Poda (P)</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="drench-variety">Variedad</Label>
                  <Input
                    id="drench-variety"
                    className="rounded-xl"
                    value={formValues.varietyCode}
                    onChange={(event) => updateField("varietyCode", event.target.value.toUpperCase())}
                    placeholder="Ej. CLO, XL, AND"
                  />
                  {formErrors.varietyCode ? <p className="text-xs text-destructive">{formErrors.varietyCode}</p> : null}
                </div>

                <div className="space-y-2 md:col-span-3">
                  <Label>Clave resultante</Label>
                  <div className="rounded-[18px] border border-border/70 bg-background/75 px-4 py-3 text-sm font-medium">
                    {buildRuleCode(formValues)}
                  </div>
                </div>

                <div className="space-y-2 md:col-span-3">
                  <Label htmlFor="drench-notes">Notas de la regla</Label>
                  <textarea
                    id="drench-notes"
                    rows={3}
                    className="flex min-h-[96px] w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                    value={formValues.notes ?? ""}
                    onChange={(event) => updateField("notes", event.target.value)}
                    placeholder="Opcional. Ej. ajuste de dosis para revision operativa."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="drench-status">Estado</Label>
                  <select
                    id="drench-status"
                    className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                    value={formValues.isActive ? "active" : "inactive"}
                    onChange={(event) => updateField("isActive", event.target.value === "active")}
                  >
                    <option value="active">Activa</option>
                    <option value="inactive">Inactiva</option>
                  </select>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="drench-reason">Motivo de cambio</Label>
                  <Input
                    id="drench-reason"
                    className="rounded-xl"
                    value={formValues.changeReason ?? ""}
                    onChange={(event) => updateField("changeReason", event.target.value)}
                    placeholder="Opcional. Ej. ajuste operativo de semana 5."
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <Label>Lineas de aplicacion</Label>
                    <p className="text-xs text-muted-foreground">
                      Puedes agregar todas las lineas que necesites. Solo salen productos de Bodega asignados a FM11.
                    </p>
                  </div>
                  <Button type="button" variant="outline" className="rounded-full" onClick={addLine}>
                    <Plus className="size-4" />
                    Agregar linea
                  </Button>
                </div>

                <div className="space-y-4">
                  {formValues.lines.map((line, index) => {
                    const selectedProduct = line.productId
                      ? assignableProducts.find((product) => product.productId === line.productId) ?? null
                      : null;

                    return (
                      <div
                        key={`line-${index}`}
                        className="rounded-[22px] border border-dashed border-border/70 bg-background/70 p-4"
                      >
                        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="rounded-full px-3 py-1">
                              Linea {index + 1}
                            </Badge>
                            {selectedProduct ? (
                              <Badge variant="secondary" className="rounded-full px-3 py-1">
                                {selectedProduct.baseUnitCode}
                              </Badge>
                            ) : null}
                          </div>
                          <Button type="button" variant="outline" className="rounded-full" onClick={() => removeLine(index)}>
                            <Trash2 className="size-4" />
                            Quitar
                          </Button>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                          <div className="space-y-2">
                            <Label htmlFor={`line-method-${index}`}>Metodo</Label>
                            <Input
                              id={`line-method-${index}`}
                              className="rounded-xl"
                              value={line.applicationMethod ?? ""}
                              onChange={(event) => updateLine(index, { applicationMethod: event.target.value })}
                              placeholder="Ej. BOMBA"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor={`line-liters-${index}`}>Litros por cama</Label>
                            <Input
                              id={`line-liters-${index}`}
                              type="number"
                              step="0.01"
                              className="rounded-xl"
                              value={line.litersPerBed ?? ""}
                              onChange={(event) => updateLine(index, { litersPerBed: event.target.value === "" ? null : Number(event.target.value) })}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor={`line-quantity-${index}`}>Cantidad</Label>
                            <Input
                              id={`line-quantity-${index}`}
                              type="number"
                              step="0.0001"
                              className="rounded-xl"
                              value={line.quantityValue ?? ""}
                              onChange={(event) => updateLine(index, { quantityValue: event.target.value === "" ? null : Number(event.target.value) })}
                            />
                            {formErrors.lineErrors?.[index]?.quantityValue ? (
                              <p className="text-xs text-destructive">{formErrors.lineErrors[index]?.quantityValue}</p>
                            ) : null}
                          </div>

                          <div className="space-y-2 md:col-span-2 xl:col-span-2">
                            <Label htmlFor={`line-product-${index}`}>Producto Bodega o nombre fuente</Label>
                            <Input
                              id={`line-product-${index}`}
                              list={`drench-product-options-${index}`}
                              className="rounded-xl"
                              value={lineProductSearchValues[index] ?? ""}
                              onChange={(event) => updateLineSearch(index, event.target.value)}
                              onBlur={() => resolveLineSearch(index)}
                              placeholder="Busca por codigo o nombre. Si no existe aun, deja el nombre fuente."
                            />
                            <datalist id={`drench-product-options-${index}`}>
                              {assignableProducts.map((product) => (
                                <option key={`${product.productId}-fmt`} value={formatProductOption(product)} />
                              ))}
                              {assignableProducts.map((product) => (
                                <option key={`${product.productId}-code`} value={product.productCode} />
                              ))}
                              {assignableProducts.map((product) => (
                                <option key={`${product.productId}-name`} value={product.productName} />
                              ))}
                            </datalist>
                            {formErrors.lineErrors?.[index]?.sourceProductName ? (
                              <p className="text-xs text-destructive">{formErrors.lineErrors[index]?.sourceProductName}</p>
                            ) : null}
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor={`line-unit-${index}`}>Unidad referencia</Label>
                            <Input
                              id={`line-unit-${index}`}
                              className="rounded-xl"
                              value={line.sourceUnitCode ?? ""}
                              onChange={(event) => updateLine(index, { sourceUnitCode: event.target.value.toUpperCase() })}
                              placeholder="Ej. CC, GR, LT"
                            />
                          </div>

                          <div className="space-y-2 md:col-span-2">
                            <Label htmlFor={`line-reference-${index}`}>Referencia de dosis</Label>
                            <Input
                              id={`line-reference-${index}`}
                              className="rounded-xl"
                              value={line.quantityReference ?? ""}
                              onChange={(event) => updateLine(index, { quantityReference: event.target.value })}
                              placeholder="Ej. Cantidad por litro o nota de uso."
                            />
                          </div>

                          <div className="space-y-2 md:col-span-2 xl:col-span-3">
                            <Label htmlFor={`line-notes-${index}`}>Notas de linea</Label>
                            <Input
                              id={`line-notes-${index}`}
                              className="rounded-xl"
                              value={line.notes ?? ""}
                              onChange={(event) => updateLine(index, { notes: event.target.value })}
                              placeholder="Opcional. Ej. producto pendiente de homologacion."
                            />
                          </div>
                        </div>

                        <div className="mt-3 rounded-[16px] bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                          {selectedProduct ? (
                    <>Vinculado a Bodega: {selectedProduct.productCode} / {selectedProduct.productName} / {selectedProduct.categoryPathLabel}</>
                          ) : (
                            <>Linea aun no homologada a Bodega. Se guardara con nombre fuente para resolverla despues.</>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {formErrors.lines ? <p className="text-xs text-destructive">{formErrors.lines}</p> : null}
              </div>

              <div className="rounded-[22px] border border-border/70 bg-background/75 px-4 py-4 text-sm">
                <p className="font-semibold">Resumen de regla</p>
                <div className="mt-3 space-y-2 text-muted-foreground">
                  <p>Clave: {buildRuleCode(formValues)}</p>
                  <p>Actividad vinculada: {DRENCH_PROGRAM_ACTIVITY_ID}</p>
                <p>Lineas registradas: {formValues.lines.length}</p>
                  <p>Lineas homologadas: {currentPayload.lines.filter((line) => Boolean(line.productId)).length}</p>
                </div>
              </div>

              <div className="flex flex-wrap justify-end gap-2">
                <Button type="button" variant="outline" className="rounded-full" onClick={resetForm} disabled={!isDirty || isSaving}>
                  Restablecer
                </Button>
                <Button type="submit" className="rounded-full" disabled={isSaving}>
                  {isSaving ? (
                    <>Guardando...</>
                  ) : (
                    <>
                      <Save className="size-4" />
                      Guardar regla
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
