"use client";

import { startTransition, useDeferredValue, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  BriefcaseBusiness,
  ClipboardList,
  DatabaseZap,
  PencilLine,
  Plus,
  RefreshCcw,
  Save,
  Search,
  UserRoundSearch,
} from "lucide-react";
import { toast } from "sonner";
import useSWR from "swr";

import { fetchJson } from "@/lib/fetch-json";
import type {
  CommercialAccountExecutiveInput,
  CommercialAccountExecutiveRecord,
  CommercialPersonnelCandidate,
} from "@/lib/commercial-account-executives-types";
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
type FormErrors = Partial<Record<keyof CommercialAccountExecutiveInput, string>>;

const API_ENDPOINT = "/api/comercial/administrar-maestros/ejecutivos-cuenta";
const SEARCH_ENDPOINT = "/api/comercial/administrar-maestros/ejecutivos-cuenta/search-personnel";

const EMPTY_FORM_VALUES: CommercialAccountExecutiveInput = {
  naPersonalCode: false,
  personCode: "",
  executiveName: "",
  contactEmail: "",
  description: "",
  isActive: true,
  changeReason: "",
};

const executivesFetcher = (url: string) =>
  fetchJson<CommercialAccountExecutiveRecord[]>(url, "No se pudo cargar el maestro de ejecutivos de cuenta.");

const personnelFetcher = (url: string) =>
  fetchJson<{ results: CommercialPersonnelCandidate[] }>(url, "No se pudo buscar personal elegible.");

function normalizeText(value: string | null | undefined) {
  const normalized = String(value ?? "").trim().replace(/\s+/g, " ");
  return normalized || null;
}

function normalizeCode(value: string | null | undefined) {
  return normalizeText(value)?.toUpperCase() ?? null;
}

function normalizeEmail(value: string | null | undefined) {
  return normalizeText(value)?.toLowerCase() ?? null;
}

function slugifyNameToken(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "")
    .toUpperCase();
}

function buildExecutiveCode(name: string | null | undefined) {
  const normalizedName = normalizeText(name) ?? "";
  const parts = normalizedName.split(" ").filter(Boolean);
  const firstInitial = slugifyNameToken(parts[0]?.slice(0, 1) ?? "X") || "X";
  const surname = slugifyNameToken(parts[parts.length - 1] ?? "EXECUTIVE") || "EXECUTIVE";
  return `EXEC_${firstInitial}${surname}`.slice(0, 64);
}

function mapRecordToFormValues(record: CommercialAccountExecutiveRecord): CommercialAccountExecutiveInput {
  return {
    naPersonalCode: !record.personCode,
    personCode: record.personCode ?? "",
    executiveName: record.name,
    contactEmail: record.contactEmail ?? "",
    description: record.description ?? "",
    isActive: record.isActive,
    changeReason: "",
  };
}

function buildPayload(values: CommercialAccountExecutiveInput, selectedPersonnel: CommercialPersonnelCandidate | null): CommercialAccountExecutiveInput {
  const naPersonalCode = Boolean(values.naPersonalCode);
  const personnelName = selectedPersonnel?.personName ?? "";
  const personnelCode = selectedPersonnel?.personCode ?? values.personCode ?? "";

  return {
    naPersonalCode,
    personCode: naPersonalCode ? "NA" : normalizeCode(personnelCode),
    executiveName: naPersonalCode ? normalizeText(values.executiveName) : normalizeText(personnelName),
    contactEmail: normalizeEmail(values.contactEmail),
    description: normalizeText(values.description),
    isActive: values.isActive,
    changeReason: normalizeText(values.changeReason),
  };
}

