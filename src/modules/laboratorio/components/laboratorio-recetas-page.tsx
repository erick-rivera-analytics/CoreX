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

import { fetchJson } from "@/lib/fetch-json";
import type {
  BodegaActivityRecord,
  BodegaProductRecord,
  BodegaUnitRecord,
} from "@/lib/bodega-master-types";
import type {
  LaboratoryCategoryRecord,
  LaboratoryProductInput,
  LaboratoryProductPayload,
  LaboratoryProductRecord,
  LaboratoryRecipeLineInput,
} from "@/lib/laboratory-master-types";
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

type LaboratorioRecetasPageProps = {
  initialProducts: LaboratoryProductRecord[];
  initialBodegaProducts: BodegaProductRecord[];
  initialUnits: BodegaUnitRecord[];
  initialCategories: LaboratoryCategoryRecord[];
  initialActivities: BodegaActivityRecord[];
  initialError?: string | null;
};

type EditorMode = "create" | "edit";
type FormErrors = Partial<Record<Exclude<keyof LaboratoryProductInput, "assignments" | "recipeLines">, string>> & {
  assignments?: string;
  recipeLines?: string;
  recipeLineErrors?: Array<{
    ingredientProductId?: string;
    ingredientQuantityValue?: string;
  }>;
};

const MAX_ASSIGNMENT_BRANCHES = 12;

const EMPTY_RECIPE_LINE: LaboratoryRecipeLineInput = {
  ingredientProductId: "",
  ingredientQuantityValue: null,
  ingredientQuantityReference: "",
  notes: "",
  isActive: true,
};

function makeEmptyFormValues(): LaboratoryProductInput {
  return {
    productCode: "",
    productName: "",
    description: "",
    categoryId: "",
    baseUnitId: "",
    isActive: true,
    assignments: [{ _formKey: crypto.randomUUID(), activityId: "", branchOrder: 1 }],
    recipeLines: [{ ...EMPTY_RECIPE_LINE, _formKey: crypto.randomUUID() }],
    changeReason: "",
  };
}

const productsFetcher = (url: string) =>
  fetchJson<LaboratoryProductRecord[]>(url, "No se pudo cargar el maestro de productos de Laboratorio.");

function formatActivityOption(activity: BodegaActivityRecord) {
  const hierarchy = [activity.costArea, activity.subCostCenter].filter(Boolean).join(" / ");
  const base = activity.activityName === activity.activityId
    ? activity.activityId
    : `${activity.activityId} · ${activity.activityName}`;
  return hierarchy ? `${base} · ${hierarchy}` : base;
}

function findActivityFromSearch(value: string, activities: BodegaActivityRecord[]) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;

  return activities.find((activity) =>
    [activity.activityId, activity.activityName, formatActivityOption(activity)]
      .some((candidate) => candidate.trim().toLowerCase() === normalized),
  ) ?? null;
}

function findActivityCandidates(value: string, activities: BodegaActivityRecord[]) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return [];

  return activities.filter((activity) =>
    [activity.activityId, activity.activityName, formatActivityOption(activity)]
      .some((candidate) => candidate.trim().toLowerCase().includes(normalized)),
  );
}

function formatBodegaProductOption(product: BodegaProductRecord) {
  return `${product.productCode} - ${product.productName}`;
}

function findBodegaProductFromSearch(value: string, products: BodegaProductRecord[]) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;

  return products.find((product) =>
    [product.productCode, product.productName, formatBodegaProductOption(product)]
      .some((candidate) => candidate.trim().toLowerCase() === normalized),
  ) ?? null;
}

function findBodegaProductCandidates(value: string, products: BodegaProductRecord[]) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return [];

  return products.filter((product) =>
    [product.productCode, product.productName, formatBodegaProductOption(product)]
      .some((candidate) => candidate.trim().toLowerCase().includes(normalized)),
  );
}

