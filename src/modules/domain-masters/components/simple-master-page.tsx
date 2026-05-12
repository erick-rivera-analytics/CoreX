"use client";

import { startTransition, useDeferredValue, useEffect, useMemo, useState, type FormEvent } from "react";
import { ClipboardList, DatabaseZap, PencilLine, Plus, RefreshCcw, Save, Search } from "lucide-react";
import { toast } from "sonner";
import useSWR from "swr";

import { fetchJson } from "@/lib/fetch-json";
import type {
  SimpleMasterInput,
  SimpleMasterPayload,
  SimpleMasterRecord,
} from "@/lib/quality-master-types";
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

type EditorMode = "create" | "edit";
type FormErrors = Partial<Record<keyof SimpleMasterInput, string>>;

export type SimpleMasterModuleConfig = {
  apiEndpoint: string;
  resourceNameSingular: string;
  resourceNamePlural: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  searchPlaceholder: string;
  newButtonLabel: string;
  saveButtonLabel: string;
  listTitle: string;
  listDescription: string;
  editorDescription: string;
  codeLabel: string;
  nameLabel: string;
  externalRefLabel?: string;
  externalRefPlaceholder?: string;
  showExternalRefCode?: boolean;
  contactEmailLabel?: string;
  contactEmailPlaceholder?: string;
  showContactEmail?: boolean;
  storageScopeLabel?: string;
};

const EMPTY_FORM_VALUES: SimpleMasterInput = {
  code: "",
  name: "",
  description: "",
  externalRefCode: "",
  contactEmail: "",
  isActive: true,
  changeReason: "",
};

const simpleMasterFetcher = (url: string) =>
  fetchJson<SimpleMasterRecord[]>(url, "No se pudo cargar este maestro.");

function mapRecordToFormValues(record: SimpleMasterRecord): SimpleMasterInput {
  return {
    code: record.code,
    name: record.name,
    description: record.description ?? "",
    externalRefCode: record.externalRefCode ?? "",
    contactEmail: record.contactEmail ?? "",
    isActive: record.isActive,
    changeReason: "",
  };
}

function buildPayload(values: SimpleMasterInput): SimpleMasterInput {
  return {
    code: values.code.trim().toUpperCase(),
    name: values.name.trim(),
    description: values.description?.trim() || null,
    externalRefCode: values.externalRefCode?.trim() || null,
    contactEmail: values.contactEmail?.trim().toLowerCase() || null,
    isActive: values.isActive,
    changeReason: values.changeReason?.trim() || null,
  };
}

function validateForm(values: SimpleMasterInput, config: SimpleMasterModuleConfig): FormErrors {
  const payload = buildPayload(values);
  const errors: FormErrors = {};

  if (!payload.code) {
    errors.code = `El codigo de ${config.resourceNameSingular.toLowerCase()} es obligatorio.`;
  }

  if (!payload.name) {
    errors.name = `El nombre de ${config.resourceNameSingular.toLowerCase()} es obligatorio.`;
  }

  if (payload.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.contactEmail)) {
    errors.contactEmail = "El correo de contacto no tiene un formato valido.";
  }

  return errors;
}

