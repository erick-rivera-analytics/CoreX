"use client";

import { startTransition, useDeferredValue, useEffect, useMemo, useState } from "react";
import {
  DatabaseZap,
  LoaderCircle,
  PackageCheck,
  PencilLine,
  Plus,
  RefreshCcw,
  Save,
  Search,
  WandSparkles,
} from "lucide-react";
import { toast } from "sonner";
import useSWR from "swr";

import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { MetricTile } from "@/shared/data-display/metric-tile";
import { FilterPanel, KpiGrid } from "@/shared/layout/filter-panel";
import { SectionPageShell } from "@/shared/layout/section-page-shell";
import { formatDateTime, formatDecimal } from "@/shared/lib/format";
import { toNumber } from "@/shared/lib/number-utils";
import { fetchJson } from "@/lib/fetch-json";
import type {
  PoscosechaSkuInput,
  PoscosechaSkuPayload,
  PoscosechaSkuRecord,
} from "@/lib/postcosecha-sku-types";
import { cn } from "@/lib/utils";

type PoscosechaSkusExplorerProps = {
  initialData: PoscosechaSkuRecord[];
  initialError?: string | null;
};

type EditorMode = "create" | "edit";
type FormErrors = Partial<Record<keyof PoscosechaSkuInput, string>>;

const EMPTY_FORM_VALUES: PoscosechaSkuInput = {
  sku: "",
  pesoIdealBunch: 0,
  tallosMin: 1,
  tallosMax: 1,
  pesoMinObjetivo: 0,
  pesoMaxObjetivo: 0,
  maxGradosObjetivo: 3,
  changeReason: "",
};

const skuFetcher = (url: string) =>
  fetchJson<PoscosechaSkuRecord[]>(url, "No se pudo cargar el maestro de SKU.");

function toInteger(value: unknown, fallback = 0) {
  return Math.round(toNumber(value, fallback));
}

function mapRecordToFormValues(record: PoscosechaSkuRecord): PoscosechaSkuInput {
  return {
    sku: record.sku,
    pesoIdealBunch: record.pesoIdealBunch,
    tallosMin: record.tallosMin,
    tallosMax: record.tallosMax,
    pesoMinObjetivo: record.pesoMinObjetivo,
    pesoMaxObjetivo: record.pesoMaxObjetivo,
    maxGradosObjetivo: record.maxGradosObjetivo,
    changeReason: "",
  };
}

function buildPayload(values: PoscosechaSkuInput): PoscosechaSkuInput {
  return {
    sku: values.sku.trim(),
    pesoIdealBunch: toNumber(values.pesoIdealBunch, 0),
    tallosMin: toInteger(values.tallosMin, 1),
    tallosMax: toInteger(values.tallosMax, 1),
    pesoMinObjetivo: toNumber(values.pesoMinObjetivo, 0),
    pesoMaxObjetivo: toNumber(values.pesoMaxObjetivo, 0),
    maxGradosObjetivo: toInteger(values.maxGradosObjetivo, 3),
    changeReason: values.changeReason?.trim() || null,
  };
}

function validateForm(values: PoscosechaSkuInput): FormErrors {
  const payload = buildPayload(values);
  const errors: FormErrors = {};

  if (!payload.sku) {
    errors.sku = "El SKU es obligatorio.";
  }

  if (payload.pesoIdealBunch <= 0) {
    errors.pesoIdealBunch = "El peso ideal debe ser mayor a cero.";
  }

  if (payload.tallosMin < 1) {
    errors.tallosMin = "Los tallos minimos deben ser al menos 1.";
  }

  if (payload.tallosMax < payload.tallosMin) {
    errors.tallosMax = "Los tallos maximos no pueden ser menores a los minimos.";
  }

  if (payload.pesoMinObjetivo <= 0) {
    errors.pesoMinObjetivo = "El peso minimo objetivo debe ser mayor a cero.";
  }

  if (payload.pesoMaxObjetivo < payload.pesoMinObjetivo) {
    errors.pesoMaxObjetivo = "El peso maximo objetivo no puede ser menor al minimo.";
  }

  if (payload.maxGradosObjetivo < 1) {
    errors.maxGradosObjetivo = "El maximo de grados debe ser al menos 1.";
  }

  return errors;
}