function mapRecordToFormValues(record: LaboratoryProductRecord): LaboratoryProductInput {
  return {
    productCode: record.productCode,
    productName: record.productName,
    description: record.description ?? "",
    categoryId: record.categoryId,
    baseUnitId: record.baseUnitId,
    isActive: record.isActive,
    assignments: record.assignments.map((assignment) => ({
      _formKey: crypto.randomUUID(),
      activityId: assignment.activityId,
      branchOrder: assignment.branchOrder,
    })),
    recipeLines: record.recipeLines.map((line) => ({
      _formKey: crypto.randomUUID(),
      lineOrder: line.lineOrder,
      ingredientProductId: line.ingredientProductId,
      ingredientQuantityValue: line.ingredientQuantityValue,
      ingredientQuantityReference: line.ingredientQuantityReference ?? "",
      notes: line.notes ?? "",
      isActive: line.isActive,
    })),
    changeReason: "",
  };
}

function buildPayload(values: LaboratoryProductInput): LaboratoryProductInput {
  return {
    productCode: values.productCode.trim().toUpperCase(),
    productName: values.productName.trim(),
    description: values.description?.trim() || null,
    categoryId: values.categoryId.trim(),
    baseUnitId: values.baseUnitId.trim(),
    isActive: values.isActive,
    assignments: values.assignments
      .map((assignment, index) => ({
        activityId: assignment.activityId.trim().toUpperCase(),
        branchOrder: index + 1,
      }))
      .filter((assignment) => assignment.activityId),
    recipeLines: values.recipeLines.map((line, index) => ({
      lineOrder: index + 1,
      ingredientProductId: line.ingredientProductId?.trim() || null,
      ingredientQuantityValue: line.ingredientQuantityValue === null || line.ingredientQuantityValue === undefined
        ? null
        : Number(line.ingredientQuantityValue),
      ingredientQuantityReference: line.ingredientQuantityReference?.trim() || null,
      notes: line.notes?.trim() || null,
      isActive: line.isActive ?? true,
    })),
    changeReason: values.changeReason?.trim() || null,
  };
}

function validateForm(
  values: LaboratoryProductInput,
  categories: LaboratoryCategoryRecord[],
  activities: BodegaActivityRecord[],
  bodegaProducts: BodegaProductRecord[],
): FormErrors {
  const payload = buildPayload(values);
  const errors: FormErrors = {};
  const rawAssignmentCount = values.assignments.filter((assignment) => assignment.activityId.trim()).length;

  if (!payload.productCode) errors.productCode = "El codigo es obligatorio.";
  if (!payload.productName) errors.productName = "El nombre es obligatorio.";
  if (!payload.categoryId) errors.categoryId = "El tipo es obligatorio.";
  if (payload.categoryId && !categories.some((category) => category.categoryId === payload.categoryId && category.isActive)) {
    errors.categoryId = "El tipo seleccionado ya no existe.";
  }
  if (!payload.baseUnitId) errors.baseUnitId = "La unidad base es obligatoria.";
  if (payload.assignments.length !== rawAssignmentCount) {
    errors.assignments = "Cada rama debe quedar vinculada a una actividad valida.";
  } else if (payload.assignments.some((assignment) => !activities.some((activity) => activity.activityId === assignment.activityId))) {
    errors.assignments = "Hay actividades seleccionadas que ya no existen en la fuente.";
  }

  const lineErrors: NonNullable<FormErrors["recipeLineErrors"]> = [];
  payload.recipeLines.forEach((line, index) => {
    const itemErrors: NonNullable<FormErrors["recipeLineErrors"]>[number] = {};
    if (!line.ingredientProductId || !bodegaProducts.some((product) => product.productId === line.ingredientProductId)) {
      itemErrors.ingredientProductId = "Debes seleccionar un insumo valido de Bodega.";
    }
    if (line.ingredientQuantityValue === null || Number.isNaN(line.ingredientQuantityValue)) {
      itemErrors.ingredientQuantityValue = "La cantidad del insumo es obligatoria.";
    }
    lineErrors[index] = itemErrors;
  });

  if (lineErrors.some((item) => Object.keys(item).length > 0)) {
    errors.recipeLines = "Hay lineas de receta incompletas.";
    errors.recipeLineErrors = lineErrors;
  }

  return errors;
}

