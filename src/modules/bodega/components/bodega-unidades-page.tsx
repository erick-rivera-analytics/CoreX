"use client";

import { startTransition, useDeferredValue, useEffect, useMemo, useState } from "react";
import { DatabaseZap, PencilLine, Plus, RefreshCcw, Save, Scale, Search } from "lucide-react";
import { toast } from "sonner";
import useSWR from "swr";

import { fetchJson } from "@/lib/fetch-json";
import type { BodegaUnitDimension, BodegaUnitInput, BodegaUnitPayload, BodegaUnitRecord } from "@/lib/bodega-master-types";
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

type BodegaUnidadesPageProps = {
  initialData: BodegaUnitRecord[];
  initialError?: string | null;
};

type EditorMode = "create" | "edit";
type FormErrors = Partial<Record<keyof BodegaUnitInput, string>>;

const EMPTY_FORM_VALUES: BodegaUnitInput = {
  code: "",
  name: "",
  symbol: "",
  dimension: "Unidad",
  decimalPrecision: 0,
  isActive: true,
  changeReason: "",
};

const DIMENSION_OPTIONS: BodegaUnitDimension[] = ["Unidad", "Peso", "Volumen", "Longitud"];

const unitsFetcher = (url: string) =>
  fetchJson<BodegaUnitRecord[]>(url, "No se pudo cargar el maestro de unidades.");

function mapRecordToFormValues(record: BodegaUnitRecord): BodegaUnitInput {
  return {
    code: record.code,
    name: record.name,
    symbol: record.symbol,
    dimension: record.dimension,
    decimalPrecision: record.decimalPrecision,
    isActive: record.isActive,
    changeReason: "",
  };
}

function buildPayload(values: BodegaUnitInput): BodegaUnitInput {
  return {
    code: values.code.trim().toUpperCase(),
    name: values.name.trim(),
    symbol: values.symbol.trim(),
    dimension: values.dimension,
    decimalPrecision: Math.max(Math.round(Number(values.decimalPrecision) || 0), 0),
    isActive: values.isActive,
    changeReason: values.changeReason?.trim() || null,
  };
}

function validateForm(values: BodegaUnitInput): FormErrors {
  const payload = buildPayload(values);
  const errors: FormErrors = {};

  if (!payload.code) errors.code = "El codigo es obligatorio.";
  if (!payload.name) errors.name = "El nombre es obligatorio.";
  if (!payload.symbol) errors.symbol = "El simbolo es obligatorio.";

  return errors;
}

