"use client";

import { startTransition, useDeferredValue, useEffect, useMemo, useState } from "react";
import {
  DatabaseZap,
  Droplets,
  FlaskConical,
  LoaderCircle,
  PencilLine,
  Plus,
  RefreshCcw,
  Save,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import useSWR from "swr";

import type {
  CampoDrenchProductInput,
  CampoDrenchProductPayload,
  CampoDrenchProductRecord,
} from "@/lib/campo-drench-product-types";
import { fetchJson } from "@/lib/fetch-json";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/shared/data-display/empty-state";
import { MetricTile } from "@/shared/data-display/metric-tile";
import { formatDateTime } from "@/shared/lib/format";
import { FilterPanel, KpiGrid } from "@/shared/layout/filter-panel";
import { SectionPageShell } from "@/shared/layout/section-page-shell";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";

type EditorMode = "create" | "edit";
type FormErrors = Partial<Record<keyof CampoDrenchProductInput, string>>;

const EMPTY_FORM_VALUES: CampoDrenchProductInput = {
  productName: "",
  productCode: "",
  unit: "",
  utilization: "",
  warehouseAvailability: "",
  applicationDay: "",
  applicationPh: "",
  reentryHours: "",
  applicationReason1: "",
  applicationReason2: "",
  applicationReason3: "",
  applicationReason4: "",
  activeIngredient: "",
  toxicologicalCategory: "",
  toxicologicalDescription: "",
  agrochemicalOrder: "",
  predisposition: "",
  referenceDose: "",
  withholdingPeriod: "",
  changeReason: "",
};

const fetcher = (url: string) =>
  fetchJson<CampoDrenchProductRecord[]>(url, "No se pudo cargar el maestro de productos Drench.");

function mapRecordToFormValues(record: CampoDrenchProductRecord): CampoDrenchProductInput {
  return {
    productName: record.productName,
    productCode: record.productCode ?? "",
    unit: record.unit ?? "",
    utilization: record.utilization ?? "",
    warehouseAvailability: record.warehouseAvailability ?? "",
    applicationDay: record.applicationDay ?? "",
    applicationPh: record.applicationPh ?? "",
    reentryHours: record.reentryHours ?? "",
    applicationReason1: record.applicationReason1 ?? "",
    applicationReason2: record.applicationReason2 ?? "",
    applicationReason3: record.applicationReason3 ?? "",
    applicationReason4: record.applicationReason4 ?? "",
    activeIngredient: record.activeIngredient ?? "",
    toxicologicalCategory: record.toxicologicalCategory ?? "",
    toxicologicalDescription: record.toxicologicalDescription ?? "",
    agrochemicalOrder: record.agrochemicalOrder ?? "",
    predisposition: record.predisposition ?? "",
    referenceDose: record.referenceDose ?? "",
    withholdingPeriod: record.withholdingPeriod ?? "",
    changeReason: "",
  };
}

function buildPayload(values: CampoDrenchProductInput): CampoDrenchProductInput {
  return {
    productName: values.productName.trim(),
    productCode: values.productCode?.trim() || null,
    unit: values.unit?.trim() || null,
    utilization: values.utilization?.trim() || null,
    warehouseAvailability: values.warehouseAvailability?.trim() || null,
    applicationDay: values.applicationDay?.trim() || null,
    applicationPh: values.applicationPh?.trim() || null,
    reentryHours: values.reentryHours?.trim() || null,
    applicationReason1: values.applicationReason1?.trim() || null,
    applicationReason2: values.applicationReason2?.trim() || null,
    applicationReason3: values.applicationReason3?.trim() || null,
    applicationReason4: values.applicationReason4?.trim() || null,
    activeIngredient: values.activeIngredient?.trim() || null,
    toxicologicalCategory: values.toxicologicalCategory?.trim() || null,
    toxicologicalDescription: values.toxicologicalDescription?.trim() || null,
    agrochemicalOrder: values.agrochemicalOrder?.trim() || null,
    predisposition: values.predisposition?.trim() || null,
    referenceDose: values.referenceDose?.trim() || null,
    withholdingPeriod: values.withholdingPeriod?.trim() || null,
    changeReason: values.changeReason?.trim() || null,
  };
}

function validateForm(values: CampoDrenchProductInput) {
  const payload = buildPayload(values);
  const errors: FormErrors = {};

  if (!payload.productName) {
    errors.productName = "El nombre del producto es obligatorio.";
  }

  return errors;
}

function Field({
  id,
  label,
  value,
  placeholder,
  error,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  placeholder?: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className={cn("rounded-xl", error && "border-destructive focus-visible:ring-destructive")}
      />
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

export function CampoDrenchProductsExplorer({
  initialData,
  initialError,
}: {
  initialData: CampoDrenchProductRecord[];
  initialError?: string | null;
}) {
  const [editorMode, setEditorMode] = useState<EditorMode>("create");
  const [selectedProductId, setSelectedProductId] = useState<string | null>(initialData[0]?.productId ?? null);
  const [search, setSearch] = useState("");
  const [formValues, setFormValues] = useState<CampoDrenchProductInput>(EMPTY_FORM_VALUES);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [isSaving, setIsSaving] = useState(false);
  const deferredSearch = useDeferredValue(search);

  const { data, error, isValidating, mutate } = useSWR(
    "/api/campo/administrar-maestros/productos-drench",
    fetcher,
    {
      fallbackData: initialData,
      revalidateOnFocus: false,
      dedupingInterval: 15000,
    },
  );

  const records = data ?? initialData;
  const selectedRecord = editorMode === "edit"
    ? records.find((record) => record.productId === selectedProductId) ?? null
    : null;

  const filteredRecords = useMemo(() => {
    const normalized = deferredSearch.trim().toLowerCase();
    if (!normalized) return records;

    return records.filter((record) => [
      record.productName,
      record.productCode,
      record.unit,
      record.applicationDay,
      record.activeIngredient,
      record.actorId,
      record.changeReason,
    ].some((value) => String(value ?? "").toLowerCase().includes(normalized)));
  }, [deferredSearch, records]);

  const latestRecord = useMemo(
    () => [...records]
      .filter((record) => record.loadedAt)
      .sort((left, right) => String(right.loadedAt).localeCompare(String(left.loadedAt)))[0] ?? null,
    [records],
  );

  const productsWithDay = useMemo(
    () => records.filter((record) => record.applicationDay).length,
    [records],
  );

  useEffect(() => {
    if (error) {
      toast.error(error.message || "No se pudo cargar el maestro de productos Drench.");
    }
  }, [error]);

  useEffect(() => {
    setFormValues(selectedRecord ? mapRecordToFormValues(selectedRecord) : EMPTY_FORM_VALUES);
    setFormErrors({});
  }, [selectedRecord]);

  function updateField<Key extends keyof CampoDrenchProductInput>(
    field: Key,
    value: CampoDrenchProductInput[Key],
  ) {
    setFormValues((current) => ({ ...current, [field]: value }));
    setFormErrors((current) => ({ ...current, [field]: undefined }));
  }

  function openCreateMode() {
    startTransition(() => {
      setEditorMode("create");
      setSelectedProductId(null);
      setFormValues(EMPTY_FORM_VALUES);
      setFormErrors({});
    });
  }

  function openEditMode(productId: string) {
    startTransition(() => {
      setEditorMode("edit");
      setSelectedProductId(productId);
    });
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validateForm(formValues);
    setFormErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      toast.error("Revisa los campos obligatorios antes de guardar.");
      return;
    }

    setIsSaving(true);

    try {
      const isEditing = editorMode === "edit" && selectedProductId;
      const endpoint = isEditing
        ? `/api/campo/administrar-maestros/productos-drench/${encodeURIComponent(selectedProductId)}`
        : "/api/campo/administrar-maestros/productos-drench";
      const method = isEditing ? "PATCH" : "POST";
      const response = await fetchJson<CampoDrenchProductPayload>(
        endpoint,
        "No se pudo guardar el producto Drench.",
        {
          method,
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(buildPayload(formValues)),
        },
      );

      toast.success(isEditing ? "Producto Drench actualizado correctamente." : "Producto Drench creado correctamente.");
      await mutate();
      startTransition(() => {
        setEditorMode("edit");
        setSelectedProductId(response.data.productId);
      });
    } catch (submitError) {
      toast.error(submitError instanceof Error ? submitError.message : "No se pudo guardar el producto Drench.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <SectionPageShell
        eyebrow="Gestion / Campo / Administrar Maestros"
        title="Administrar productos Drench"
        subtitle="Maestro operativo de productos Drench para llevar la logica del Excel al sistema. Cada guardado crea una nueva version vigente con trazabilidad SCD2 en db_camp.public."
        icon={<DatabaseZap className="size-5" aria-hidden="true" />}
        actions={(
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" className="rounded-full" onClick={() => mutate()}>
              <RefreshCcw className={cn("size-4", isValidating && "animate-spin")} />
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
            <MetricTile label="Productos activos" value={String(records.length)} hint="Catalogo vigente para la futura programacion Drench." />
            <MetricTile label="Con dia definido" value={String(productsWithDay)} hint="Productos que ya tienen dia de aplicacion cargado." />
            <MetricTile label="Ultima carga" value={latestRecord?.loadedAt ? formatDateTime(latestRecord.loadedAt) : "-"} />
            <MetricTile label="Ultimo actor" value={latestRecord?.actorId ?? "-"} />
          </KpiGrid>

          {initialError ? (
            <p className="rounded-[18px] border border-destructive/30 bg-destructive/8 px-4 py-3 text-sm text-destructive">
              {initialError}
            </p>
          ) : null}
        </FilterPanel>
      </SectionPageShell>

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Card className="starter-panel border-border/70 bg-card/84">
          <CardHeader className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-slate-900/10 p-3 text-slate-700 dark:bg-slate-900/20 dark:text-white">
                <FlaskConical className="size-5" aria-hidden="true" />
              </div>
              <div>
                <CardTitle className="text-lg">Listado maestro</CardTitle>
                <CardDescription>Selecciona un producto Drench para editar su version vigente o crea uno nuevo.</CardDescription>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="campo-drench-products-search">Buscar producto</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="campo-drench-products-search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar por producto, codigo, unidad, dia, ingrediente o motivo..."
                  className="pl-10"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="max-h-[calc(100dvh-16rem)] space-y-3 overflow-y-auto pr-1">
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
                          <p className="text-base font-semibold">{record.productName}</p>
                          {record.productCode ? (
                            <Badge variant={isSelected ? "secondary" : "outline"} className="rounded-full px-3 py-1">
                              {record.productCode}
                            </Badge>
                          ) : null}
                          {record.unit ? (
                            <Badge variant={isSelected ? "secondary" : "outline"} className="rounded-full px-3 py-1">
                              {record.unit}
                            </Badge>
                          ) : null}
                        </div>
                        <p className={cn("text-xs", isSelected ? "text-white/70" : "text-muted-foreground")}>
                          Dia: {record.applicationDay ?? "Sin definir"} | Actor: {record.actorId ?? "-"}
                        </p>
                        {record.activeIngredient ? (
                          <p className={cn("text-xs", isSelected ? "text-white/70" : "text-muted-foreground")}>
                            Ingrediente activo: {record.activeIngredient}
                          </p>
                        ) : null}
                      </div>
                      <PencilLine className={cn("size-4 shrink-0", isSelected ? "text-white" : "text-muted-foreground")} />
                    </div>
                  </button>
                );
              }) : (
                <EmptyState label="No hay productos Drench que coincidan con el filtro actual." />
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="starter-panel border-border/70 bg-card/84 xl:sticky xl:top-4 xl:self-start">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <Badge variant="outline" className="mb-2 rounded-full px-3 py-1">
                  {editorMode === "edit" ? "Editar version vigente" : "Nuevo producto Drench"}
                </Badge>
                <CardTitle className="text-lg">{selectedRecord?.productName ?? "Registrar producto Drench"}</CardTitle>
                <CardDescription>Este maestro sera la base para reemplazar la hoja `CODIGOS D` dentro del sistema.</CardDescription>
              </div>
              <Droplets className="size-5 text-muted-foreground" aria-hidden="true" />
            </div>
          </CardHeader>
          <CardContent>
            <form className="space-y-6" onSubmit={onSubmit}>
              <div className="space-y-3">
                <h3 className="text-sm font-semibold tracking-tight">Identificacion</h3>
                <div className="grid gap-5 md:grid-cols-2">
                  <Field
                    id="drench-product-name"
                    label="Producto"
                    value={formValues.productName}
                    placeholder="Ej. HUMISTAR WG"
                    error={formErrors.productName}
                    onChange={(value) => updateField("productName", value)}
                  />
                  <Field
                    id="drench-product-code"
                    label="Codigo"
                    value={formValues.productCode ?? ""}
                    placeholder="Ej. D-001"
                    onChange={(value) => updateField("productCode", value)}
                  />
                  <Field
                    id="drench-product-unit"
                    label="Unidad"
                    value={formValues.unit ?? ""}
                    placeholder="Ej. kg, l, cc"
                    onChange={(value) => updateField("unit", value)}
                  />
                  <Field
                    id="drench-product-utilization"
                    label="Utilizacion"
                    value={formValues.utilization ?? ""}
                    placeholder="Ej. Si, No, Bajo pedido"
                    onChange={(value) => updateField("utilization", value)}
                  />
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold tracking-tight">Aplicacion</h3>
                <div className="grid gap-5 md:grid-cols-2">
                  <Field
                    id="drench-product-warehouse"
                    label="Disponibilidad en bodega"
                    value={formValues.warehouseAvailability ?? ""}
                    placeholder="Ej. Disponible"
                    onChange={(value) => updateField("warehouseAvailability", value)}
                  />
                  <Field
                    id="drench-product-day"
                    label="Dia de aplicacion"
                    value={formValues.applicationDay ?? ""}
                    placeholder="Ej. Martes"
                    onChange={(value) => updateField("applicationDay", value)}
                  />
                  <Field
                    id="drench-product-ph"
                    label="pH de aplicacion"
                    value={formValues.applicationPh ?? ""}
                    placeholder="Ej. 5.5 - 6.0"
                    onChange={(value) => updateField("applicationPh", value)}
                  />
                  <Field
                    id="drench-product-reentry"
                    label="Tiempo de reingreso"
                    value={formValues.reentryHours ?? ""}
                    placeholder="Ej. 12 h"
                    onChange={(value) => updateField("reentryHours", value)}
                  />
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold tracking-tight">Motivos de aplicacion</h3>
                <div className="grid gap-5 md:grid-cols-2">
                  <Field
                    id="drench-product-reason-1"
                    label="Motivo 1"
                    value={formValues.applicationReason1 ?? ""}
                    placeholder="Motivo principal"
                    onChange={(value) => updateField("applicationReason1", value)}
                  />
                  <Field
                    id="drench-product-reason-2"
                    label="Motivo 2"
                    value={formValues.applicationReason2 ?? ""}
                    placeholder="Motivo secundario"
                    onChange={(value) => updateField("applicationReason2", value)}
                  />
                  <Field
                    id="drench-product-reason-3"
                    label="Motivo 3"
                    value={formValues.applicationReason3 ?? ""}
                    placeholder="Motivo complementario"
                    onChange={(value) => updateField("applicationReason3", value)}
                  />
                  <Field
                    id="drench-product-reason-4"
                    label="Motivo 4"
                    value={formValues.applicationReason4 ?? ""}
                    placeholder="Motivo complementario"
                    onChange={(value) => updateField("applicationReason4", value)}
                  />
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold tracking-tight">Ficha tecnica</h3>
                <div className="grid gap-5 md:grid-cols-2">
                  <Field
                    id="drench-product-active-ingredient"
                    label="Ingrediente activo"
                    value={formValues.activeIngredient ?? ""}
                    placeholder="Ingrediente activo"
                    onChange={(value) => updateField("activeIngredient", value)}
                  />
                  <Field
                    id="drench-product-toxicological-category"
                    label="Categoria toxicologica"
                    value={formValues.toxicologicalCategory ?? ""}
                    placeholder="Ej. III"
                    onChange={(value) => updateField("toxicologicalCategory", value)}
                  />
                  <Field
                    id="drench-product-toxicological-description"
                    label="Descripcion toxicologica"
                    value={formValues.toxicologicalDescription ?? ""}
                    placeholder="Descripcion"
                    onChange={(value) => updateField("toxicologicalDescription", value)}
                  />
                  <Field
                    id="drench-product-order"
                    label="Orden agroquimico"
                    value={formValues.agrochemicalOrder ?? ""}
                    placeholder="Ej. 3"
                    onChange={(value) => updateField("agrochemicalOrder", value)}
                  />
                  <Field
                    id="drench-product-predisposition"
                    label="Predisposicion"
                    value={formValues.predisposition ?? ""}
                    placeholder="Predisposicion"
                    onChange={(value) => updateField("predisposition", value)}
                  />
                  <Field
                    id="drench-product-dose"
                    label="Dosis referencial"
                    value={formValues.referenceDose ?? ""}
                    placeholder="Ej. 2 cc/l"
                    onChange={(value) => updateField("referenceDose", value)}
                  />
                  <Field
                    id="drench-product-withholding"
                    label="Carencia"
                    value={formValues.withholdingPeriod ?? ""}
                    placeholder="Ej. 7 dias"
                    onChange={(value) => updateField("withholdingPeriod", value)}
                  />
                  <Field
                    id="drench-product-change-reason"
                    label="Motivo del cambio"
                    value={formValues.changeReason ?? ""}
                    placeholder={editorMode === "edit" ? "Ej. actualizacion de codigo o dia" : "Creacion manual"}
                    onChange={(value) => updateField("changeReason", value)}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 border-t border-border/60 pt-3">
                <Button type="button" variant="outline" onClick={openCreateMode}>
                  Limpiar
                </Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
                  {editorMode === "edit" ? "Guardar cambios" : "Guardar producto"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
