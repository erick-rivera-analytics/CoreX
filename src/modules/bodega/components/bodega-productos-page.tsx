"use client";

import { type ReactNode, startTransition, useDeferredValue, useEffect, useMemo, useState } from "react";
import {
  Building2,
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
  BodegaCategoryRecord,
  BodegaProductAssignmentInput,
  BodegaProductInput,
  BodegaProductPayload,
  BodegaProductRecord,
  BodegaUnitRecord,
} from "@/lib/bodega-master-types";
import { cn } from "@/lib/utils";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { MetricTile } from "@/shared/data-display/metric-tile";
import { FilterPanel, KpiGrid } from "@/shared/layout/filter-panel";
import { SectionPageShell } from "@/shared/layout/section-page-shell";
import { formatDateTime } from "@/shared/lib/format";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";

type BodegaProductosPageProps = {
  initialProducts: BodegaProductRecord[];
  initialUnits: BodegaUnitRecord[];
  initialCategories: BodegaCategoryRecord[];
  initialActivities: BodegaActivityRecord[];
  initialError?: string | null;
};

type EditorMode = "create" | "edit";
type FormErrors = Partial<Record<Exclude<keyof BodegaProductInput, "assignments">, string>> & {
  assignments?: string;
  categorySearch?: string;
};

const MAX_ASSIGNMENT_BRANCHES = 12;

function makeEmptyFormValues(): BodegaProductInput {
  return {
    productCode: "",
    productName: "",
    description: "",
    baseUnitId: "",
    categoryId: "",
    activeComponentMode: "na",
    activeComponentName: "",
    isActive: true,
    assignments: [{ _formKey: crypto.randomUUID(), activityId: "", branchOrder: 1 }],
    changeReason: "",
  };
}

const productsFetcher = (url: string) =>
  fetchJson<BodegaProductRecord[]>(url, "No se pudo cargar el maestro de productos.");
const unitsFetcher = (url: string) =>
  fetchJson<BodegaUnitRecord[]>(url, "No se pudo cargar el maestro de unidades.");
const categoriesFetcher = (url: string) =>
  fetchJson<BodegaCategoryRecord[]>(url, "No se pudo cargar el catalogo de Bodega.");
const activitiesFetcher = (url: string) =>
  fetchJson<BodegaActivityRecord[]>(url, "No se pudo cargar el maestro fuente de actividades.");

function leafCategories(records: BodegaCategoryRecord[]) {
  return records
    .filter((record) => record.level === "subfamily" && record.isActive)
    .sort((left, right) => left.pathLabel.localeCompare(right.pathLabel));
}

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

  return activities.find((activity) => {
    return [
      activity.activityId,
      activity.activityName,
      formatActivityOption(activity),
    ].some((candidate) => candidate.trim().toLowerCase() === normalized);
  }) ?? null;
}

function findActivityCandidates(value: string, activities: BodegaActivityRecord[]) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return [];

  return activities.filter((activity) => {
    return [
      activity.activityId,
      activity.activityName,
      formatActivityOption(activity),
    ].some((candidate) => candidate.trim().toLowerCase().includes(normalized));
  });
}

function mapRecordToFormValues(record: BodegaProductRecord): BodegaProductInput {
  return {
    productCode: record.productCode,
    productName: record.productName,
    description: record.description ?? "",
    baseUnitId: record.baseUnitId,
    categoryId: record.categoryId,
    activeComponentMode: record.activeComponentMode,
    activeComponentName: record.activeComponentName ?? "",
    isActive: record.isActive,
    assignments: record.assignments.map((assignment) => ({
      _formKey: crypto.randomUUID(),
      activityId: assignment.activityId,
      branchOrder: assignment.branchOrder,
    })),
    changeReason: "",
  };
}