function validateForm(values: CommercialAccountExecutiveInput): FormErrors {
  const errors: FormErrors = {};

  if (!values.naPersonalCode && !normalizeCode(values.personCode)) {
    errors.personCode = "Debes seleccionar un colaborador elegible.";
  }

  if (values.naPersonalCode && !normalizeText(values.executiveName)) {
    errors.executiveName = "El nombre del ejecutivo es obligatorio cuando cod_personal es NA.";
  }

  const email = normalizeEmail(values.contactEmail);
  if (!email) {
    errors.contactEmail = "El correo del ejecutivo es obligatorio.";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.contactEmail = "El correo del ejecutivo no tiene un formato valido.";
  }

  return errors;
}

function PersonnelCandidateCard({
  candidate,
  selected,
  onSelect,
}: {
  candidate: CommercialPersonnelCandidate;
  selected: boolean;
  onSelect: (candidate: CommercialPersonnelCandidate) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(candidate)}
      className={cn(
        "flex w-full flex-col gap-2 rounded-2xl border px-4 py-3 text-left transition-colors",
        selected
          ? "border-slate-900 bg-slate-900 text-white shadow-lg shadow-slate-900/20"
          : "border-border/70 bg-background/80 hover:border-slate-300 hover:bg-background",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={selected ? "secondary" : "outline"} className={cn("rounded-full px-3 py-1 font-mono", selected && "border-white/20 bg-white/12 text-white")}>
          {candidate.personCode}
        </Badge>
        <p className="font-semibold">{candidate.personName}</p>
      </div>
      <p className={cn("text-xs", selected ? "text-white/75" : "text-muted-foreground")}>
        {[candidate.jobTitle, candidate.areaName, candidate.jobClassificationCode].filter(Boolean).join(" / ") || "Sin contexto adicional."}
      </p>
    </button>
  );
}

export function CommercialAccountExecutivesPage({
  initialData,
  initialError,
}: {
  initialData: CommercialAccountExecutiveRecord[];
  initialError?: string | null;
}) {
  const [editorMode, setEditorMode] = useState<EditorMode>("create");
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(initialData[0]?.entityId ?? null);
  const [search, setSearch] = useState("");
  const [personnelSearch, setPersonnelSearch] = useState("");
  const [selectedPersonnel, setSelectedPersonnel] = useState<CommercialPersonnelCandidate | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formValues, setFormValues] = useState<CommercialAccountExecutiveInput>(EMPTY_FORM_VALUES);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const deferredSearch = useDeferredValue(search);
  const deferredPersonnelSearch = useDeferredValue(personnelSearch);

  const { data, isValidating, mutate } = useSWR(
    API_ENDPOINT,
    executivesFetcher,
    {
      fallbackData: initialData,
      revalidateOnFocus: false,
      dedupingInterval: 15_000,
      onError: (error) => toast.error(error?.message || "No se pudo cargar el maestro de ejecutivos de cuenta."),
    },
  );

  const personnelSearchKey = !formValues.naPersonalCode && deferredPersonnelSearch.trim().length >= 2
    ? `${SEARCH_ENDPOINT}?q=${encodeURIComponent(deferredPersonnelSearch.trim())}`
    : null;

  const { data: personnelData, isValidating: isSearchingPersonnel } = useSWR(
    personnelSearchKey,
    personnelFetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 15_000,
      onError: (error) => toast.error(error?.message || "No se pudo buscar personal elegible."),
    },
  );

  const records = data ?? initialData;
  const selectedRecord = editorMode === "edit"
    ? records.find((record) => record.entityId === selectedEntityId) ?? null
    : null;
  const baselinePayload = useMemo(
    () => buildPayload(selectedRecord ? mapRecordToFormValues(selectedRecord) : EMPTY_FORM_VALUES, selectedPersonnel),
    [selectedPersonnel, selectedRecord],
  );
  const currentPayload = useMemo(() => buildPayload(formValues, selectedPersonnel), [formValues, selectedPersonnel]);
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
        record.personCode,
        record.contactEmail,
        record.description,
      ].some((value) => String(value ?? "").toLowerCase().includes(normalized)),
    );
  }, [deferredSearch, records]);

  const summary = useMemo(() => {
    const latest = records.reduce<CommercialAccountExecutiveRecord | null>(
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
      linked: records.filter((record) => record.personCode).length,
      latest,
    };
  }, [records]);

  useEffect(() => {
    setFormValues(selectedRecord ? mapRecordToFormValues(selectedRecord) : EMPTY_FORM_VALUES);
    setFormErrors({});

    if (selectedRecord?.personCode) {
      setSelectedPersonnel({
        personCode: selectedRecord.personCode,
        personName: selectedRecord.name,
        nationalId: null,
        areaId: null,
        areaName: null,
        areaGeneral: null,
        jobTitle: null,
        jobClassificationCode: null,
        employeeType: null,
        email: selectedRecord.contactEmail,
      });
      setPersonnelSearch("");
    } else {
      setSelectedPersonnel(null);
      setPersonnelSearch("");
    }
  }, [selectedRecord]);

  function updateField<Key extends keyof CommercialAccountExecutiveInput>(
    field: Key,
    value: CommercialAccountExecutiveInput[Key],
  ) {
    setFormValues((current) => {
      if (field === "naPersonalCode") {
        const nextNaPersonalCode = Boolean(value);
        if (nextNaPersonalCode) {
          setSelectedPersonnel(null);
          setPersonnelSearch("");
        }

        return {
          ...current,
          naPersonalCode: nextNaPersonalCode,
          personCode: nextNaPersonalCode ? "NA" : "",
          executiveName: nextNaPersonalCode ? current.executiveName : "",
        };
      }

      return {
        ...current,
        [field]: value,
      };
    });

    setFormErrors((current) => ({
      ...current,
      [field]: undefined,
    }));
  }

  function openCreateMode() {
    startTransition(() => {
      setEditorMode("create");
      setSelectedEntityId(null);
      setSelectedPersonnel(null);
      setPersonnelSearch("");
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

  function onSelectPersonnel(candidate: CommercialPersonnelCandidate) {
    setSelectedPersonnel(candidate);
    setPersonnelSearch("");
    setFormValues((current) => ({
      ...current,
      naPersonalCode: false,
      personCode: candidate.personCode,
      executiveName: candidate.personName,
      contactEmail: candidate.email || "",
    }));
    setFormErrors((current) => ({
      ...current,
      personCode: undefined,
    }));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextPayload = buildPayload(formValues, selectedPersonnel);
    const nextErrors = validateForm(nextPayload);
    setFormErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      toast.error("Revisa los campos obligatorios antes de guardar.");
      return;
    }

    setIsSaving(true);

    try {
      const isEditing = editorMode === "edit" && selectedEntityId;
      const endpoint = isEditing
        ? `${API_ENDPOINT}/${encodeURIComponent(selectedEntityId)}`
        : API_ENDPOINT;
      const method = isEditing ? "PATCH" : "POST";
      const response = await fetchJson<{ data: CommercialAccountExecutiveRecord }>(
        endpoint,
        "No se pudo guardar el ejecutivo de cuenta.",
        {
          method,
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(nextPayload),
        },
      );

      toast.success(
        isEditing
          ? "Ejecutivo de cuenta actualizado correctamente."
          : "Ejecutivo de cuenta creado correctamente.",
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
          : "No se pudo guardar el ejecutivo de cuenta.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  const personnelResults = personnelData?.results ?? [];
  const selectedPersonnelCode = selectedPersonnel?.personCode ?? formValues.personCode ?? "";
  const executiveNamePreview = formValues.naPersonalCode
    ? (formValues.executiveName ?? "")
    : (selectedPersonnel?.personName ?? formValues.executiveName ?? "");
  const executiveCodePreview = buildExecutiveCode(executiveNamePreview);
  const personalCodePreview = formValues.naPersonalCode
    ? "NA"
    : (selectedPersonnel?.personCode ?? formValues.personCode ?? "");

  return (
    <div className="space-y-4">
      <SectionPageShell
        eyebrow="Administracion / Maestros por dominio / Comercial / Ejecutivos de cuenta"
        title="Ejecutivos de cuenta"
        subtitle="Administra los ejecutivos comerciales. Se vinculan desde Talento Humano y solo se habilita alta manual cuando cod_personal es NA. El correo se guarda en este maestro y no modifica la ficha del personal."
        icon={<BriefcaseBusiness className="size-5" aria-hidden="true" />}
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
              Nuevo ejecutivo
            </Button>
          </div>
        )}
      >
        <FilterPanel>
          <KpiGrid>
            <MetricTile label="Ejecutivos activos" value={String(summary.active)} hint="Versiones vigentes activas disponibles para reclamos." />
            <MetricTile label="Vinculados a personal" value={String(summary.linked)} hint="Ejecutivos creados desde la ficha del personal." />
            <MetricTile label="Ultima carga" value={summary.latest?.loadedAt ? formatDateTime(summary.latest.loadedAt) : "-"} hint="Fecha de la ultima version guardada en db_commercial.public." />
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
                <CardTitle className="text-lg">Catalogo de ejecutivos</CardTitle>
                <CardDescription>Selecciona un ejecutivo para editarlo o registra uno nuevo desde el formulario.</CardDescription>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="commercial-executives-search">Buscar registro</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="commercial-executives-search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar por codigo, nombre, cod_personal o correo..."
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
                        <Badge variant={selected ? "secondary" : "outline"} className={cn("rounded-full px-3 py-1 font-mono", selected && "border-white/20 bg-white/12 text-white")}>
                          {record.code}
                        </Badge>
                        <Badge variant={selected ? "secondary" : "outline"} className={cn("rounded-full px-3 py-1", selected && "border-white/20 bg-white/12 text-white")}>
                          {record.personCode ? "Vinculado" : "N/A"}
                        </Badge>
                        <p className="truncate text-sm font-semibold">{record.name}</p>
                      </div>
                      <p className={cn("text-xs", selected ? "text-white/75" : "text-muted-foreground")}>
                        {record.personCode ? `cod_personal: ${record.personCode}` : "cod_personal: NA"}
                        {record.contactEmail ? ` / ${record.contactEmail}` : ""}
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
                  <Badge variant="secondary" className="rounded-full px-3 py-1">
                    {formValues.naPersonalCode ? "cod_personal NA" : "Desde ficha personal"}
                  </Badge>
                </div>
                <div>
                  <CardTitle className="text-lg">
                    {selectedRecord ? selectedRecord.name : "Registrar ejecutivo de cuenta"}
                  </CardTitle>
                  <CardDescription>Busca un colaborador elegible o marca `N/A` para registrar un ejecutivo manual sin vínculo de personal.</CardDescription>
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
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="executive-personnel-search">Buscar colaborador</Label>
                  <div className="relative">
                    <UserRoundSearch className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="executive-personnel-search"
                      className="rounded-xl pl-10"
                      value={personnelSearch}
                      onChange={(event) => {
                        setPersonnelSearch(event.target.value);
                      }}
                      placeholder="Buscar por codigo, nombre o cedula..."
                      disabled={formValues.naPersonalCode}
                    />
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={formValues.naPersonalCode}
                      onChange={(event) => updateField("naPersonalCode", event.target.checked)}
                    />
                    N/A
                  </label>
                  <p className="text-xs text-muted-foreground">Se muestran solo colaboradores activos con clasificacion distinta de AGRICOLA.</p>
                  {formErrors.personCode ? <p className="text-xs text-destructive">{formErrors.personCode}</p> : null}
                </div>

                {!formValues.naPersonalCode && selectedPersonnel ? (
                  <div className="rounded-2xl border border-border/70 bg-background/80 p-4 md:col-span-2">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline" className="rounded-full px-3 py-1 font-mono">{selectedPersonnel.personCode}</Badge>
                      <Badge variant="outline" className="rounded-full px-3 py-1">{selectedPersonnel.jobClassificationCode ?? "Sin clasificacion"}</Badge>
                    </div>
                    <p className="mt-3 font-semibold">{selectedPersonnel.personName}</p>
                    <p className="text-sm text-muted-foreground">
                      {[selectedPersonnel.jobTitle, selectedPersonnel.areaName, selectedPersonnel.nationalId].filter(Boolean).join(" / ") || "Sin datos adicionales."}
                    </p>
                  </div>
                ) : null}

                {!formValues.naPersonalCode && personnelSearchKey ? (
                  <div className="space-y-2 md:col-span-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Resultados de busqueda</span>
                      <span>{isSearchingPersonnel ? "Buscando..." : `${personnelResults.length} coincidencias`}</span>
                    </div>
                    <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                      {personnelResults.map((candidate) => (
                        <PersonnelCandidateCard
                          key={candidate.personCode}
                          candidate={candidate}
                          selected={selectedPersonnelCode === candidate.personCode}
                          onSelect={onSelectPersonnel}
                        />
                      ))}
                      {!personnelResults.length && !isSearchingPersonnel ? (
                        <div className="rounded-2xl border border-dashed border-border/70 bg-background/80 px-4 py-6 text-center text-sm text-muted-foreground">
                          No hay personal elegible que coincida con el filtro.
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                <div className="space-y-2">
                  <Label htmlFor="executive-status">Estado</Label>
                  <select
                    id="executive-status"
                    className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                    value={formValues.isActive ? "active" : "inactive"}
                    onChange={(event) => updateField("isActive", event.target.value === "active")}
                  >
                    <option value="active">Activo</option>
                    <option value="inactive">Inactivo</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="executive-person-code-preview">cod_personal</Label>
                  <Input
                    id="executive-person-code-preview"
                    className="rounded-xl font-mono"
                    value={personalCodePreview}
                    readOnly
                  />
                </div>

                {formValues.naPersonalCode ? (
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="executive-name-manual">Nombre ejecutivo</Label>
                    <Input
                      id="executive-name-manual"
                      className="rounded-xl"
                      value={formValues.executiveName ?? ""}
                      onChange={(event) => updateField("executiveName", event.target.value)}
                    />
                    {formErrors.executiveName ? <p className="text-xs text-destructive">{formErrors.executiveName}</p> : null}
                  </div>
                ) : (
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="executive-name-preview">Nombre ejecutivo</Label>
                    <Input
                      id="executive-name-preview"
                      className="rounded-xl"
                      value={executiveNamePreview}
                      readOnly
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="executive-code-preview">Codigo ejecutivo</Label>
                  <Input
                    id="executive-code-preview"
                    className="rounded-xl font-mono"
                    value={executiveCodePreview}
                    readOnly
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="executive-email">Correo</Label>
                  <Input
                    id="executive-email"
                    type="email"
                    className="rounded-xl"
                    value={formValues.contactEmail ?? ""}
                    onChange={(event) => updateField("contactEmail", event.target.value)}
                  />
                  {formErrors.contactEmail ? <p className="text-xs text-destructive">{formErrors.contactEmail}</p> : null}
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="executive-description">Descripcion</Label>
                  <textarea
                    id="executive-description"
                    rows={3}
                    className="flex min-h-[96px] w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                    value={formValues.description ?? ""}
                    onChange={(event) => updateField("description", event.target.value)}
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="executive-reason">Motivo de cambio</Label>
                  <textarea
                    id="executive-reason"
                    rows={3}
                    className="flex min-h-[96px] w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                    value={formValues.changeReason ?? ""}
                    onChange={(event) => updateField("changeReason", event.target.value)}
                    placeholder="Opcional. Ej. alta de ejecutivo, ajuste de correo o regularizacion de cod_personal."
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
                      Guardar ejecutivo
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