export function SimpleMasterPage({
  initialData,
  initialError,
  config,
}: {
  initialData: SimpleMasterRecord[];
  initialError?: string | null;
  config: SimpleMasterModuleConfig;
}) {
  const [editorMode, setEditorMode] = useState<EditorMode>("create");
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(initialData[0]?.entityId ?? null);
  const [search, setSearch] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [formValues, setFormValues] = useState<SimpleMasterInput>(EMPTY_FORM_VALUES);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const deferredSearch = useDeferredValue(search);
  const searchInputId = useMemo(
    () => config.apiEndpoint.replace(/[^a-zA-Z0-9_-]/g, "-"),
    [config.apiEndpoint],
  );

  const { data, isValidating, mutate } = useSWR(
    config.apiEndpoint,
    simpleMasterFetcher,
    {
      fallbackData: initialData,
      revalidateOnFocus: false,
      dedupingInterval: 15_000,
      onError: (error) => toast.error(error?.message || "No se pudo cargar este maestro."),
    },
  );

  const records = data ?? initialData;
  const selectedRecord = editorMode === "edit"
    ? records.find((record) => record.entityId === selectedEntityId) ?? null
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

    return records.filter((record) =>
      [
        record.code,
        record.name,
        record.externalRefCode,
        record.contactEmail,
      ].some((value) => String(value ?? "").toLowerCase().includes(normalized)),
    );
  }, [deferredSearch, records]);

  const summary = useMemo(() => {
    const latest = records.reduce<SimpleMasterRecord | null>(
      (best, record) => {
        if (!record.loadedAt) return best;
        if (!best || String(record.loadedAt) > String(best.loadedAt)) return record;
        return best;
      },
      null,
    );

    return {
      total: records.length,
      active: records.filter((record) => record.isActive).length,
      latest,
    };
  }, [records]);

  useEffect(() => {
    setFormValues(selectedRecord ? mapRecordToFormValues(selectedRecord) : EMPTY_FORM_VALUES);
    setFormErrors({});
  }, [selectedRecord]);

  function updateField<Key extends keyof SimpleMasterInput>(
    field: Key,
    value: SimpleMasterInput[Key],
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
      setSelectedEntityId(null);
    });
  }

  function openEditMode(entityId: string) {
    startTransition(() => {
      setEditorMode("edit");
      setSelectedEntityId(entityId);
    });
  }

  function resetForm() {
    setFormValues(selectedRecord ? mapRecordToFormValues(selectedRecord) : EMPTY_FORM_VALUES);
    setFormErrors({});
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextErrors = validateForm(formValues, config);
    setFormErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      toast.error("Revisa los campos obligatorios antes de guardar.");
      return;
    }

    setIsSaving(true);

    try {
      const isEditing = editorMode === "edit" && selectedEntityId;
      const endpoint = isEditing
        ? `${config.apiEndpoint}/${encodeURIComponent(selectedEntityId)}`
        : config.apiEndpoint;
      const method = isEditing ? "PATCH" : "POST";
      const response = await fetchJson<SimpleMasterPayload>(
        endpoint,
        `No se pudo guardar ${config.resourceNameSingular.toLowerCase()}.`,
        {
          method,
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(currentPayload),
        },
      );

      toast.success(
        isEditing
          ? `${config.resourceNameSingular} actualizado correctamente.`
          : `${config.resourceNameSingular} creado correctamente.`,
      );
      await mutate();
      startTransition(() => {
        setEditorMode("edit");
        setSelectedEntityId(response.data.entityId);
      });
    } catch (submitError) {
      toast.error(
        submitError instanceof Error
          ? submitError.message
          : `No se pudo guardar ${config.resourceNameSingular.toLowerCase()}.`,
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <SectionPageShell
        eyebrow={config.eyebrow}
        title={config.title}
        subtitle={config.subtitle}
        icon={<DatabaseZap className="size-5" aria-hidden="true" />}
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
              {config.newButtonLabel}
            </Button>
          </div>
        )}
      >
        <FilterPanel>
          <KpiGrid>
            <MetricTile
              label={`${config.resourceNamePlural} activos`}
              value={String(summary.active)}
              hint="Versiones vigentes activas disponibles para formularios operativos."
            />
            <MetricTile
              label={`Total ${config.resourceNamePlural.toLowerCase()}`}
              value={String(summary.total)}
              hint="Incluye registros activos e inactivos que siguen vigentes."
            />
            <MetricTile
              label="Ultima carga"
              value={summary.latest?.loadedAt ? formatDateTime(summary.latest.loadedAt) : "-"}
              hint={`Fecha de la ultima version guardada en ${config.storageScopeLabel ?? "la base configurada"}.`}
            />
          </KpiGrid>

          {initialError ? (
            <div className="rounded-[24px] border border-slate-300/60 bg-slate-500/10 px-4 py-3 text-sm text-slate-950 dark:text-slate-100">
              {initialError}
            </div>
          ) : null}
        </FilterPanel>
      </SectionPageShell>

      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="starter-panel border-border/70 bg-card/84">
          <CardHeader className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-slate-900/10 p-3 text-slate-700 dark:bg-slate-900/20 dark:text-white">
                <DatabaseZap className="size-5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <CardTitle className="text-lg">{config.listTitle}</CardTitle>
                <CardDescription>{config.listDescription}</CardDescription>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor={searchInputId}>Buscar registro</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id={searchInputId}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={config.searchPlaceholder}
                  className="pl-10"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-1">
            <div className="max-h-[calc(100dvh-16rem)] space-y-3 overflow-y-auto pr-1">
              {filteredRecords.length ? filteredRecords.map((record) => {
                const selected = editorMode === "edit" && selectedEntityId === record.entityId;

                return (
                  <button
                    key={record.entityId}
                    type="button"
                    onClick={() => openEditMode(record.entityId)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-[18px] border px-4 py-3 text-left transition-colors",
                      selected
                        ? "border-slate-900 bg-slate-900 text-white shadow-lg shadow-slate-900/20"
                        : "border-border/70 bg-background/80 hover:border-slate-300 hover:bg-background",
                    )}
                  >
                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant={selected ? "secondary" : "outline"}
                          className={cn("rounded-full px-3 py-1", selected && "border-white/20 bg-white/12 text-white")}
                        >
                          {record.code}
                        </Badge>
                        <p className="truncate text-sm font-semibold">{record.name}</p>
                        <Badge
                          variant={selected ? "secondary" : "outline"}
                          className={cn("rounded-full px-3 py-1", selected && "border-white/20 bg-white/12 text-white")}
                        >
                          {record.isActive ? "Activo" : "Inactivo"}
                        </Badge>
                      </div>
                      <p className={cn("text-xs", selected ? "text-white/75" : "text-muted-foreground")}>
                        {record.externalRefCode || record.contactEmail || "Sin referencias adicionales."}
                      </p>
                    </div>
                    <PencilLine className={cn("size-4 shrink-0", selected ? "text-white" : "text-muted-foreground")} />
                  </button>
                );
              }) : (
                <div className="rounded-[24px] border border-dashed border-border/70 bg-background/80 px-4 py-8 text-center text-sm text-muted-foreground">
                  No hay registros que coincidan con el filtro actual.
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
                    {editorMode === "edit" ? "Editar version vigente" : "Nuevo registro"}
                  </Badge>
                  {selectedRecord ? (
                    <Badge variant="secondary" className="rounded-full px-3 py-1">
                      {selectedRecord.isActive ? "Activo" : "Inactivo"}
                    </Badge>
                  ) : null}
                </div>
                <div>
                  <CardTitle className="text-lg">
                    {selectedRecord ? selectedRecord.name : `Registrar ${config.resourceNameSingular.toLowerCase()}`}
                  </CardTitle>
                  <CardDescription>{config.editorDescription}</CardDescription>
                </div>
              </div>
              <div className="rounded-full bg-slate-900/10 p-3 text-slate-700 dark:bg-slate-900/20 dark:text-white">
                <ClipboardList className="size-5" aria-hidden="true" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form className="space-y-6" onSubmit={onSubmit}>
              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="simple-master-code">{config.codeLabel}</Label>
                  <Input
                    id="simple-master-code"
                    className="rounded-xl"
                    value={formValues.code}
                    onChange={(event) => updateField("code", event.target.value)}
                  />
                  {formErrors.code ? <p className="text-xs text-destructive">{formErrors.code}</p> : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="simple-master-status">Estado</Label>
                  <select
                    id="simple-master-status"
                    className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                    value={formValues.isActive ? "active" : "inactive"}
                    onChange={(event) => updateField("isActive", event.target.value === "active")}
                  >
                    <option value="active">Activo</option>
                    <option value="inactive">Inactivo</option>
                  </select>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="simple-master-name">{config.nameLabel}</Label>
                  <Input
                    id="simple-master-name"
                    className="rounded-xl"
                    value={formValues.name}
                    onChange={(event) => updateField("name", event.target.value)}
                  />
                  {formErrors.name ? <p className="text-xs text-destructive">{formErrors.name}</p> : null}
                </div>

                {config.showExternalRefCode !== false ? (
                  <div className="space-y-2">
                    <Label htmlFor="simple-master-external-ref">{config.externalRefLabel ?? "Referencia externa"}</Label>
                    <Input
                      id="simple-master-external-ref"
                      className="rounded-xl"
                      value={formValues.externalRefCode ?? ""}
                      placeholder={config.externalRefPlaceholder}
                      onChange={(event) => updateField("externalRefCode", event.target.value)}
                    />
                  </div>
                ) : null}

                {config.showContactEmail ? (
                  <div className="space-y-2">
                    <Label htmlFor="simple-master-email">{config.contactEmailLabel ?? "Correo de contacto"}</Label>
                    <Input
                      id="simple-master-email"
                      type="email"
                      className="rounded-xl"
                      value={formValues.contactEmail ?? ""}
                      placeholder={config.contactEmailPlaceholder}
                      onChange={(event) => updateField("contactEmail", event.target.value)}
                    />
                    {formErrors.contactEmail ? <p className="text-xs text-destructive">{formErrors.contactEmail}</p> : null}
                  </div>
                ) : null}

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="simple-master-description">Descripcion</Label>
                  <textarea
                    id="simple-master-description"
                    rows={3}
                    className="flex min-h-[96px] w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                    value={formValues.description ?? ""}
                    onChange={(event) => updateField("description", event.target.value)}
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="simple-master-reason">Motivo de cambio</Label>
                  <textarea
                    id="simple-master-reason"
                    rows={3}
                    className="flex min-h-[96px] w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                    value={formValues.changeReason ?? ""}
                    onChange={(event) => updateField("changeReason", event.target.value)}
                    placeholder={`Opcional. Ej. alta o ajuste de ${config.resourceNameSingular.toLowerCase()}.`}
                  />
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
                      {config.saveButtonLabel}
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