function buildPayload(values: BodegaProductInput): BodegaProductInput {
  return {
    productCode: values.productCode.trim().toUpperCase(),
    productName: values.productName.trim(),
    description: values.description?.trim() || null,
    baseUnitId: values.baseUnitId.trim(),
    categoryId: values.categoryId.trim(),
    activeComponentMode: values.activeComponentMode,
    activeComponentName: values.activeComponentMode === "na"
      ? null
      : values.activeComponentName?.trim() || null,
    isActive: values.isActive,
    assignments: values.assignments
      .map((assignment, index) => ({
        activityId: assignment.activityId.trim().toUpperCase(),
        branchOrder: index + 1,
      }))
      .filter((assignment) => assignment.activityId),
    changeReason: values.changeReason?.trim() || null,
  };
}

function validateForm(
  values: BodegaProductInput,
  categories: BodegaCategoryRecord[],
  activities: BodegaActivityRecord[],
): FormErrors {
  const payload = buildPayload(values);
  const errors: FormErrors = {};
  const rawAssignmentCount = values.assignments.filter((assignment) => assignment.activityId.trim()).length;

  if (!payload.productCode) errors.productCode = "El codigo del producto es obligatorio.";
  if (!payload.productName) errors.productName = "El nombre oficial es obligatorio.";
  if (!payload.baseUnitId) errors.baseUnitId = "La unidad base es obligatoria.";
  if (!payload.categoryId) {
    errors.categorySearch = "Debes seleccionar una rama valida del catalogo.";
  } else if (!categories.some((category) => category.categoryId === payload.categoryId)) {
    errors.categorySearch = "La rama seleccionada no existe o ya no esta activa.";
  }
  if (payload.activeComponentMode === "applies" && !payload.activeComponentName) {
    errors.activeComponentName = "Debes detallar el componente activo.";
  }
  if (payload.assignments.length !== rawAssignmentCount) {
    errors.assignments = "Cada rama debe quedar vinculada a una actividad fuente valida.";
  } else if (payload.assignments.some((assignment) => !activities.some((activity) => activity.activityId === assignment.activityId))) {
    errors.assignments = "Hay actividades seleccionadas que ya no existen en la fuente vigente.";
  }

  return errors;
}