export function BodegaUnidadesPage({
  initialData,
  initialError,
}: BodegaUnidadesPageProps) {
  const [editorMode, setEditorMode] = useState<EditorMode>("create");
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(initialData[0]?.unitId ?? null);
  const [search, setSearch] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [formValues, setFormValues] = useState<BodegaUnitInput>(EMPTY_FORM_VALUES);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const deferredSearch = useDeferredValue(search);

  const { data, isValidating, mutate } = useSWR(
    "/api/bodega/administrar-maestros/unidades",
    unitsFetcher,
    {
      fallbackData: initialData,
      revalidateOnFocus: false,
      dedupingInterval: 15000,
      onError: (error) => toast.error(error?.message || "No se pudo cargar el maestro de unidades."),
    },
  );

  const records = data ?? initialData;
  const selectedRecord = editorMode === "edit"
    ? records.find((record) => record.unitId === selectedUnitId) ?? null
    : null;
  const baselinePayload = useMemo(
    () => buildPayload(selectedRecord ? mapRecordToFormValues(selectedRecord) : EMPTY_FORM_VALUES),
    [selectedRecord],
  );
  const currentPayload = useMemo(() => buildPayload(formValues), [formValues]);
  const isDirty = JSON.stringify(currentPayload) !== JSON.stringify(baselinePayload);

  const filteredRecords = useMemo(() => {
    const normalized = deferredSearch.trim().toLowerCase();
    if (!normalized) return records;

    return records.filter((record) => {
      return [record.code, record.name, record.symbol, record.actorId]
        .some((value) => String(value ?? "").toLowerCase().includes(normalized));
    });
  }, [deferredSearch, records]);

  const summary = useMemo(() => {
    const latest = records.reduce<(typeof records)[number] | null>(
      (best, record) => {
        if (!record.loadedAt) return best;
        if (!best || String(record.loadedAt) > String(best.loadedAt)) return record;
        return best;
      },
      null,
    );

    return {
      total: records.length,
      latest,
    };
  }, [records]);

  useEffect(() => {
    setFormValues(selectedRecord ? mapRecordToFormValues(selectedRecord) : EMPTY_FORM_VALUES);
    setFormErrors({});
  }, [selectedRecord]);

  function updateField<Key extends keyof BodegaUnitInput>(field: Key, value: BodegaUnitInput[Key]) {
    setFormValues((current) => ({ ...current, [field]: value }));
    setFormErrors((current) => ({ ...current, [field]: undefined }));
  }

  function openCreateMode() {
    startTransition(() => {
      setEditorMode("create");
      setSelectedUnitId(null);
    });
  }

  function openEditMode(unitId: string) {
    startTransition(() => {
      setEditorMode("edit");
      setSelectedUnitId(unitId);
    });
  }

  function resetForm() {
    setFormValues(selectedRecord ? mapRecordToFormValues(selectedRecord) : EMPTY_FORM_VALUES);
    setFormErrors({});
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
      const isEditing = editorMode === "edit" && selectedUnitId;
      const endpoint = isEditing
        ? `/api/bodega/administrar-maestros/unidades/${encodeURIComponent(selectedUnitId)}`
        : "/api/bodega/administrar-maestros/unidades";
      const method = isEditing ? "PATCH" : "POST";
      const response = await fetchJson<BodegaUnitPayload>(
        endpoint,
        "No se pudo guardar la unidad.",
        {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(currentPayload),
        },
      );

      toast.success(isEditing ? "Unidad actualizada correctamente." : "Unidad creada correctamente.");
      await mutate();
      startTransition(() => {
        setEditorMode("edit");
        setSelectedUnitId(response.data.unitId);
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar la unidad.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <SectionPageShell
        eyebrow="Gestion / Bodega / Administrar Maestros"
        title="Unidades"
        subtitle="Maestro operativo de unidades para Bodega. Cada guardado crea una nueva version vigente y conserva trazabilidad SCD2 en db_camp.public."
        icon={<Scale className="size-5" aria-hidden="true" />}
        actions={(
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
            <Button type="button" className="rounded-full" onClick={openCreateMode}>
              <Plus className="size-4" />
              Nueva unidad
            </Button>
          </div>
        )}
      >
        <FilterPanel>
          <KpiGrid>
            <MetricTile label="Unidades activas" value={String(summary.total)} hint="Catalogo disponible para productos y conversiones." />
            <MetricTile label="Ultima carga" value={summary.latest?.loadedAt ? formatDateTime(summary.latest.loadedAt) : "-"} hint="Fecha de la ultima version guardada." />
            <MetricTile label="Ultimo actor" value={summary.latest?.actorId ?? "-"} hint="Usuario que modifico el maestro por ultima vez." />
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
                <DatabaseZap className="size-5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <CardTitle className="text-lg">Listado de unidades</CardTitle>
                <CardDescription>Selecciona una unidad para editarla o crea una nueva.</CardDescription>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="bodega-unidades-search">Buscar unidad</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="bodega-unidades-search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar por codigo, nombre o simbolo..."
                  className="pl-10"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-1">
            <div className="max-h-[calc(100dvh-16rem)] space-y-3 overflow-y-auto pr-1">
              {filteredRecords.length ? filteredRecords.map((record) => {
                const isSelected = editorMode === "edit" && selectedUnitId === record.unitId;

                return (
                  <button
                    key={record.unitId}
                    type="button"
                    onClick={() => openEditMode(record.unitId)}
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
                          <p className="text-base font-semibold">{record.code}</p>
                          <Badge
                            variant={isSelected ? "secondary" : "outline"}
                            className={cn("rounded-full px-3 py-1", isSelected && "border-white/20 bg-white/12 text-white")}
                          >
                            {record.dimension}
                          </Badge>
                        </div>
                        <p className={cn("text-sm", isSelected ? "text-white/80" : "text-muted-foreground")}>
                          {record.name} · Simbolo: {record.symbol}
                        </p>
                      </div>
                      <PencilLine className={cn("size-4 shrink-0", isSelected ? "text-white" : "text-muted-foreground")} />
                    </div>
                  </button>
                );
              }) : (
                <div className="rounded-[24px] border border-dashed border-border/70 bg-background/80 px-4 py-8 text-center text-sm text-muted-foreground">
                  No hay unidades que coincidan con el filtro actual.
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
                    {editorMode === "edit" ? "Editar version vigente" : "Nueva unidad"}
                  </Badge>
                  {selectedRecord ? (
                    <Badge variant="secondary" className="rounded-full px-3 py-1">
                      SCD2 activo
                    </Badge>
                  ) : null}
                </div>
                <div>
                  <CardTitle className="text-lg">{selectedRecord ? selectedRecord.code : "Registrar unidad"}</CardTitle>
                  <CardDescription>Las unidades creadas aqui se reutilizan en productos y conversiones.</CardDescription>
                </div>
              </div>
              <div className="rounded-full bg-slate-900/10 p-3 text-slate-700 dark:bg-slate-900/20 dark:text-white">
                <Scale className="size-5" aria-hidden="true" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form className="space-y-6" onSubmit={onSubmit}>
              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="unit-code">Codigo</Label>
                  <Input id="unit-code" className="rounded-xl" value={formValues.code} onChange={(event) => updateField("code", event.target.value)} />
                  {formErrors.code ? <p className="text-xs text-destructive">{formErrors.code}</p> : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="unit-symbol">Simbolo</Label>
                  <Input id="unit-symbol" className="rounded-xl" value={formValues.symbol} onChange={(event) => updateField("symbol", event.target.value)} />
                  {formErrors.symbol ? <p className="text-xs text-destructive">{formErrors.symbol}</p> : null}
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="unit-name">Nombre</Label>
                  <Input id="unit-name" className="rounded-xl" value={formValues.name} onChange={(event) => updateField("name", event.target.value)} />
                  {formErrors.name ? <p className="text-xs text-destructive">{formErrors.name}</p> : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="unit-dimension">Dimension</Label>
                  <select
                    id="unit-dimension"
                    className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                    value={formValues.dimension}
                    onChange={(event) => updateField("dimension", event.target.value as BodegaUnitDimension)}
                  >
                    {DIMENSION_OPTIONS.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="unit-decimals">Precision decimal</Label>
                  <Input
                    id="unit-decimals"
                    type="number"
                    min="0"
                    step="1"
                    className="rounded-xl"
                    value={formValues.decimalPrecision}
                    onChange={(event) => updateField("decimalPrecision", Number(event.target.value))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="unit-status">Estado</Label>
                  <select
                    id="unit-status"
                    className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                    value={formValues.isActive ? "active" : "inactive"}
                    onChange={(event) => updateField("isActive", event.target.value === "active")}
                  >
                    <option value="active">Activa</option>
                    <option value="inactive">Inactiva</option>
                  </select>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="unit-reason">Motivo de cambio</Label>
                  <textarea
                    id="unit-reason"
                    rows={3}
                    className="flex min-h-[96px] w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                    value={formValues.changeReason ?? ""}
                    onChange={(event) => updateField("changeReason", event.target.value)}
                    placeholder="Opcional. Ej. homologacion de unidades de bodega."
                  />
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
                      Guardar unidad
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
