"use client";

import { startTransition, useDeferredValue, useEffect, useMemo, useState } from "react";
import { Beaker, DatabaseZap, PencilLine, Plus, RefreshCcw, Save, Search } from "lucide-react";
import { toast } from "sonner";
import useSWR from "swr";

import { fetchJson } from "@/lib/fetch-json";
import type {
  LaboratoryCategoryInput,
  LaboratoryCategoryPayload,
  LaboratoryCategoryRecord,
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

type LaboratorioTiposPageProps = {
  initialData: LaboratoryCategoryRecord[];
  initialError?: string | null;
};

type EditorMode = "create" | "edit";
type FormErrors = Partial<Record<keyof LaboratoryCategoryInput, string>>;

const EMPTY_FORM_VALUES: LaboratoryCategoryInput = {
  categoryCode: "",
  categoryName: "",
  isActive: true,
  changeReason: "",
};

const categoriesFetcher = (url: string) =>
  fetchJson<LaboratoryCategoryRecord[]>(url, "No se pudo cargar el maestro de tipos de Laboratorio.");

function mapRecordToFormValues(record: LaboratoryCategoryRecord): LaboratoryCategoryInput {
  return {
    categoryCode: record.categoryCode,
    categoryName: record.categoryName,
    isActive: record.isActive,
    changeReason: "",
  };
}

function buildPayload(values: LaboratoryCategoryInput): LaboratoryCategoryInput {
  return {
    categoryCode: values.categoryCode.trim().toUpperCase(),
    categoryName: values.categoryName.trim(),
    isActive: values.isActive,
    changeReason: values.changeReason?.trim() || null,
  };
}

function validateForm(values: LaboratoryCategoryInput): FormErrors {
  const payload = buildPayload(values);
  const errors: FormErrors = {};
  if (!payload.categoryCode) errors.categoryCode = "El codigo es obligatorio.";
  if (!payload.categoryName) errors.categoryName = "El nombre es obligatorio.";
  return errors;
}

export function LaboratorioTiposPage({ initialData, initialError }: LaboratorioTiposPageProps) {
  const [editorMode, setEditorMode] = useState<EditorMode>("create");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(initialData[0]?.categoryId ?? null);
  const [search, setSearch] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [formValues, setFormValues] = useState<LaboratoryCategoryInput>(EMPTY_FORM_VALUES);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const deferredSearch = useDeferredValue(search);

  const { data, isValidating, mutate } = useSWR(
    "/api/laboratorio/administrar-maestros/tipos-elaboracion",
    categoriesFetcher,
    {
      fallbackData: initialData,
      revalidateOnFocus: false,
      dedupingInterval: 15000,
      onError: (error) => toast.error(error?.message || "No se pudo cargar el maestro de tipos de Laboratorio."),
    },
  );

  const records = data ?? initialData;
  const selectedRecord = editorMode === "edit"
    ? records.find((record) => record.categoryId === selectedCategoryId) ?? null
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

    return records.filter((record) =>
      [record.categoryCode, record.categoryName, record.actorId]
        .some((value) => String(value ?? "").toLowerCase().includes(normalized)),
    );
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

  function updateField<Key extends keyof LaboratoryCategoryInput>(field: Key, value: LaboratoryCategoryInput[Key]) {
    setFormValues((current) => ({ ...current, [field]: value }));
    setFormErrors((current) => ({ ...current, [field]: undefined }));
  }

  function openCreateMode() {
    startTransition(() => {
      setEditorMode("create");
      setSelectedCategoryId(null);
    });
  }

  function openEditMode(categoryId: string) {
    startTransition(() => {
      setEditorMode("edit");
      setSelectedCategoryId(categoryId);
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
      const isEditing = editorMode === "edit" && selectedCategoryId;
      const endpoint = isEditing
        ? `/api/laboratorio/administrar-maestros/tipos-elaboracion/${encodeURIComponent(selectedCategoryId)}`
        : "/api/laboratorio/administrar-maestros/tipos-elaboracion";
      const method = isEditing ? "PATCH" : "POST";
      const response = await fetchJson<LaboratoryCategoryPayload>(
        endpoint,
        "No se pudo guardar el tipo de Laboratorio.",
        {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(currentPayload),
        },
      );

      toast.success(isEditing ? "Tipo de Laboratorio actualizado." : "Tipo de Laboratorio creado.");
      await mutate();
      startTransition(() => {
        setEditorMode("edit");
        setSelectedCategoryId(response.data.categoryId);
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar el tipo de Laboratorio.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <SectionPageShell
        eyebrow="Gestion / Laboratorio / Administrar Maestros"
        title="Tipos de elaboracion"
        subtitle="Maestro simple de categorias para productos de Laboratorio. Cada cambio conserva trazabilidad SCD2 en db_laboratory."
        icon={<Beaker className="size-5" aria-hidden="true" />}
        actions={(
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" className="rounded-full" onClick={() => { void mutate(); }}>
              <RefreshCcw className={cn("size-4", isValidating && "animate-spin")} />
              Recargar
            </Button>
            <Button type="button" className="rounded-full" onClick={openCreateMode}>
              <Plus className="size-4" />
              Nuevo tipo
            </Button>
          </div>
        )}
      >
        <FilterPanel>
          <KpiGrid>
            <MetricTile label="Tipos activos" value={String(summary.total)} hint="Tipos disponibles para clasificar productos de Laboratorio." />
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
                <CardTitle className="text-lg">Listado de tipos</CardTitle>
                <CardDescription>Selecciona un tipo para editarlo o crea uno nuevo.</CardDescription>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="laboratory-types-search">Buscar tipo</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="laboratory-types-search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar por codigo o nombre..."
                  className="pl-10"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-1">
            <div className="max-h-[calc(100dvh-16rem)] space-y-3 overflow-y-auto pr-1">
              {filteredRecords.length ? filteredRecords.map((record) => {
                const isSelected = editorMode === "edit" && selectedCategoryId === record.categoryId;

                return (
                  <button
                    key={record.categoryId}
                    type="button"
                    onClick={() => openEditMode(record.categoryId)}
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
                          <p className="text-base font-semibold">{record.categoryCode}</p>
                          <Badge
                            variant={record.isActive ? "secondary" : "outline"}
                            className={cn("rounded-full px-3 py-1", isSelected && "border-white/20 bg-white/12 text-white")}
                          >
                            {record.isActive ? "Activo" : "Inactivo"}
                          </Badge>
                        </div>
                        <p className={cn("text-sm", isSelected ? "text-white/80" : "text-muted-foreground")}>
                          {record.categoryName}
                        </p>
                      </div>
                      <PencilLine className={cn("size-4 shrink-0", isSelected ? "text-white" : "text-muted-foreground")} />
                    </div>
                  </button>
                );
              }) : (
                <div className="rounded-[24px] border border-dashed border-border/70 bg-background/80 px-4 py-8 text-center text-sm text-muted-foreground">
                  No hay tipos que coincidan con el filtro actual.
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
                    {editorMode === "edit" ? "Editar version vigente" : "Nuevo tipo"}
                  </Badge>
                  {selectedRecord ? (
                    <Badge variant="secondary" className="rounded-full px-3 py-1">
                      SCD2 activo
                    </Badge>
                  ) : null}
                </div>
                <div>
                  <CardTitle className="text-lg">{selectedRecord ? selectedRecord.categoryCode : "Registrar tipo"}</CardTitle>
                  <CardDescription>Este maestro alimenta el campo Tipo dentro de Receta de productos.</CardDescription>
                </div>
              </div>
              <div className="rounded-full bg-slate-900/10 p-3 text-slate-700 dark:bg-slate-900/20 dark:text-white">
                <Beaker className="size-5" aria-hidden="true" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form className="space-y-6" onSubmit={onSubmit}>
              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="laboratory-type-code">Codigo</Label>
                  <Input id="laboratory-type-code" className="rounded-xl" value={formValues.categoryCode} onChange={(event) => updateField("categoryCode", event.target.value)} />
                  {formErrors.categoryCode ? <p className="text-xs text-destructive">{formErrors.categoryCode}</p> : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="laboratory-type-status">Estado</Label>
                  <select
                    id="laboratory-type-status"
                    className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                    value={formValues.isActive ? "active" : "inactive"}
                    onChange={(event) => updateField("isActive", event.target.value === "active")}
                  >
                    <option value="active">Activo</option>
                    <option value="inactive">Inactivo</option>
                  </select>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="laboratory-type-name">Nombre</Label>
                  <Input id="laboratory-type-name" className="rounded-xl" value={formValues.categoryName} onChange={(event) => updateField("categoryName", event.target.value)} />
                  {formErrors.categoryName ? <p className="text-xs text-destructive">{formErrors.categoryName}</p> : null}
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="laboratory-type-reason">Motivo de cambio</Label>
                  <textarea
                    id="laboratory-type-reason"
                    rows={3}
                    className="flex min-h-[96px] w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                    value={formValues.changeReason ?? ""}
                    onChange={(event) => updateField("changeReason", event.target.value)}
                    placeholder="Opcional. Ej. nuevo tipo de elaboracion para laboratorio."
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
                      Guardar tipo
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