export function BodegaProductosPage({
  initialProducts,
  initialUnits,
  initialCategories,
  initialActivities,
  initialError,
}: BodegaProductosPageProps) {
  const [editorMode, setEditorMode] = useState<EditorMode>("create");
  const [selectedProductId, setSelectedProductId] = useState<string | null>(initialProducts[0]?.productId ?? null);
  const [search, setSearch] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [formValues, setFormValues] = useState<BodegaProductInput>(makeEmptyFormValues);
  const [categorySearch, setCategorySearch] = useState("");
  const [activitySearchValues, setActivitySearchValues] = useState<string[]>([""]);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const deferredSearch = useDeferredValue(search);

  const { data: productsData, isValidating: isValidatingProducts, mutate: mutateProducts } = useSWR(
    "/api/bodega/administrar-maestros/productos",
    productsFetcher,
    {
      fallbackData: initialProducts,
      revalidateOnFocus: false,
      dedupingInterval: 15000,
      onError: (error) => toast.error(error?.message || "No se pudo cargar el maestro de productos."),
    },
  );
  const { data: unitsData } = useSWR(
    "/api/bodega/administrar-maestros/unidades",
    unitsFetcher,
    {
      fallbackData: initialUnits,
      revalidateOnFocus: false,
      dedupingInterval: 15000,
    },
  );
  const { data: categoriesData } = useSWR(
    "/api/bodega/administrar-maestros/categorias",
    categoriesFetcher,
    {
      fallbackData: initialCategories,
      revalidateOnFocus: false,
      dedupingInterval: 15000,
    },
  );
  const { data: activitiesData } = useSWR(
    "/api/bodega/administrar-maestros/actividades-fuente",
    activitiesFetcher,
    {
      fallbackData: initialActivities,
      revalidateOnFocus: false,
      dedupingInterval: 15000,
    },
  );

  const products = productsData ?? initialProducts;
  const units = unitsData ?? initialUnits;
  const categories = categoriesData ?? initialCategories;
  const activities = activitiesData ?? initialActivities;
  const leafOptions = useMemo(() => leafCategories(categories), [categories]);

  const selectedRecord = editorMode === "edit"
    ? products.find((record) => record.productId === selectedProductId) ?? null
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

    return products.filter((record) => {
      return [
        record.productCode,
        record.productName,
        record.categoryPathLabel,
        record.baseUnitCode,
      ].some((value) => String(value ?? "").toLowerCase().includes(normalized));
    });
  }, [deferredSearch, products]);

  const summary = useMemo(() => {
    const latest = products.reduce<(typeof products)[number] | null>(
      (best, record) => {
        if (!record.loadedAt) return best;
        if (!best || String(record.loadedAt) > String(best.loadedAt)) return record;
        return best;
      },
      null,
    );

    return {
      totalProducts: products.length,
      totalUnits: units.length,
      totalCategories: categories.length,
      totalActivities: activities.length,
      latest,
    };
  }, [products, units, categories, activities]);

  useEffect(() => {
    const nextForm = selectedRecord ? mapRecordToFormValues(selectedRecord) : makeEmptyFormValues();
    setFormValues(nextForm);
    setCategorySearch(selectedRecord?.categoryPathLabel ?? "");
    setActivitySearchValues(
      nextForm.assignments.map((assignment) => {
        const match = activities.find((activity) => activity.activityId === assignment.activityId);
        return match ? formatActivityOption(match) : assignment.activityId;
      }),
    );
    setFormErrors({});
  }, [selectedRecord, activities]);

  function updateField<Key extends keyof BodegaProductInput>(field: Key, value: BodegaProductInput[Key]) {
    setFormValues((current) => ({ ...current, [field]: value }));
    setFormErrors((current) => ({ ...current, [field]: undefined }));
  }

  function updateAssignment(index: number, field: keyof BodegaProductAssignmentInput, value: string) {
    setFormValues((current) => ({
      ...current,
      assignments: current.assignments.map((assignment, assignmentIndex) => (
        assignmentIndex === index
          ? { ...assignment, [field]: value, branchOrder: assignmentIndex + 1 }
          : assignment
      )),
    }));
    setFormErrors((current) => ({ ...current, assignments: undefined }));
  }

  function updateAssignmentSearch(index: number, value: string) {
    setActivitySearchValues((current) => current.map((item, itemIndex) => itemIndex === index ? value : item));
    const match = findActivityFromSearch(value, activities);
    updateAssignment(index, "activityId", match?.activityId ?? "");
  }

  function resolveAssignmentSearch(index: number) {
    const currentValue = activitySearchValues[index] ?? "";
    const exactMatch = findActivityFromSearch(currentValue, activities);

    if (exactMatch) {
      const formatted = formatActivityOption(exactMatch);
      setActivitySearchValues((current) => current.map((item, itemIndex) => itemIndex === index ? formatted : item));
      updateAssignment(index, "activityId", exactMatch.activityId);
      return;
    }

    const candidates = findActivityCandidates(currentValue, activities);
    if (candidates.length === 1) {
      const candidate = candidates[0];
      const formatted = formatActivityOption(candidate);
      setActivitySearchValues((current) => current.map((item, itemIndex) => itemIndex === index ? formatted : item));
      updateAssignment(index, "activityId", candidate.activityId);
      return;
    }

    if (!currentValue.trim()) {
      updateAssignment(index, "activityId", "");
    }
  }

  function addAssignmentBranch() {
    setFormValues((current) => {
      if (current.assignments.length >= MAX_ASSIGNMENT_BRANCHES) {
        toast.error(`El formulario esta limitado a ${MAX_ASSIGNMENT_BRANCHES} ramas por ahora.`);
        return current;
      }

      return {
        ...current,
        assignments: [
          ...current.assignments,
          { _formKey: crypto.randomUUID(), activityId: "", branchOrder: current.assignments.length + 1 },
        ],
      };
    });
    setActivitySearchValues((current) => [...current, ""]);
  }

  function removeAssignmentBranch(index: number) {
    setFormValues((current) => {
      return {
        ...current,
        assignments: current.assignments.reduce<(typeof current.assignments)[number][]>((acc, assignment, assignmentIndex) => {
          if (assignmentIndex !== index) acc.push({ ...assignment, branchOrder: acc.length + 1 });
          return acc;
        }, []),
      };
    });
    setActivitySearchValues((current) => current.filter((_, assignmentIndex) => assignmentIndex !== index));
  }

  function openCreateMode() {
    startTransition(() => {
      setEditorMode("create");
      setSelectedProductId(null);
    });
  }

  function openEditMode(productId: string) {
    startTransition(() => {
      setEditorMode("edit");
      setSelectedProductId(productId);
    });
  }

  function resetForm() {
    const nextForm = selectedRecord ? mapRecordToFormValues(selectedRecord) : makeEmptyFormValues();
    setFormValues(nextForm);
    setCategorySearch(selectedRecord?.categoryPathLabel ?? "");
    setActivitySearchValues(
      nextForm.assignments.map((assignment) => {
        const match = activities.find((activity) => activity.activityId === assignment.activityId);
        return match ? formatActivityOption(match) : assignment.activityId;
      }),
    );
    setFormErrors({});
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextErrors = validateForm(formValues, leafOptions, activities);
    setFormErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      toast.error("Revisa los campos obligatorios antes de guardar.");
      return;
    }

    setIsSaving(true);

    try {
      const isEditing = editorMode === "edit" && selectedProductId;
      const endpoint = isEditing
        ? `/api/bodega/administrar-maestros/productos/${encodeURIComponent(selectedProductId)}`
        : "/api/bodega/administrar-maestros/productos";
      const method = isEditing ? "PATCH" : "POST";
      const response = await fetchJson<BodegaProductPayload>(
        endpoint,
        "No se pudo guardar el producto.",
        {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(currentPayload),
        },
      );

      toast.success(isEditing ? "Producto actualizado correctamente." : "Producto creado correctamente.");
      await mutateProducts();
      startTransition(() => {
        setEditorMode("edit");
        setSelectedProductId(response.data.productId);
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar el producto.");
    } finally {
      setIsSaving(false);
    }
  }

  const selectedCategory = leafOptions.find((category) => category.categoryId === formValues.categoryId) ?? null;
  const selectedUnit = units.find((unit) => unit.unitId === formValues.baseUnitId) ?? null;

  return (
    <div className="space-y-4">
      <SectionPageShell
        eyebrow="Gestion / Bodega / Administrar Maestros"
        title="Productos"
        subtitle="Maestro corporativo de productos de Bodega. Cada guardado crea una nueva version vigente y conserva trazabilidad SCD2 en db_camp.public."
        icon={<Building2 className="size-5" aria-hidden="true" />}
        actions={(
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" className="rounded-full" onClick={() => void mutateProducts()}>
              <RefreshCcw className={cn("size-4", isValidatingProducts && "animate-spin")} />
              Recargar
            </Button>
            <Button type="button" className="rounded-full" onClick={openCreateMode}>
              <Plus className="size-4" />
              Nuevo producto
            </Button>
          </div>
        )}
      >
        <FilterPanel>
          <KpiGrid>
            <MetricTile label="Productos activos" value={String(summary.totalProducts)} hint="Catalogo vigente de insumos y materiales." />
            <MetricTile label="Unidades disponibles" value={String(summary.totalUnits)} hint="Unidad base sale del maestro de Unidades." />
            <MetricTile label="Ramas disponibles" value={String(summary.totalCategories)} hint="Categorias cargadas en Configurar catalogo." />
            <MetricTile label="Actividades fuente" value={String(summary.totalActivities)} hint="Fuente vigente desde prod_dim_activity_profile_scd2." />
            <MetricTile label="Ultima carga" value={summary.latest?.loadedAt ? formatDateTime(summary.latest.loadedAt) : "-"} hint="Ultimo producto guardado o actualizado." />
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
                <CardTitle className="text-lg">Listado maestro</CardTitle>
                <CardDescription>Selecciona un producto para editarlo o crea uno nuevo.</CardDescription>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="bodega-productos-search">Buscar producto</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="bodega-productos-search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar por codigo, nombre, categoria o unidad..."
                  className="pl-10"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="relative overflow-hidden pt-1">
            <div className="max-h-[calc(100dvh-16rem)] space-y-3 overflow-y-auto pr-1 pb-6">
              {filteredRecords.length ? filteredRecords.map((record) => {
                const isSelected = editorMode === "edit" && selectedProductId === record.productId;

                return (
                  <button
                    key={record.productId}
                    type="button"
                    onClick={() => openEditMode(record.productId)}
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
                          <p className="text-base font-semibold">{record.productCode}</p>
                          <Badge
                            variant={isSelected ? "secondary" : "outline"}
                            className={cn("rounded-full px-3 py-1", isSelected && "border-white/20 bg-white/12 text-white")}
                          >
                            {record.baseUnitCode}
                          </Badge>
                        </div>
                        <p className={cn("text-sm font-medium", isSelected ? "text-white/90" : "text-foreground")}>
                          {record.productName}
                        </p>
                        <p className={cn("text-xs", isSelected ? "text-white/75" : "text-muted-foreground")}>
                          {record.categoryPathLabel}
                        </p>
                      </div>
                      <PencilLine className={cn("size-4 shrink-0", isSelected ? "text-white" : "text-muted-foreground")} />
                    </div>
                  </button>
                );
              }) : (
                <div className="rounded-[24px] border border-dashed border-border/70 bg-background/80 px-4 py-8 text-center text-sm text-muted-foreground">
                  No hay productos que coincidan con el filtro actual.
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
                    {editorMode === "edit" ? "Editar version vigente" : "Nuevo producto"}
                  </Badge>
                  {selectedRecord ? (
                    <Badge variant="secondary" className="rounded-full px-3 py-1">
                      {selectedRecord.baseUnitCode}
                    </Badge>
                  ) : null}
                </div>
                <div>
                  <CardTitle className="text-lg">{selectedRecord ? selectedRecord.productName : "Registrar producto"}</CardTitle>
                  <CardDescription>Unidad base, rama del catalogo y actividades aplicables salen de sus maestros fuente.</CardDescription>
                </div>
              </div>
              <div className="rounded-full bg-slate-900/10 p-3 text-slate-700 dark:bg-slate-900/20 dark:text-white">
                <Building2 className="size-5" aria-hidden="true" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {!units.length || !leafOptions.length || !activities.length ? (
              <div className="rounded-[24px] border border-dashed border-border/70 bg-background/80 px-5 py-6 text-sm text-muted-foreground">
                {!units.length ? "Primero debes crear al menos una unidad activa en el maestro de Unidades." : null}
                {!units.length && (!leafOptions.length || !activities.length) ? " " : null}
                {!leafOptions.length ? "Tambien debes crear al menos una subfamilia activa en Configurar catalogo." : null}
                {(!units.length || !leafOptions.length) && !activities.length ? " " : null}
                {!activities.length ? "No hay actividades vigentes en slv.prod_dim_activity_profile_scd2 para asignar productos." : null}
              </div>
            ) : (
              <form className="space-y-6" onSubmit={onSubmit}>
                <div className="grid gap-5 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="product-code">Codigo corporativo</Label>
                    <Input id="product-code" className="rounded-xl" value={formValues.productCode} onChange={(event) => updateField("productCode", event.target.value)} />
                    {formErrors.productCode ? <p className="text-xs text-destructive">{formErrors.productCode}</p> : null}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="product-unit">Unidad base</Label>
                    <select
                      id="product-unit"
                      className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                      value={formValues.baseUnitId}
                      onChange={(event) => updateField("baseUnitId", event.target.value)}
                    >
                      <option value="">Selecciona una unidad</option>
                      {units.reduce<ReactNode[]>((acc, unit) => {
                        if (unit.isActive) acc.push(
                          <option key={unit.unitId} value={unit.unitId}>
                            {unit.code} · {unit.name}
                          </option>
                        );
                        return acc;
                      }, [])}
                    </select>
                    {formErrors.baseUnitId ? <p className="text-xs text-destructive">{formErrors.baseUnitId}</p> : null}
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="product-name">Nombre oficial</Label>
                    <Input id="product-name" className="rounded-xl" value={formValues.productName} onChange={(event) => updateField("productName", event.target.value)} />
                    {formErrors.productName ? <p className="text-xs text-destructive">{formErrors.productName}</p> : null}
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="product-category-search">Rama del catalogo</Label>
                    <Input
                      id="product-category-search"
                      list="bodega-category-options"
                      className="rounded-xl"
                      value={categorySearch}
                      onChange={(event) => {
                        const nextValue = event.target.value;
                        setCategorySearch(nextValue);
                        const match = leafOptions.find((category) => category.pathLabel === nextValue) ?? null;
                        updateField("categoryId", match?.categoryId ?? "");
                        setFormErrors((current) => ({ ...current, categorySearch: undefined }));
                      }}
                      placeholder="Escribe para buscar una rama del arbol..."
                    />
                    <datalist id="bodega-category-options">
                      {leafOptions.map((category) => (
                        <option key={category.categoryId} value={category.pathLabel} />
                      ))}
                    </datalist>
                    {formErrors.categorySearch ? <p className="text-xs text-destructive">{formErrors.categorySearch}</p> : null}
                    {selectedCategory ? (
                      <p className="text-xs text-muted-foreground">Rama seleccionada: {selectedCategory.pathLabel}</p>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="product-component-mode">Componente activo</Label>
                    <select
                      id="product-component-mode"
                      className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                      value={formValues.activeComponentMode}
                      onChange={(event) => updateField("activeComponentMode", event.target.value as BodegaProductInput["activeComponentMode"])}
                    >
                      <option value="na">No aplica / N-A</option>
                      <option value="applies">Si aplica</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="product-status">Estado</Label>
                    <select
                      id="product-status"
                      className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                      value={formValues.isActive ? "active" : "inactive"}
                      onChange={(event) => updateField("isActive", event.target.value === "active")}
                    >
                      <option value="active">Activo</option>
                      <option value="inactive">Inactivo</option>
                    </select>
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="product-active-component">Detalle del componente activo</Label>
                    <Input
                      id="product-active-component"
                      className="rounded-xl"
                      value={formValues.activeComponentName ?? ""}
                      onChange={(event) => updateField("activeComponentName", event.target.value)}
                      disabled={formValues.activeComponentMode === "na"}
                      placeholder={formValues.activeComponentMode === "na" ? "Se guardara como null" : "Ej. Acido citrico"}
                    />
                    {formErrors.activeComponentName ? <p className="text-xs text-destructive">{formErrors.activeComponentName}</p> : null}
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="product-description">Descripcion corporativa</Label>
                    <textarea
                      id="product-description"
                      rows={3}
                      className="flex min-h-[96px] w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                      value={formValues.description ?? ""}
                      onChange={(event) => updateField("description", event.target.value)}
                    />
                  </div>

                  <div className="space-y-3 md:col-span-2">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <Label>Actividades aplicables</Label>
                        <p className="text-xs text-muted-foreground">
                          Busca por `activity_id` o por nombre. Si todavia no conoces la actividad, puedes dejar el producto sin asignacion y completarlo despues.
                        </p>
                      </div>
                      <Button type="button" variant="outline" className="rounded-full" onClick={addAssignmentBranch}>
                        <Plus className="size-4" />
                        Agregar rama
                      </Button>
                    </div>

                    <div className="space-y-3">
                      {formValues.assignments.map((assignment, index) => (
                        <div
                          key={assignment._formKey ?? `assignment-${index}`}
                          className="grid gap-3 rounded-[20px] border border-dashed border-border/70 px-4 py-4 md:grid-cols-[1fr_auto]"
                        >
                          <div className="space-y-2">
                            <Label htmlFor={`assignment-activity-${index}`}>Actividad fuente</Label>
                            <Input
                              id={`assignment-activity-${index}`}
                              list={`bodega-activity-options-${index}`}
                              className="rounded-xl"
                              value={activitySearchValues[index] ?? ""}
                              onChange={(event) => updateAssignmentSearch(index, event.target.value)}
                              onBlur={() => resolveAssignmentSearch(index)}
                              placeholder="Ej. FM11, Drench o nombre de actividad..."
                            />
                            <datalist id={`bodega-activity-options-${index}`}>
                              {activities.map((activity) => (
                                <option key={`${activity.activityId}-fmt`} value={formatActivityOption(activity)} />
                              ))}
                              {activities.map((activity) => (
                                <option key={`${activity.activityId}-id`} value={activity.activityId} />
                              ))}
                              {activities.map((activity) => (
                                <option key={`${activity.activityId}-name`} value={activity.activityName} />
                              ))}
                            </datalist>
                          </div>

                          <div className="flex items-end justify-end">
                            <Button
                              type="button"
                              variant="outline"
                              className="rounded-full"
                              onClick={() => removeAssignmentBranch(index)}
                            >
                              <Trash2 className="size-4" />
                              Quitar
                            </Button>
                          </div>

                          <div className="md:col-span-2 rounded-[16px] bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                            {(() => {
                              const selectedActivity = activities.find((activity) => activity.activityId === assignment.activityId) ?? null;
                              if (!selectedActivity) {
                                return "Selecciona una actividad vigente para ver su centro y subcentro de costos.";
                              }

                              return `Centro de costos: ${selectedActivity.costArea ?? "Sin centro"} / ${selectedActivity.subCostCenter ?? "Sin subcentro"} / ${selectedActivity.activityName} (${selectedActivity.activityId})`;
                            })()}
                          </div>
                        </div>
                      ))}
                    </div>
                    {formErrors.assignments ? <p className="text-xs text-destructive">{formErrors.assignments}</p> : null}
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="product-reason">Motivo de cambio</Label>
                    <textarea
                      id="product-reason"
                      rows={3}
                      className="flex min-h-[96px] w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                      value={formValues.changeReason ?? ""}
                      onChange={(event) => updateField("changeReason", event.target.value)}
                      placeholder="Opcional. Ej. homologacion inicial de producto."
                    />
                  </div>
                </div>

                <div className="rounded-[22px] border border-border/70 bg-background/75 px-4 py-4 text-sm">
                  <p className="font-semibold">Resumen de ficha</p>
                  <div className="mt-3 space-y-2 text-muted-foreground">
                    <p>Unidad base: {selectedUnit ? `${selectedUnit.code} - ${selectedUnit.name}` : "Sin seleccionar"}</p>
                    <p>Categoria: {selectedCategory?.pathLabel ?? "Sin seleccionar"}</p>
                    <p>Componente activo: {formValues.activeComponentMode === "na" ? "No aplica / N-A" : (formValues.activeComponentName || "Pendiente")}</p>
                    <p>Actividades registradas: {currentPayload.assignments.length}</p>
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
                        Guardar producto
                      </>
                    )}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