export function PoscosechaSkusExplorer({
  initialData,
  initialError,
}: PoscosechaSkusExplorerProps) {
  const [editorMode, setEditorMode] = useState<EditorMode>("create");
  const [selectedSkuId, setSelectedSkuId] = useState<string | null>(initialData[0]?.skuId ?? null);
  const [search, setSearch] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [formValues, setFormValues] = useState<PoscosechaSkuInput>(EMPTY_FORM_VALUES);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const deferredSearch = useDeferredValue(search);

  const {
    data,
    error,
    isValidating,
    mutate,
  } = useSWR(
    "/api/postcosecha/administrar-maestros/skus",
    skuFetcher,
    {
      fallbackData: initialData,
      revalidateOnFocus: false,
      dedupingInterval: 15000,
    },
  );

  const records = data ?? initialData;
  const selectedRecord = editorMode === "edit"
    ? records.find((record) => record.skuId === selectedSkuId) ?? null
    : null;
  const baselinePayload = useMemo(
    () => buildPayload(selectedRecord ? mapRecordToFormValues(selectedRecord) : EMPTY_FORM_VALUES),
    [selectedRecord],
  );
  const currentPayload = useMemo(() => buildPayload(formValues), [formValues]);
  const isDirty = JSON.stringify(currentPayload) !== JSON.stringify(baselinePayload);

  const filteredRecords = useMemo(() => {
    const normalized = deferredSearch.trim().toLowerCase();

    if (!normalized) {
      return records;
    }

    return records.filter((record) => {
      return [
        record.sku,
        record.actorId,
        record.changeReason,
      ].some((value) => String(value ?? "").toLowerCase().includes(normalized));
    });
  }, [deferredSearch, records]);

  const summaries = useMemo(() => {
    const total = records.length;
    const latestRecord = [...records]
      .filter((record) => record.loadedAt)
      .sort((left, right) => String(right.loadedAt).localeCompare(String(left.loadedAt)))[0] ?? null;

    return {
      total,
      latestRecord,
    };
  }, [records]);

  useEffect(() => {
    if (error) {
      toast.error(error.message || "No se pudo cargar el maestro de SKU.");
    }
  }, [error]);

  useEffect(() => {
    setFormValues(selectedRecord ? mapRecordToFormValues(selectedRecord) : EMPTY_FORM_VALUES);
    setFormErrors({});
  }, [selectedRecord]);

  function updateField<Key extends keyof PoscosechaSkuInput>(
    field: Key,
    value: PoscosechaSkuInput[Key],
  ) {
    setFormValues((current) => ({
      ...current,
      [field]: value,
    }));

    setFormErrors((current) => ({
      ...current,
      [field]: undefined,
    }));
  }

  function openCreateMode() {
    startTransition(() => {
      setEditorMode("create");
      setSelectedSkuId(null);
    });
  }

  function openEditMode(skuId: string) {
    startTransition(() => {
      setEditorMode("edit");
      setSelectedSkuId(skuId);
    });
  }

  function resetForm() {
    setFormValues(selectedRecord ? mapRecordToFormValues(selectedRecord) : EMPTY_FORM_VALUES);
    setFormErrors({});
  }

  function applySuggestedWeightRange() {
    const pesoIdealBunch = toNumber(formValues.pesoIdealBunch, 0);

    if (pesoIdealBunch <= 0) {
      toast.error("Define primero el peso ideal del bunch.");
      return;
    }

    setFormValues((current) => ({
      ...current,
      pesoMinObjetivo: Math.round(pesoIdealBunch * 97) / 100,
      pesoMaxObjetivo: Math.round(pesoIdealBunch * 103) / 100,
    }));
    toast.success("Se aplico el rango sugerido de +/- 3%.");
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
      const isEditing = editorMode === "edit" && selectedSkuId;
      const endpoint = isEditing
        ? `/api/postcosecha/administrar-maestros/skus/${encodeURIComponent(selectedSkuId)}`
        : "/api/postcosecha/administrar-maestros/skus";
      const method = isEditing ? "PATCH" : "POST";
      const response = await fetchJson<PoscosechaSkuPayload>(
        endpoint,
        "No se pudo guardar el SKU.",
        {
          method,
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(currentPayload),
        },
      );

      toast.success(isEditing ? "SKU actualizado correctamente." : "SKU creado correctamente.");
      await mutate();
      startTransition(() => {
        setEditorMode("edit");
        setSelectedSkuId(response.data.skuId);
      });
    } catch (submitError) {
      toast.error(
        submitError instanceof Error
          ? submitError.message
          : "No se pudo guardar el SKU.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <SectionPageShell
        eyebrow="Gestión / Postcosecha / Administrar Maestros"
        title="Administrar SKU's"
        subtitle="Gestiona el catalogo de SKU de postcosecha. Cada guardado crea una nueva version vigente y conserva trazabilidad SCD2 en db_postharvest.public."
        icon={<DatabaseZap className="size-5" aria-hidden="true" />}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              onClick={() => {
                void mutate();
              }}
            >
              <RefreshCcw className={cn("size-4", isValidating && "animate-spin")} />
              Recargar
            </Button>
            <Button
              type="button"
              className="rounded-full"
              onClick={openCreateMode}
            >
              <Plus className="size-4" />
              Nuevo SKU
            </Button>
          </div>
        }
      >
        <FilterPanel>
          <KpiGrid>
            <MetricTile
              label="SKU activos"
              value={String(summaries.total)}
              hint="Catalogo actual disponible para planificacion y solver."
            />
            <MetricTile
              label="Ultima carga"
              value={summaries.latestRecord?.loadedAt ? formatDateTime(summaries.latestRecord.loadedAt) : "-"}
              hint="Se actualiza al crear o guardar una nueva version."
            />
            <MetricTile
              label="Ultimo actor"
              value={summaries.latestRecord?.actorId ?? "-"}
              hint="Usuario que genero la ultima version vigente."
            />
            <MetricTile
              label="Ultimo motivo"
              value={summaries.latestRecord?.changeReason ?? "Sin motivo"}
              hint="Motivo de cambio registrado en la ultima carga."
            />
          </KpiGrid>

          {initialError ? (
            <div className="rounded-[24px] border border-slate-300/60 bg-slate-500/10 px-4 py-3 text-sm text-slate-950 dark:text-slate-100">
              {initialError}
            </div>
          ) : null}
        </FilterPanel>
      </SectionPageShell>

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Card className="starter-panel border-border/70 bg-card/84">
          <CardHeader className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-slate-900/10 p-3 text-slate-700 dark:bg-slate-900/20 dark:text-white">
                <PackageCheck className="size-5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <CardTitle className="text-lg">Listado maestro</CardTitle>
                <CardDescription>
                  Selecciona un SKU para editar su version vigente o crea uno nuevo.
                </CardDescription>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="postcosecha-sku-search">Buscar SKU</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="postcosecha-sku-search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar por SKU, actor o motivo de cambio..."
                  className="pl-10"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-1">
            <div className="max-h-[calc(100dvh-16rem)] space-y-4 overflow-y-auto pr-1">
              {filteredRecords.length ? filteredRecords.map((record) => {
                const isSelected = editorMode === "edit" && selectedSkuId === record.skuId;

                return (
                  <button
                    key={record.skuId}
                    type="button"
                    onClick={() => openEditMode(record.skuId)}
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
                          <p className="text-base font-semibold">{record.sku}</p>
                          <Badge
                            variant={isSelected ? "secondary" : "outline"}
                            className={cn(
                              "rounded-full px-3 py-1",
                              isSelected && "border-white/20 bg-white/12 text-white",
                            )}
                          >
                            {record.tallosMin}-{record.tallosMax} tallos
                          </Badge>
                        </div>
                        <p className={cn("text-sm", isSelected ? "text-white/80" : "text-muted-foreground")}>
                          Ideal bunch: {formatDecimal(record.pesoIdealBunch)} g | Rango objetivo:
                          {" "}
                          {formatDecimal(record.pesoMinObjetivo)} - {formatDecimal(record.pesoMaxObjetivo)} g
                        </p>
                      </div>
                      <PencilLine className={cn("size-4 shrink-0", isSelected ? "text-white" : "text-muted-foreground")} />
                    </div>
                    <div className={cn("mt-3 text-xs", isSelected ? "text-white/70" : "text-muted-foreground")}>
                      Ultima version: {formatDateTime(record.loadedAt)} | Actor: {record.actorId ?? "-"}
                    </div>
                  </button>
                );
              }) : (
                <div className="rounded-[24px] border border-dashed border-border/70 bg-background/80 px-4 py-8 text-center text-sm text-muted-foreground">
                  No hay SKU que coincidan con el filtro actual.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="starter-panel border-border/70 bg-card/84 xl:sticky xl:top-4 xl:self-start">
          <CardHeader className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="rounded-full px-3 py-1">
                    {editorMode === "edit" ? "Editar version vigente" : "Nuevo SKU"}
                  </Badge>
                  {selectedRecord ? (
                    <Badge variant="secondary" className="rounded-full px-3 py-1">
                      SCD2 activo
                    </Badge>
                  ) : null}
                </div>
                <div>
                  <CardTitle className="text-lg">
                    {selectedRecord ? selectedRecord.sku : "Registrar SKU"}
                  </CardTitle>
                  <CardDescription>
                    Usa este formulario para crear o actualizar el maestro que alimenta el solver de
                    clasificacion en blanco.
                  </CardDescription>
                </div>
              </div>
              <div className="rounded-full bg-slate-900/10 p-3 text-slate-700 dark:bg-slate-900/20 dark:text-white">
                <DatabaseZap className="size-5" aria-hidden="true" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form className="space-y-6" onSubmit={onSubmit}>
              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="sku-name">SKU</Label>
                  <p className="text-xs text-muted-foreground">Nombre maestro visible para pedidos y solver.</p>
                  <Input
                    id="sku-name"
                    placeholder="Ej. BLANCO STANDARD 60"
                    className="rounded-xl"
                    value={formValues.sku}
                    onChange={(event) => updateField("sku", event.target.value)}
                  />
                  {formErrors.sku ? (
                    <p className="text-xs text-destructive">{formErrors.sku}</p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="peso-ideal-bunch">Peso ideal bunch (g)</Label>
                  <Input
                    id="peso-ideal-bunch"
                    type="number"
                    step="0.01"
                    min="0"
                    className="rounded-xl"
                    value={formValues.pesoIdealBunch}
                    onChange={(event) => updateField("pesoIdealBunch", toNumber(event.target.value, 0))}
                  />
                  {formErrors.pesoIdealBunch ? (
                    <p className="text-xs text-destructive">{formErrors.pesoIdealBunch}</p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="max-grados-objetivo">Max grados objetivo</Label>
                  <Input
                    id="max-grados-objetivo"
                    type="number"
                    min="1"
                    step="1"
                    className="rounded-xl"
                    value={formValues.maxGradosObjetivo}
                    onChange={(event) => updateField("maxGradosObjetivo", toInteger(event.target.value, 3))}
                  />
                  {formErrors.maxGradosObjetivo ? (
                    <p className="text-xs text-destructive">{formErrors.maxGradosObjetivo}</p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tallos-min">Tallos min</Label>
                  <Input
                    id="tallos-min"
                    type="number"
                    min="1"
                    step="1"
                    className="rounded-xl"
                    value={formValues.tallosMin}
                    onChange={(event) => updateField("tallosMin", toInteger(event.target.value, 1))}
                  />
                  {formErrors.tallosMin ? (
                    <p className="text-xs text-destructive">{formErrors.tallosMin}</p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tallos-max">Tallos max</Label>
                  <Input
                    id="tallos-max"
                    type="number"
                    min="1"
                    step="1"
                    className="rounded-xl"
                    value={formValues.tallosMax}
                    onChange={(event) => updateField("tallosMax", toInteger(event.target.value, 1))}
                  />
                  {formErrors.tallosMax ? (
                    <p className="text-xs text-destructive">{formErrors.tallosMax}</p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="peso-min-objetivo">Peso min objetivo (g)</Label>
                  <Input
                    id="peso-min-objetivo"
                    type="number"
                    step="0.01"
                    min="0"
                    className="rounded-xl"
                    value={formValues.pesoMinObjetivo}
                    onChange={(event) => updateField("pesoMinObjetivo", toNumber(event.target.value, 0))}
                  />
                  {formErrors.pesoMinObjetivo ? (
                    <p className="text-xs text-destructive">{formErrors.pesoMinObjetivo}</p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="peso-max-objetivo">Peso max objetivo (g)</Label>
                  <Input
                    id="peso-max-objetivo"
                    type="number"
                    step="0.01"
                    min="0"
                    className="rounded-xl"
                    value={formValues.pesoMaxObjetivo}
                    onChange={(event) => updateField("pesoMaxObjetivo", toNumber(event.target.value, 0))}
                  />
                  {formErrors.pesoMaxObjetivo ? (
                    <p className="text-xs text-destructive">{formErrors.pesoMaxObjetivo}</p>
                  ) : null}
                </div>

                <div className="space-y-2 md:col-span-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Label htmlFor="change-reason">Motivo del cambio</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="rounded-full"
                      onClick={applySuggestedWeightRange}
                    >
                      <WandSparkles className="size-4" />
                      Usar rango sugerido
                    </Button>
                  </div>
                  <Input
                    id="change-reason"
                    placeholder="Ej. Ajuste por nueva ventana operativa"
                    className="rounded-xl"
                    value={formValues.changeReason ?? ""}
                    onChange={(event) => updateField("changeReason", event.target.value)}
                  />
                </div>
              </div>

              <div className="rounded-[24px] border border-border/70 bg-background/80 px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Preview rapido</p>
                    <p className="text-sm text-muted-foreground">
                      Peso ideal actual: {formatDecimal(toNumber(formValues.pesoIdealBunch, 0))} g. Al guardar,
                      la lista y la fecha de ultima carga se actualizan en tiempo real.
                    </p>
                    <p className="text-sm text-muted-foreground">
                      En base, cada cambio cierra la version anterior con `valid_to` y crea una nueva
                      fila vigente con `valid_from`, `loaded_at`, `run_id`, `actor_id` y `change_reason`.
                    </p>
                  </div>
                  {selectedRecord ? (
                    <div className="text-right text-xs text-muted-foreground">
                      <p>Version vigente desde {formatDateTime(selectedRecord.validFrom)}</p>
                      <p>Ultimo actor: {selectedRecord.actorId ?? "-"}</p>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-wrap justify-end gap-3 border-t border-border/60 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full"
                  onClick={resetForm}
                >
                  Restablecer
                </Button>
                <Button
                  type="submit"
                  className="rounded-full"
                  disabled={isSaving || (!isDirty && editorMode === "edit")}
                >
                  {isSaving ? (
                    <LoaderCircle className="size-4 animate-spin" />
                  ) : (
                    <Save className="size-4" />
                  )}
                  {editorMode === "edit" ? "Guardar cambios" : "Crear SKU"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
