"use client";

import { type ReactNode, startTransition, useDeferredValue, useEffect, useMemo, useState } from "react";
import {
  Boxes,
  PencilLine,
  Plus,
  RefreshCcw,
  Save,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import useSWR from "swr";

import { fetchJson } from "@/lib/fetch-json";
import type {
  BodegaPresentationInput,
  BodegaPresentationPayload,
  BodegaPresentationRecord,
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

type BodegaPresentacionesPageProps = {
  initialPresentations: BodegaPresentationRecord[];
  initialProducts: BodegaProductRecord[];
  initialUnits: BodegaUnitRecord[];
  initialError?: string | null;
};

type EditorMode = "create" | "edit";

type FormErrors = Partial<Record<Exclude<keyof BodegaPresentationInput, "allowsFractioning" | "isActive">, string>> & {
  productSearch?: string;
};

const UNIT_CONVERSION_FACTORS: Record<string, number> = {
  KG: 1000,
  GR: 1,
  LT: 1000,
  CC: 1,
  GL: 3785.411784,
  GA: 3785.411784,
  M3: 1_000_000,
  P3: 28316.846592,
  PIE3: 28316.846592,
  MT: 1,
};

const EMPTY_FORM_VALUES: BodegaPresentationInput = {
  productId: "",
  commercialName: "",
  presentationCode: "",
  presentationName: "",
  packageName: "",
  presentationQuantity: 0,
  presentationUnitId: "",
  equivalentBaseQuantity: null,
  allowsFractioning: false,
  operationalNote: "",
  isActive: true,
  changeReason: "",
};

const presentationsFetcher = (url: string) =>
  fetchJson<BodegaPresentationRecord[]>(url, "No se pudo cargar el maestro de presentaciones.");
const productsFetcher = (url: string) =>
  fetchJson<BodegaProductRecord[]>(url, "No se pudo cargar el maestro de productos.");
const unitsFetcher = (url: string) =>
  fetchJson<BodegaUnitRecord[]>(url, "No se pudo cargar el maestro de unidades.");

function formatProductOption(product: BodegaProductRecord) {
  return `${product.productCode} - ${product.productName}`;
}

function formatUnitOption(unit: BodegaUnitRecord) {
  return `${unit.code} - ${unit.name}`;
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

function mapRecordToFormValues(record: BodegaPresentationRecord): BodegaPresentationInput {
  return {
    productId: record.productId,
    commercialName: record.commercialName ?? "",
    presentationCode: record.presentationCode,
    presentationName: record.presentationName,
    packageName: record.packageName ?? "",
    presentationQuantity: record.presentationQuantity,
    presentationUnitId: record.presentationUnitId,
    equivalentBaseQuantity: record.conversionMode === "manual" ? record.equivalentBaseQuantity : null,
    allowsFractioning: record.allowsFractioning,
    operationalNote: record.operationalNote ?? "",
    isActive: record.isActive,
    changeReason: "",
  };
}

function buildPayload(values: BodegaPresentationInput): BodegaPresentationInput {
  const quantity = Number(values.presentationQuantity);
  const equivalent = values.equivalentBaseQuantity === null || values.equivalentBaseQuantity === undefined
    ? null
    : Number(values.equivalentBaseQuantity);

  return {
    productId: values.productId.trim(),
    commercialName: values.commercialName?.trim() || null,
    presentationCode: values.presentationCode.trim().toUpperCase(),
    presentationName: values.presentationName.trim(),
    packageName: values.packageName?.trim() || null,
    presentationQuantity: Number.isFinite(quantity) ? quantity : 0,
    presentationUnitId: values.presentationUnitId.trim(),
    equivalentBaseQuantity: equivalent !== null && Number.isFinite(equivalent) ? equivalent : null,
    allowsFractioning: values.allowsFractioning,
    operationalNote: values.operationalNote?.trim() || null,
    isActive: values.isActive,
    changeReason: values.changeReason?.trim() || null,
  };
}

function resolveAutoEquivalent(
  presentationUnit: BodegaUnitRecord | null,
  baseUnit: BodegaUnitRecord | null,
  presentationQuantity: number,
) {
  if (!presentationUnit || !baseUnit || !Number.isFinite(presentationQuantity) || presentationQuantity <= 0) {
    return null;
  }

  if (presentationUnit.unitId === baseUnit.unitId) {
    return presentationQuantity;
  }

  if (presentationUnit.dimension !== baseUnit.dimension) {
    return null;
  }

  const sourceFactor = UNIT_CONVERSION_FACTORS[presentationUnit.code];
  const targetFactor = UNIT_CONVERSION_FACTORS[baseUnit.code];
  if (!sourceFactor || !targetFactor) {
    return null;
  }

  return Math.round(((presentationQuantity * sourceFactor) / targetFactor) * 1_000_000) / 1_000_000;
}

function validateForm(
  values: BodegaPresentationInput,
  products: BodegaProductRecord[],
  units: BodegaUnitRecord[],
  autoEquivalentBaseQuantity: number | null,
): FormErrors {
  const payload = buildPayload(values);
  const errors: FormErrors = {};

  if (!payload.productId) {
    errors.productSearch = "Debes seleccionar un producto maestro valido.";
  } else if (!products.some((product) => product.productId === payload.productId)) {
    errors.productSearch = "El producto seleccionado ya no existe o no esta activo.";
  }

  if (!payload.presentationCode) errors.presentationCode = "El codigo de la presentacion es obligatorio.";
  if (!payload.presentationName) errors.presentationName = "Debes describir como viene la presentacion.";
  if (!payload.presentationUnitId) errors.presentationUnitId = "Debes seleccionar la unidad del contenido.";
  if (!Number.isFinite(payload.presentationQuantity) || payload.presentationQuantity <= 0) {
    errors.presentationQuantity = "La cantidad de la presentacion debe ser mayor a cero.";
  }

  const selectedUnit = units.find((unit) => unit.unitId === payload.presentationUnitId) ?? null;
  if (payload.presentationUnitId && !selectedUnit) {
    errors.presentationUnitId = "La unidad seleccionada ya no existe en el maestro.";
  }

  if (autoEquivalentBaseQuantity === null) {
    if (payload.equivalentBaseQuantity === null || !Number.isFinite(Number(payload.equivalentBaseQuantity)) || Number(payload.equivalentBaseQuantity) <= 0) {
      errors.equivalentBaseQuantity = "Debes registrar la conversion manual a la unidad base del producto.";
    }
  }

  return errors;
}

export function BodegaPresentacionesPage({
  initialPresentations,
  initialProducts,
  initialUnits,
  initialError,
}: BodegaPresentacionesPageProps) {
  const [editorMode, setEditorMode] = useState<EditorMode>("create");
  const [selectedPresentationId, setSelectedPresentationId] = useState<string | null>(initialPresentations[0]?.presentationId ?? null);
  const [search, setSearch] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [formValues, setFormValues] = useState<BodegaPresentationInput>(EMPTY_FORM_VALUES);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const deferredSearch = useDeferredValue(search);

  const { data: presentationsData, isValidating: isValidatingPresentations, mutate: mutatePresentations } = useSWR(
    "/api/bodega/administrar-maestros/presentaciones-conversiones",
    presentationsFetcher,
    {
      fallbackData: initialPresentations,
      revalidateOnFocus: false,
      dedupingInterval: 15000,
      onError: (error) => toast.error(error?.message || "No se pudo cargar el maestro de presentaciones."),
    },
  );
  const { data: productsData } = useSWR(
    "/api/bodega/administrar-maestros/productos",
    productsFetcher,
    {
      fallbackData: initialProducts,
      revalidateOnFocus: false,
      dedupingInterval: 15000,
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

  const presentations = presentationsData ?? initialPresentations;
  const products = productsData ?? initialProducts;
  const units = unitsData ?? initialUnits;

  const selectedRecord = editorMode === "edit"
    ? presentations.find((record) => record.presentationId === selectedPresentationId) ?? null
    : null;

  const selectedProduct = products.find((product) => product.productId === formValues.productId) ?? null;
  const selectedPresentationUnit = units.find((unit) => unit.unitId === formValues.presentationUnitId) ?? null;
  const selectedBaseUnit = selectedProduct
    ? units.find((unit) => unit.unitId === selectedProduct.baseUnitId) ?? null
    : null;
  const autoEquivalentBaseQuantity = useMemo(
    () => resolveAutoEquivalent(selectedPresentationUnit, selectedBaseUnit, Number(formValues.presentationQuantity)),
    [selectedPresentationUnit, selectedBaseUnit, formValues.presentationQuantity],
  );
  const effectiveEquivalentBaseQuantity = autoEquivalentBaseQuantity ?? (
    formValues.equivalentBaseQuantity === null || formValues.equivalentBaseQuantity === undefined
      ? null
      : Number(formValues.equivalentBaseQuantity)
  );
  const requiresManualConversion = Boolean(
    selectedPresentationUnit
    && selectedBaseUnit
    && autoEquivalentBaseQuantity === null,
  );
  const selectedConversionModeLabel = autoEquivalentBaseQuantity !== null
    ? "Automatica"
    : effectiveEquivalentBaseQuantity !== null
      ? "Manual"
      : "Pendiente";

  const baselinePayload = useMemo(
    () => buildPayload(selectedRecord ? mapRecordToFormValues(selectedRecord) : EMPTY_FORM_VALUES),
    [selectedRecord],
  );
  const currentPayload = useMemo(() => {
    const payload = buildPayload(formValues);
    return {
      ...payload,
      equivalentBaseQuantity: autoEquivalentBaseQuantity ?? payload.equivalentBaseQuantity,
    };
  }, [formValues, autoEquivalentBaseQuantity]);
  const isDirty = JSON.stringify(currentPayload) !== JSON.stringify(baselinePayload);

  const filteredRecords = useMemo(() => {
    const normalized = deferredSearch.trim().toLowerCase();
    if (!normalized) return presentations;

    return presentations.filter((record) => {
      return [
        record.presentationCode,
        record.presentationName,
        record.productCode,
        record.productName,
        record.commercialName,
      ].some((value) => String(value ?? "").toLowerCase().includes(normalized));
    });
  }, [deferredSearch, presentations]);

  const summary = useMemo(() => {
    const latest = presentations.reduce<(typeof presentations)[number] | null>(
      (best, record) => {
        if (!record.loadedAt) return best;
        if (!best || String(record.loadedAt) > String(best.loadedAt)) return record;
        return best;
      },
      null,
    );

    return {
      totalPresentations: presentations.length,
      totalProducts: products.length,
      totalUnits: units.length,
      latest,
    };
  }, [presentations, products, units]);

  useEffect(() => {
    const nextForm = selectedRecord ? mapRecordToFormValues(selectedRecord) : EMPTY_FORM_VALUES;
    setFormValues(nextForm);
    const nextProduct = selectedRecord
      ? products.find((product) => product.productId === selectedRecord.productId) ?? null
      : null;
    setProductSearch(nextProduct ? formatProductOption(nextProduct) : "");
    setFormErrors({});
  }, [selectedRecord, products]);

  function updateField<Key extends keyof BodegaPresentationInput>(field: Key, value: BodegaPresentationInput[Key]) {
    setFormValues((current) => ({ ...current, [field]: value }));
    setFormErrors((current) => ({ ...current, [field]: undefined }));
  }

  function updateProductSearch(value: string) {
    setProductSearch(value);
    const match = findProductFromSearch(value, products);
    updateField("productId", match?.productId ?? "");
    setFormErrors((current) => ({ ...current, productSearch: undefined }));
  }

  function resolveProductSearch() {
    const match = findProductFromSearch(productSearch, products);
    if (match) {
      setProductSearch(formatProductOption(match));
      updateField("productId", match.productId);
      return;
    }

    if (!productSearch.trim()) {
      updateField("productId", "");
    }
  }

  function openCreateMode() {
    startTransition(() => {
      setEditorMode("create");
      setSelectedPresentationId(null);
    });
  }

  function openEditMode(presentationId: string) {
    startTransition(() => {
      setEditorMode("edit");
      setSelectedPresentationId(presentationId);
    });
  }

  function resetForm() {
    const nextForm = selectedRecord ? mapRecordToFormValues(selectedRecord) : EMPTY_FORM_VALUES;
    setFormValues(nextForm);
    const nextProduct = selectedRecord
      ? products.find((product) => product.productId === selectedRecord.productId) ?? null
      : null;
    setProductSearch(nextProduct ? formatProductOption(nextProduct) : "");
    setFormErrors({});
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextErrors = validateForm(formValues, products, units, autoEquivalentBaseQuantity);
    setFormErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      toast.error("Revisa los campos obligatorios y la conversion de la presentacion antes de guardar.");
      return;
    }

    setIsSaving(true);

    try {
      const isEditing = editorMode === "edit" && selectedPresentationId;
      const endpoint = isEditing
        ? `/api/bodega/administrar-maestros/presentaciones-conversiones/${encodeURIComponent(selectedPresentationId)}`
        : "/api/bodega/administrar-maestros/presentaciones-conversiones";
      const method = isEditing ? "PATCH" : "POST";
      const response = await fetchJson<BodegaPresentationPayload>(
        endpoint,
        "No se pudo guardar la presentacion.",
        {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(currentPayload),
        },
      );

      toast.success(isEditing ? "Presentacion actualizada correctamente." : "Presentacion creada correctamente.");
      await mutatePresentations();
      startTransition(() => {
        setEditorMode("edit");
        setSelectedPresentationId(response.data.presentationId);
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar la presentacion.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <SectionPageShell
        eyebrow="Administración / Maestros por dominio / Bodega / Presentaciones y conversiones"
        title="Presentaciones y conversiones"
        subtitle="Cada presentacion comercial cuelga de un producto maestro y siempre aterriza el inventario en la unidad base dominante del producto."
        icon={<Boxes className="size-5" aria-hidden="true" />}
        actions={(
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" className="rounded-full" onClick={() => void mutatePresentations()}>
              <RefreshCcw className={cn("size-4", isValidatingPresentations && "animate-spin")} />
              Recargar
            </Button>
            <Button type="button" className="rounded-full" onClick={openCreateMode}>
              <Plus className="size-4" />
              Nueva presentacion
            </Button>
          </div>
        )}
      >
        <FilterPanel>
          <KpiGrid>
            <MetricTile label="Presentaciones activas" value={String(summary.totalPresentations)} hint="Variantes comerciales ya homologadas." />
            <MetricTile label="Productos maestros" value={String(summary.totalProducts)} hint="Catalogo base disponible para colgar presentaciones." />
            <MetricTile label="Unidades disponibles" value={String(summary.totalUnits)} hint="Conversiones contra la unidad base del producto." />
            <MetricTile label="Ultima carga" value={summary.latest?.loadedAt ? formatDateTime(summary.latest.loadedAt) : "-"} hint="Ultima presentacion guardada o actualizada." />
          </KpiGrid>

          {initialError ? (
            <div className="rounded-[24px] border border-slate-300/60 bg-slate-500/10 px-4 py-3 text-sm text-slate-950 dark:text-slate-100">
              {initialError}
            </div>
          ) : null}
        </FilterPanel>
      </SectionPageShell>

      <div className="grid gap-4 xl:grid-cols-[0.92fr_1.08fr]">
        <Card className="starter-panel border-border/70 bg-card/84">
          <CardHeader className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-slate-900/10 p-3 text-slate-700 dark:bg-slate-900/20 dark:text-white">
                <Boxes className="size-5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <CardTitle className="text-lg">Listado de presentaciones</CardTitle>
                <CardDescription>Selecciona una presentacion para editarla o crea una nueva.</CardDescription>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="bodega-presentaciones-search">Buscar presentacion</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="bodega-presentaciones-search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar por codigo, producto o nombre comercial…"
                  className="pl-10"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="relative overflow-hidden pt-1">
            <div className="max-h-[calc(100dvh-16rem)] space-y-3 overflow-y-auto pr-1 pb-6">
              {filteredRecords.length ? filteredRecords.map((record) => {
                const isSelected = editorMode === "edit" && selectedPresentationId === record.presentationId;

                return (
                  <button
                    key={record.presentationId}
                    type="button"
                    onClick={() => openEditMode(record.presentationId)}
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
                          <p className="text-base font-semibold">{record.presentationCode}</p>
                          <Badge
                            variant={isSelected ? "secondary" : "outline"}
                            className={cn("rounded-full px-3 py-1", isSelected && "border-white/20 bg-white/12 text-white")}
                          >
                            {record.baseUnitCode ?? "-"}
                          </Badge>
                        </div>
                        <p className={cn("text-sm font-medium", isSelected ? "text-white/90" : "text-foreground")}>
                          {record.presentationName}
                        </p>
                        {record.commercialName ? (
                          <p className={cn("text-xs", isSelected ? "text-white/80" : "text-muted-foreground")}>
                            {record.commercialName}
                          </p>
                        ) : null}
                        <p className={cn("text-xs", isSelected ? "text-white/75" : "text-muted-foreground")}>
                          {record.productCode} - {record.productName}
                        </p>
                        <p className={cn("text-xs", isSelected ? "text-white/75" : "text-muted-foreground")}>
                          {record.presentationQuantity} {record.presentationUnitCode} {"->"} {record.equivalentBaseQuantity} {record.baseUnitCode ?? "-"}
                        </p>
                      </div>
                      <PencilLine className={cn("size-4 shrink-0", isSelected ? "text-white" : "text-muted-foreground")} />
                    </div>
                  </button>
                );
              }) : (
                <div className="rounded-[24px] border border-dashed border-border/70 bg-background/80 px-4 py-8 text-center text-sm text-muted-foreground">
                  No hay presentaciones que coincidan con el filtro actual.
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
                    {editorMode === "edit" ? "Editar version vigente" : "Nueva presentacion"}
                  </Badge>
                  {selectedRecord ? (
                    <Badge variant="secondary" className="rounded-full px-3 py-1">
                      {selectedRecord.baseUnitCode ?? "-"}
                    </Badge>
                  ) : null}
                </div>
                <div>
                  <CardTitle className="text-lg">{selectedRecord ? selectedRecord.presentationName : "Registrar presentacion"}</CardTitle>
                  <CardDescription>Define la variante comercial y su conversion a la unidad base dominante del producto.</CardDescription>
                </div>
              </div>
              <div className="rounded-full bg-slate-900/10 p-3 text-slate-700 dark:bg-slate-900/20 dark:text-white">
                <Boxes className="size-5" aria-hidden="true" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {!products.length || !units.length ? (
              <div className="rounded-[24px] border border-dashed border-border/70 bg-background/80 px-5 py-6 text-sm text-muted-foreground">
                {!products.length ? "Primero debes contar con productos maestros activos en Bodega." : null}
                {!products.length && !units.length ? " " : null}
                {!units.length ? "Tambien necesitas unidades activas para registrar la conversion." : null}
              </div>
            ) : (
              <form className="space-y-6" onSubmit={onSubmit}>
                <div className="grid gap-5 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="presentation-product-search">Producto maestro por codigo o nombre</Label>
                    <Input
                      id="presentation-product-search"
                      list="bodega-product-options"
                      className="rounded-xl"
                      value={productSearch}
                      onChange={(event) => updateProductSearch(event.target.value)}
                      onBlur={resolveProductSearch}
                      placeholder="Ej. EC153 o Capuchon Xlence…"
                    />
                    <datalist id="bodega-product-options">
                      {products.map((product) => (
                        <option key={`${product.productId}-fmt`} value={formatProductOption(product)} />
                      ))}
                      {products.map((product) => (
                        <option key={`${product.productId}-code`} value={product.productCode} />
                      ))}
                      {products.map((product) => (
                        <option key={`${product.productId}-name`} value={product.productName} />
                      ))}
                    </datalist>
                    {formErrors.productSearch ? <p className="text-xs text-destructive">{formErrors.productSearch}</p> : null}
                    {!formErrors.productSearch && selectedProduct ? (
                      <p className="text-xs text-muted-foreground">
                        Seleccionado: {selectedProduct.productCode} - {selectedProduct.productName}
                      </p>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="presentation-base-unit">Unidad base dominante del producto</Label>
                    <Input
                      id="presentation-base-unit"
                      className="rounded-xl"
                      value={selectedBaseUnit ? formatUnitOption(selectedBaseUnit) : "Selecciona primero el producto"}
                      disabled
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="presentation-product-name">Nombre oficial del producto</Label>
                    <Input
                      id="presentation-product-name"
                      className="rounded-xl"
                      value={selectedProduct?.productName ?? "Se completa automaticamente al elegir el producto maestro"}
                      disabled
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="presentation-code">Codigo de presentacion</Label>
                    <Input
                      id="presentation-code"
                      className="rounded-xl"
                      value={formValues.presentationCode}
                      onChange={(event) => updateField("presentationCode", event.target.value)}
                    />
                    {formErrors.presentationCode ? <p className="text-xs text-destructive">{formErrors.presentationCode}</p> : null}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="presentation-commercial-name">Nombre comercial</Label>
                    <Input
                      id="presentation-commercial-name"
                      className="rounded-xl"
                      value={formValues.commercialName ?? ""}
                      onChange={(event) => updateField("commercialName", event.target.value)}
                      placeholder="Ej. Acido citrico grado agricola"
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="presentation-name">Presentacion visible en bodega</Label>
                    <Input
                      id="presentation-name"
                      className="rounded-xl"
                      value={formValues.presentationName}
                      onChange={(event) => updateField("presentationName", event.target.value)}
                      placeholder="Ej. Saco 50 KG, Caneca 20 LT o Caja x 24 unidades"
                    />
                    {formErrors.presentationName ? <p className="text-xs text-destructive">{formErrors.presentationName}</p> : null}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="presentation-package-name">Envase o empaque</Label>
                    <Input
                      id="presentation-package-name"
                      className="rounded-xl"
                      value={formValues.packageName ?? ""}
                      onChange={(event) => updateField("packageName", event.target.value)}
                      placeholder="Ej. Saco, Caneca, Bidon, Caja"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="presentation-status">Estado</Label>
                    <select
                      id="presentation-status"
                      className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                      value={formValues.isActive ? "active" : "inactive"}
                      onChange={(event) => updateField("isActive", event.target.value === "active")}
                    >
                      <option value="active">Activa</option>
                      <option value="inactive">Inactiva</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="presentation-quantity">Cantidad por presentacion</Label>
                    <Input
                      id="presentation-quantity"
                      type="number"
                      step="0.000001"
                      className="rounded-xl"
                      value={formValues.presentationQuantity || ""}
                      onChange={(event) => updateField("presentationQuantity", Number(event.target.value))}
                    />
                    {formErrors.presentationQuantity ? <p className="text-xs text-destructive">{formErrors.presentationQuantity}</p> : null}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="presentation-unit">Unidad del contenido presentado</Label>
                    <select
                      id="presentation-unit"
                      className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                      value={formValues.presentationUnitId}
                      onChange={(event) => updateField("presentationUnitId", event.target.value)}
                    >
                      <option value="">Selecciona una unidad</option>
                      {units.reduce<ReactNode[]>((acc, unit) => {
                        if (unit.isActive) acc.push(
                          <option key={unit.unitId} value={unit.unitId}>
                            {formatUnitOption(unit)}
                          </option>
                        );
                        return acc;
                      }, [])}
                    </select>
                    {formErrors.presentationUnitId ? <p className="text-xs text-destructive">{formErrors.presentationUnitId}</p> : null}
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="presentation-equivalent-base">
                      Equivalencia a unidad base {selectedBaseUnit ? `(${selectedBaseUnit.code})` : ""}
                    </Label>
                    <Input
                      id="presentation-equivalent-base"
                      type="number"
                      step="0.000001"
                      className="rounded-xl"
                      value={autoEquivalentBaseQuantity ?? formValues.equivalentBaseQuantity ?? ""}
                      onChange={(event) => updateField("equivalentBaseQuantity", event.target.value === "" ? null : Number(event.target.value))}
                      disabled={autoEquivalentBaseQuantity !== null}
                      placeholder={autoEquivalentBaseQuantity !== null ? "Se calcula automaticamente" : "Ingresa la conversion manual"}
                    />
                    {formErrors.equivalentBaseQuantity ? <p className="text-xs text-destructive">{formErrors.equivalentBaseQuantity}</p> : null}
                    <p className="text-xs text-muted-foreground">
                      {autoEquivalentBaseQuantity !== null
                        ? "La conversion es automatica porque la unidad del contenido comparte dimension con la unidad base del producto."
                        : "Si la unidad del contenido no se puede convertir automaticamente, debes registrar la equivalencia manual para que el inventario quede en la unidad dominante del producto."}
                    </p>
                  </div>

                  {requiresManualConversion ? (
                    <div className="md:col-span-2 rounded-[20px] border border-amber-300/70 bg-amber-50/80 px-4 py-3 text-sm text-amber-950 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-100">
                      No existe una conversion automatica entre {selectedPresentationUnit?.code} y {selectedBaseUnit?.code}. Debes indicar manualmente cuantos {selectedBaseUnit?.code} representa 1 presentacion para poder guardar.
                    </div>
                  ) : null}

                  <div className="space-y-2">
                    <Label htmlFor="presentation-fractioning">Permite fraccionamiento</Label>
                    <select
                      id="presentation-fractioning"
                      className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                      value={formValues.allowsFractioning ? "yes" : "no"}
                      onChange={(event) => updateField("allowsFractioning", event.target.value === "yes")}
                    >
                      <option value="yes">Si</option>
                      <option value="no">No</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="presentation-reason">Motivo de cambio</Label>
                    <Input
                      id="presentation-reason"
                      className="rounded-xl"
                      value={formValues.changeReason ?? ""}
                      onChange={(event) => updateField("changeReason", event.target.value)}
                      placeholder="Opcional"
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="presentation-note">Nota operativa</Label>
                    <textarea
                      id="presentation-note"
                      rows={3}
                      className="flex min-h-[96px] w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                      value={formValues.operationalNote ?? ""}
                      onChange={(event) => updateField("operationalNote", event.target.value)}
                      placeholder="Ej. Bodega compra por saco, pero consumo se descuenta en KG."
                    />
                  </div>
                </div>

                <div className="rounded-[22px] border border-border/70 bg-background/75 px-4 py-4 text-sm">
                  <p className="font-semibold">Resumen de conversion</p>
                  <div className="mt-3 space-y-2 text-muted-foreground">
                    <p>Producto maestro: {selectedProduct ? `${selectedProduct.productCode} - ${selectedProduct.productName}` : "Sin seleccionar"}</p>
                    <p>Unidad base dominante: {selectedBaseUnit ? `${selectedBaseUnit.code} - ${selectedBaseUnit.name}` : "Pendiente"}</p>
                    <p>Modo de conversion: {selectedConversionModeLabel}</p>
                    <p>
                      Resultado inventariable:
                      {" "}
                      {effectiveEquivalentBaseQuantity !== null && selectedBaseUnit
                        ? `1 presentacion = ${effectiveEquivalentBaseQuantity} ${selectedBaseUnit.code}`
                        : "Pendiente de conversion"}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap justify-end gap-2">
                  <Button type="button" variant="outline" className="rounded-full" onClick={resetForm} disabled={!isDirty || isSaving}>
                    Restablecer
                  </Button>
                  <Button type="submit" className="rounded-full" disabled={isSaving}>
                    {isSaving ? (
                      <>Guardando…</>
                    ) : (
                      <>
                        <Save className="size-4" />
                        Guardar presentacion
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