export function LaboratorioRecetasPage({
  initialProducts,
  initialBodegaProducts,
  initialUnits,
  initialCategories,
  initialActivities,
  initialError,
}: LaboratorioRecetasPageProps) {
  const [editorMode, setEditorMode] = useState<EditorMode>("create");
  const [selectedProductId, setSelectedProductId] = useState<string | null>(initialProducts[0]?.laboratoryProductId ?? null);
  const [search, setSearch] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [formValues, setFormValues] = useState<LaboratoryProductInput>(makeEmptyFormValues);
  const [activitySearchValues, setActivitySearchValues] = useState<string[]>([""]);
  const [ingredientSearchValues, setIngredientSearchValues] = useState<string[]>([""]);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const deferredSearch = useDeferredValue(search);

  const { data: productsData, isValidating, mutate } = useSWR(
    "/api/laboratorio/administrar-maestros/receta-productos",
    productsFetcher,
    {
      fallbackData: initialProducts,
      revalidateOnFocus: false,
      dedupingInterval: 15000,
      onError: (error) => toast.error(error?.message || "No se pudo cargar Laboratorio."),
    },
  );

  const products = productsData ?? initialProducts;
  const units = initialUnits;
  const categories = initialCategories;
  const activities = initialActivities;
  const bodegaProducts = initialBodegaProducts;

  const selectedRecord = editorMode === "edit"
    ? products.find((record) => record.laboratoryProductId === selectedProductId) ?? null
    : null;
  const baselinePayload = useMemo(
    () => buildPayload(selectedRecord ? mapRecordToFormValues(selectedRecord) : makeEmptyFormValues()),
    [selectedRecord],
  );
  const currentPayload = useMemo(() => buildPayload(formValues), [formValues]);
  const isDirty = JSON.stringify(currentPayload) !== JSON.stringify(baselinePayload);

  const filteredRecords = useMemo(() => {
    const normalized = deferredSearch.trim().toLowerCase();
    if (!normalized) return products;

    return products.filter((record) =>
      [record.productCode, record.productName, ...record.assignments.map((assignment) => assignment.activityId)]
        .some((value) => String(value ?? "").toLowerCase().includes(normalized)),
    );
  }, [deferredSearch, products]);

  const summary = useMemo(() => {
    const latest = products.reduce<(typeof products)[number] | null>(
      (best, product) => {
        if (!product.loadedAt) return best;
        if (!best || String(product.loadedAt) > String(best.loadedAt)) return product;
        return best;
      },
      null,
    );

    return {
      products: products.length,
      lines: products.reduce((accumulator, product) => accumulator + product.recipeLines.length, 0),
      activities: new Set(products.flatMap((product) => product.assignments.map((assignment) => assignment.activityId))).size,
      latest,
    };
  }, [products]);

  useEffect(() => {
    if (!selectedProductId || !products.some((record) => record.laboratoryProductId === selectedProductId)) {
      setSelectedProductId(products[0]?.laboratoryProductId ?? null);
    }
  }, [products, selectedProductId]);

  useEffect(() => {
    const nextForm = selectedRecord ? mapRecordToFormValues(selectedRecord) : makeEmptyFormValues();
    if (!selectedRecord && !nextForm.categoryId && categories[0]?.categoryId) {
      nextForm.categoryId = categories[0].categoryId;
    }
    setFormValues(nextForm);
    setActivitySearchValues(nextForm.assignments.map((assignment) => {
      const match = activities.find((activity) => activity.activityId === assignment.activityId);
      return match ? formatActivityOption(match) : assignment.activityId;
    }));
    setIngredientSearchValues(nextForm.recipeLines.map((line) => {
      const match = bodegaProducts.find((product) => product.productId === line.ingredientProductId);
      return match ? formatBodegaProductOption(match) : "";
    }));
    setFormErrors({});
  }, [selectedRecord, activities, bodegaProducts, categories]);

  function updateField<Key extends keyof LaboratoryProductInput>(field: Key, value: LaboratoryProductInput[Key]) {
    setFormValues((current) => ({ ...current, [field]: value }));
    setFormErrors((current) => ({ ...current, [field]: undefined }));
  }

  function updateAssignment(index: number, patch: Partial<LaboratoryProductInput["assignments"][number]>) {
    setFormValues((current) => ({
      ...current,
      assignments: current.assignments.map((assignment, assignmentIndex) => (
        assignmentIndex === index ? { ...assignment, ...patch } : assignment
      )),
    }));
    setFormErrors((current) => ({ ...current, assignments: undefined }));
  }

  function updateAssignmentSearch(index: number, value: string) {
    setActivitySearchValues((current) => current.map((item, itemIndex) => itemIndex === index ? value : item));
    const match = findActivityFromSearch(value, activities);

    if (match) {
      updateAssignment(index, { activityId: match.activityId });
      return;
    }

    updateAssignment(index, { activityId: value });
  }

  function resolveAssignmentSearch(index: number) {
    const value = activitySearchValues[index] ?? "";
    const exactMatch = findActivityFromSearch(value, activities);
    if (exactMatch) {
      setActivitySearchValues((current) => current.map((item, itemIndex) => itemIndex === index ? formatActivityOption(exactMatch) : item));
      updateAssignment(index, { activityId: exactMatch.activityId });
      return;
    }

    const candidates = findActivityCandidates(value, activities);
    if (candidates.length === 1) {
      const candidate = candidates[0];
      setActivitySearchValues((current) => current.map((item, itemIndex) => itemIndex === index ? formatActivityOption(candidate) : item));
      updateAssignment(index, { activityId: candidate.activityId });
    }
  }

  function addAssignment() {
    if (formValues.assignments.length >= MAX_ASSIGNMENT_BRANCHES) {
      toast.error(`Puedes registrar hasta ${MAX_ASSIGNMENT_BRANCHES} ramas por producto.`);
      return;
    }

    setFormValues((current) => ({
      ...current,
      assignments: [...current.assignments, { _formKey: crypto.randomUUID(), activityId: "", branchOrder: current.assignments.length + 1 }],
    }));
    setActivitySearchValues((current) => [...current, ""]);
  }

  function removeAssignment(index: number) {
    if (formValues.assignments.length === 1) {
      updateAssignment(index, { activityId: "" });
      setActivitySearchValues([""]);
      return;
    }

    setFormValues((current) => ({
      ...current,
      assignments: current.assignments.filter((_, assignmentIndex) => assignmentIndex !== index),
    }));
    setActivitySearchValues((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  function updateRecipeLine(index: number, patch: Partial<LaboratoryRecipeLineInput>) {
    setFormValues((current) => ({
      ...current,
      recipeLines: current.recipeLines.map((line, lineIndex) => (
        lineIndex === index ? { ...line, ...patch } : line
      )),
    }));
    setFormErrors((current) => ({ ...current, recipeLines: undefined }));
  }

  function updateIngredientSearch(index: number, value: string) {
    setIngredientSearchValues((current) => current.map((item, itemIndex) => itemIndex === index ? value : item));
    const match = findBodegaProductFromSearch(value, bodegaProducts);
    if (match) {
      updateRecipeLine(index, { ingredientProductId: match.productId });
      return;
    }
    updateRecipeLine(index, { ingredientProductId: "" });
  }

  function resolveIngredientSearch(index: number) {
    const value = ingredientSearchValues[index] ?? "";
    const exactMatch = findBodegaProductFromSearch(value, bodegaProducts);
    if (exactMatch) {
      setIngredientSearchValues((current) => current.map((item, itemIndex) => itemIndex === index ? formatBodegaProductOption(exactMatch) : item));
      updateRecipeLine(index, { ingredientProductId: exactMatch.productId });
      return;
    }

    const candidates = findBodegaProductCandidates(value, bodegaProducts);
    if (candidates.length === 1) {
      const candidate = candidates[0];
      setIngredientSearchValues((current) => current.map((item, itemIndex) => itemIndex === index ? formatBodegaProductOption(candidate) : item));
      updateRecipeLine(index, { ingredientProductId: candidate.productId });
    }
  }

  function addRecipeLine() {
    setFormValues((current) => ({
      ...current,
      recipeLines: [...current.recipeLines, { ...EMPTY_RECIPE_LINE, _formKey: crypto.randomUUID() }],
    }));
    setIngredientSearchValues((current) => [...current, ""]);
  }

  function removeRecipeLine(index: number) {
    if (formValues.recipeLines.length === 1) {
      setFormValues((current) => ({ ...current, recipeLines: [{ ...EMPTY_RECIPE_LINE, _formKey: crypto.randomUUID() }] }));
      setIngredientSearchValues([""]);
      return;
    }

    setFormValues((current) => ({
      ...current,
      recipeLines: current.recipeLines.filter((_, lineIndex) => lineIndex !== index),
    }));
    setIngredientSearchValues((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  function openCreateMode() {
    setEditorMode("create");
    setSelectedProductId(null);
    setFormValues({
      ...makeEmptyFormValues(),
      categoryId: categories[0]?.categoryId ?? "",
    });
    setActivitySearchValues([""]);
    setIngredientSearchValues([""]);
    setFormErrors({});
  }

  function resetForm() {
    const nextForm = selectedRecord ? mapRecordToFormValues(selectedRecord) : makeEmptyFormValues();
    setFormValues(nextForm);
    setActivitySearchValues(nextForm.assignments.map((assignment) => {
      const match = activities.find((activity) => activity.activityId === assignment.activityId);
      return match ? formatActivityOption(match) : assignment.activityId;
    }));
    setIngredientSearchValues(nextForm.recipeLines.map((line) => {
      const match = bodegaProducts.find((product) => product.productId === line.ingredientProductId);
      return match ? formatBodegaProductOption(match) : "";
    }));
    setFormErrors({});
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validateForm(formValues, categories, activities, bodegaProducts);
    if (Object.keys(nextErrors).length > 0) {
      setFormErrors(nextErrors);
      toast.error("Completa los campos obligatorios antes de guardar.");
      return;
    }

    setIsSaving(true);
    try {
      const payload = buildPayload(formValues);
      const endpoint = editorMode === "edit" && selectedRecord
        ? `/api/laboratorio/administrar-maestros/receta-productos/${encodeURIComponent(selectedRecord.laboratoryProductId)}`
        : "/api/laboratorio/administrar-maestros/receta-productos";
      const method = editorMode === "edit" && selectedRecord ? "PATCH" : "POST";

      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json().catch(() => null) as LaboratoryProductPayload | { message?: string } | null;
      if (!response.ok) {
        throw new Error(body && "message" in body && body.message ? body.message : "No se pudo guardar el producto de Laboratorio.");
      }

      const saved = body && "data" in body ? body.data : null;
      toast.success(editorMode === "edit" ? "Producto de Laboratorio actualizado." : "Producto de Laboratorio creado.");
      await mutate();
      startTransition(() => {
        if (saved?.laboratoryProductId) {
          setEditorMode("edit");
          setSelectedProductId(saved.laboratoryProductId);
        } else {
          setEditorMode("create");
          setSelectedProductId(null);
        }
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar el producto de Laboratorio.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <SectionPageShell
      eyebrow="Gestion / Laboratorio / Administrar Maestros"
      title="Receta de productos"
      subtitle="Productos nacidos en Laboratorio, con receta propia de insumos y luego vinculados a actividades como FM11."
      icon={<Beaker className="size-5" aria-hidden="true" />}
      actions={(
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" className="rounded-full" onClick={() => void mutate()}>
            <RefreshCcw className={cn("size-4", isValidating && "animate-spin")} />
            Recargar
          </Button>
        </div>
      )}
    >
      <FilterPanel>
        <KpiGrid>
          <MetricTile label="Productos laboratorio" value={String(summary.products)} hint="Productos internos administrados por receta." />
          <MetricTile label="Lineas de receta" value={String(summary.lines)} hint="Insumos de Bodega registrados dentro de las recetas." />
          <MetricTile label="Actividades vinculadas" value={String(summary.activities)} hint="Actividades operativas donde puede usarse el producto de Laboratorio." />
          <MetricTile label="Ultima actualizacion" value={summary.latest?.loadedAt ? formatDateTime(summary.latest.loadedAt) : "-"} hint="Ultimo producto creado o editado." />
        </KpiGrid>

        {initialError ? (
          <div className="rounded-[24px] border border-slate-300/60 bg-slate-500/10 px-4 py-3 text-sm text-slate-950 dark:text-slate-100">
            {initialError}
          </div>
        ) : null}
      </FilterPanel>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_1.95fr]">
        <Card className="border-border/70 bg-background/80 shadow-sm">
          <CardHeader className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="text-lg">Productos de Laboratorio</CardTitle>
                <CardDescription>Los productos aqui creados podran vincularse a FM11 y quedar disponibles en Drench.</CardDescription>
              </div>
              <Button type="button" variant="outline" className="rounded-full" onClick={openCreateMode}>
                <Plus className="size-4" />
                Nuevo producto
              </Button>
            </div>
            <div className="space-y-2">
              <Label htmlFor="laboratory-product-search">Buscar producto</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="laboratory-product-search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Busca por codigo, nombre o actividad..."
                  className="rounded-xl pl-10"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {filteredRecords.length ? filteredRecords.map((record) => {
              const isSelected = editorMode === "edit" && selectedProductId === record.laboratoryProductId;
              return (
                <button
                  key={record.laboratoryProductId}
                  type="button"
                  onClick={() => {
                    setEditorMode("edit");
                    setSelectedProductId(record.laboratoryProductId);
                  }}
                  className={cn(
                    "flex w-full items-start justify-between rounded-[24px] border px-4 py-4 text-left transition",
                    isSelected
                      ? "border-slate-900 bg-slate-900 text-white shadow-lg shadow-slate-900/15"
                      : "border-border/70 bg-background/80 hover:border-slate-300 hover:bg-background",
                  )}
                >
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold">{record.productCode}</span>
                      <Badge variant={record.isActive ? "secondary" : "outline"} className={cn("rounded-full", isSelected && "bg-white/10 text-white")}>
                        {record.baseUnitCode}
                      </Badge>
                    </div>
                    <p className="text-sm font-medium">{record.productName}</p>
                    <p className={cn("text-xs", isSelected ? "text-white/75" : "text-muted-foreground")}>
                    {record.recipeLines.length} lineas de receta · {record.assignments.map((assignment) => assignment.activityId).join(" · ") || "Sin actividades"}
                    </p>
                  </div>
                  <PencilLine className={cn("size-4 shrink-0", isSelected ? "text-white" : "text-muted-foreground")} />
                </button>
              );
            }) : (
              <div className="rounded-[24px] border border-dashed border-border/70 bg-background/70 px-4 py-8 text-sm text-muted-foreground">
                No hay productos de Laboratorio para mostrar.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-background/80 shadow-sm">
          <CardHeader className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-slate-900/10 p-3 text-slate-700 dark:bg-slate-900/20 dark:text-white">
                  <DatabaseZap className="size-5" aria-hidden="true" />
                </div>
                <div>
                  <CardTitle className="text-lg">
                    {editorMode === "edit" && selectedRecord ? "Editar producto y receta" : "Registrar producto y receta"}
                  </CardTitle>
                  <CardDescription>
                    Primero defines el producto final y su receta de insumos. Despues eliges en que actividades, como FM11, puede usarse.
                  </CardDescription>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form className="space-y-6" onSubmit={onSubmit}>
              <div className="space-y-4">
                <div>
                  <Label>1. Datos del producto</Label>
                  <p className="text-xs text-muted-foreground">
                    Primero defines el producto final de Laboratorio, su tipo y la unidad base con la que quedara registrado.
                  </p>
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="laboratory-product-code">Codigo laboratorio</Label>
                  <Input
                    id="laboratory-product-code"
                    className="rounded-xl"
                    value={formValues.productCode}
                    onChange={(event) => updateField("productCode", event.target.value.toUpperCase())}
                    placeholder="Ej. FB999"
                  />
                  {formErrors.productCode ? <p className="text-xs text-destructive">{formErrors.productCode}</p> : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="laboratory-category">Tipo</Label>
                  <select
                    id="laboratory-category"
                    className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                    value={formValues.categoryId}
                    onChange={(event) => updateField("categoryId", event.target.value)}
                  >
                    <option value="">Selecciona un tipo</option>
                    {categories.map((category) => (
                      <option key={category.categoryId} value={category.categoryId}>
                        {category.categoryName}
                      </option>
                    ))}
                  </select>
                  {formErrors.categoryId ? <p className="text-xs text-destructive">{formErrors.categoryId}</p> : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="laboratory-base-unit">Unidad base</Label>
                  <select
                    id="laboratory-base-unit"
                    className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                    value={formValues.baseUnitId}
                    onChange={(event) => updateField("baseUnitId", event.target.value)}
                  >
                    <option value="">Selecciona una unidad</option>
                    {units.map((unit) => (
                      <option key={unit.unitId} value={unit.unitId}>
                        {unit.code} · {unit.name}
                      </option>
                    ))}
                  </select>
                  {formErrors.baseUnitId ? <p className="text-xs text-destructive">{formErrors.baseUnitId}</p> : null}
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="laboratory-product-name">Nombre del producto</Label>
                  <Input
                    id="laboratory-product-name"
                    className="rounded-xl"
                    value={formValues.productName}
                    onChange={(event) => updateField("productName", event.target.value)}
                    placeholder="Ej. TRICHODERMA"
                  />
                  {formErrors.productName ? <p className="text-xs text-destructive">{formErrors.productName}</p> : null}
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="laboratory-description">Descripcion</Label>
                  <Input
                    id="laboratory-description"
                    className="rounded-xl"
                    value={formValues.description ?? ""}
                    onChange={(event) => updateField("description", event.target.value)}
                    placeholder="Opcional"
                  />
                </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <Label>2. Receta del producto</Label>
                    <p className="text-xs text-muted-foreground">
                      Aqui armas la receta especifica del producto, por ejemplo Trichoderma, usando insumos provenientes de Bodega.
                    </p>
                  </div>
                  <Button type="button" variant="outline" className="rounded-full" onClick={addRecipeLine}>
                    <Plus className="size-4" />
                    Agregar insumo
                  </Button>
                </div>

                <div className="space-y-4">
                  {formValues.recipeLines.map((line, index) => {
                    const selectedIngredient = line.ingredientProductId
                      ? bodegaProducts.find((product) => product.productId === line.ingredientProductId) ?? null
                      : null;
                    return (
                      <div key={line._formKey ?? `recipe-line-${index}`} className="rounded-[24px] border border-border/70 bg-background/70 p-4 shadow-sm">
                        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className="rounded-full px-3 py-1">Linea {index + 1}</Badge>
                            {selectedIngredient ? (
                              <Badge variant="secondary" className="rounded-full px-3 py-1">{selectedIngredient.productCode}</Badge>
                            ) : null}
                          </div>
                          <Button type="button" variant="outline" className="rounded-full" onClick={() => removeRecipeLine(index)}>
                            <Trash2 className="size-4" />
                            Quitar
                          </Button>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                          <div className="space-y-2 md:col-span-2">
                            <Label htmlFor={`recipe-product-${index}`}>Insumo de Bodega</Label>
                            <Input
                              id={`recipe-product-${index}`}
                              list={`recipe-product-options-${index}`}
                              className="rounded-xl"
                              value={ingredientSearchValues[index] ?? ""}
                              onChange={(event) => updateIngredientSearch(index, event.target.value)}
                              onBlur={() => resolveIngredientSearch(index)}
                              placeholder="Busca por codigo o nombre"
                            />
                            <datalist id={`recipe-product-options-${index}`}>
                              {bodegaProducts.map((product) => (
                                <option key={`${product.productId}-fmt`} value={formatBodegaProductOption(product)} />
                              ))}
                            </datalist>
                            {formErrors.recipeLineErrors?.[index]?.ingredientProductId ? (
                              <p className="text-xs text-destructive">{formErrors.recipeLineErrors[index]?.ingredientProductId}</p>
                            ) : null}
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor={`recipe-unit-${index}`}>Unidad del insumo</Label>
                            <div id={`recipe-unit-${index}`} className="rounded-[18px] border border-border/70 bg-background/75 px-4 py-3 text-sm font-medium">
                              {selectedIngredient?.baseUnitCode ?? "-"}
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor={`recipe-quantity-${index}`}>Cantidad del insumo</Label>
                            <Input
                              id={`recipe-quantity-${index}`}
                              type="number"
                              step="0.0001"
                              className="rounded-xl"
                              value={line.ingredientQuantityValue ?? ""}
                              onChange={(event) => updateRecipeLine(index, { ingredientQuantityValue: event.target.value === "" ? null : Number(event.target.value) })}
                            />
                            {formErrors.recipeLineErrors?.[index]?.ingredientQuantityValue ? (
                              <p className="text-xs text-destructive">{formErrors.recipeLineErrors[index]?.ingredientQuantityValue}</p>
                            ) : null}
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor={`recipe-reference-${index}`}>Referencia</Label>
                            <Input
                              id={`recipe-reference-${index}`}
                              className="rounded-xl"
                              value={line.ingredientQuantityReference ?? ""}
                              onChange={(event) => updateRecipeLine(index, { ingredientQuantityReference: event.target.value })}
                              placeholder="Opcional"
                            />
                          </div>

                          <div className="space-y-2 md:col-span-2 xl:col-span-3">
                            <Label htmlFor={`recipe-notes-${index}`}>Notas de linea</Label>
                            <Input
                              id={`recipe-notes-${index}`}
                              className="rounded-xl"
                              value={line.notes ?? ""}
                              onChange={(event) => updateRecipeLine(index, { notes: event.target.value })}
                              placeholder="Opcional"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {formErrors.recipeLines ? <p className="text-xs text-destructive">{formErrors.recipeLines}</p> : null}
              </div>

              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <Label>3. Actividades donde aplica</Label>
                    <p className="text-xs text-muted-foreground">
                      Una vez armada la receta, aqui decides en que actividades fuente puede usarse el producto terminado.
                    </p>
                  </div>
                  <Button type="button" variant="outline" className="rounded-full" onClick={addAssignment}>
                    <Plus className="size-4" />
                    Agregar rama
                  </Button>
                </div>
                <div className="space-y-3">
                  {formValues.assignments.map((assignment, index) => (
                    <div key={assignment._formKey ?? `assignment-${index}`} className="grid gap-4 rounded-[20px] border border-border/70 bg-background/70 p-4 md:grid-cols-[1fr_auto]">
                      <div className="space-y-2">
                        <Label htmlFor={`laboratory-assignment-${index}`}>Actividad fuente</Label>
                        <Input
                          id={`laboratory-assignment-${index}`}
                          list={`laboratory-activity-options-${index}`}
                          className="rounded-xl"
                          value={activitySearchValues[index] ?? ""}
                          onChange={(event) => updateAssignmentSearch(index, event.target.value)}
                          onBlur={() => resolveAssignmentSearch(index)}
                          placeholder="Busca por activity_id o nombre"
                        />
                        <datalist id={`laboratory-activity-options-${index}`}>
                          {activities.map((activity) => (
                            <option key={`${activity.activityId}-fmt`} value={formatActivityOption(activity)} />
                          ))}
                        </datalist>
                      </div>
                      <div className="flex items-end">
                        <Button type="button" variant="outline" className="rounded-full" onClick={() => removeAssignment(index)}>
                          <Trash2 className="size-4" />
                          Quitar
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                {formErrors.assignments ? <p className="text-xs text-destructive">{formErrors.assignments}</p> : null}
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="laboratory-status">Estado</Label>
                  <select
                    id="laboratory-status"
                    className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                    value={formValues.isActive ? "active" : "inactive"}
                    onChange={(event) => updateField("isActive", event.target.value === "active")}
                  >
                    <option value="active">Activo</option>
                    <option value="inactive">Inactivo</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="laboratory-reason">Motivo de cambio</Label>
                  <Input
                    id="laboratory-reason"
                    className="rounded-xl"
                    value={formValues.changeReason ?? ""}
                    onChange={(event) => updateField("changeReason", event.target.value)}
                    placeholder="Opcional"
                  />
                </div>
              </div>

              <div className="rounded-[22px] border border-border/70 bg-background/75 px-4 py-4 text-sm">
                <p className="font-semibold">Resumen del producto</p>
                <div className="mt-3 grid gap-2 text-muted-foreground md:grid-cols-2">
                  <p>Producto: {formValues.productCode || "---"} / {formValues.productName || "Sin nombre"}</p>
                  <p>1. Tipo: {categories.find((category) => category.categoryId === formValues.categoryId)?.categoryName ?? "-"}</p>
                  <p>Unidad base: {units.find((unit) => unit.unitId === formValues.baseUnitId)?.code ?? "-"}</p>
                  <p>2. Lineas de receta: {formValues.recipeLines.length}</p>
                  <p>3. Actividades vinculadas: {buildPayload(formValues).assignments.length}</p>
                </div>
              </div>

              <div className="flex flex-wrap justify-end gap-2">
                <Button type="button" variant="outline" className="rounded-full" onClick={resetForm} disabled={!isDirty || isSaving}>
                  Restablecer
                </Button>
                <Button type="submit" className="rounded-full" disabled={isSaving}>
                  {isSaving ? "Guardando..." : (
                    <>
                      <Save className="size-4" />
                      Guardar producto
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </SectionPageShell>
  );
}
