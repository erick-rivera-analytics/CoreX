"use client";

import { startTransition, useDeferredValue, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  ClipboardList,
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
  ClaimProblemLevel,
  ClaimProblemScope,
  QualityClaimProblemInput,
  QualityClaimProblemPayload,
  QualityClaimProblemRecord,
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
type FormErrors = Partial<Record<keyof QualityClaimProblemInput, string>>;

const API_ENDPOINT = "/api/comercial/administrar-maestros/problemas-reclamo";

const EMPTY_FORM_VALUES: QualityClaimProblemInput = {
  name: "",
  level: "family",
  scope: "quality",
  parentProblemIds: [],
  description: "",
  isActive: true,
  changeReason: "",
};

const LEVEL_OPTIONS: Array<{ value: ClaimProblemLevel; label: string }> = [
  { value: "family", label: "Tipo de problema" },
  { value: "subfamily", label: "Problema" },
];

const SCOPE_OPTIONS: Array<{ value: ClaimProblemScope; label: string }> = [
  { value: "quality", label: "Calidad" },
  { value: "commercial", label: "Comercial" },
  { value: "all", label: "Ambos" },
];

const claimProblemsFetcher = (url: string) =>
  fetchJson<QualityClaimProblemRecord[]>(url, "No se pudo cargar el arbol de problemas.");

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function slugifyCodeFragment(value: string) {
  const ascii = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");

  return ascii || "ITEM";
}

function buildClaimProblemCode(level: ClaimProblemLevel, scope: ClaimProblemScope, name: string) {
  const scopePart = {
    quality: "QLT",
    commercial: "COM",
    all: "ALL",
  }[scope];

  const levelPart = level === "family" ? "FAM" : "ITM";
  const slug = slugifyCodeFragment(name).slice(0, 64);

  return `CLM_${scopePart}_${levelPart}_${slug}`;
}

function uniqueNonEmpty(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      values
        .map((value) => normalizeText(value ?? ""))
        .filter(Boolean),
    ),
  );
}

function mapRecordToFormValues(record: QualityClaimProblemRecord): QualityClaimProblemInput {
  return {
    name: record.name,
    level: record.level,
    scope: record.scope,
    parentProblemIds: record.parentProblemIds,
    description: record.description ?? "",
    isActive: record.isActive,
    changeReason: "",
  };
}

function buildPayload(values: QualityClaimProblemInput): QualityClaimProblemInput {
  return {
    name: normalizeText(values.name),
    level: values.level,
    scope: values.scope,
    parentProblemIds: values.level === "family"
      ? []
      : uniqueNonEmpty(values.parentProblemIds ?? []),
    description: values.description?.trim() || null,
    isActive: values.isActive,
    changeReason: values.changeReason?.trim() || null,
  };
}

function validateForm(values: QualityClaimProblemInput): FormErrors {
  const payload = buildPayload(values);
  const errors: FormErrors = {};

  if (!payload.name) {
    errors.name = "El nombre del problema es obligatorio.";
  }

  if (payload.level === "subfamily" && (payload.parentProblemIds?.length ?? 0) === 0) {
    errors.parentProblemIds = "Debes seleccionar al menos un tipo de problema superior.";
  }

  return errors;
}

function formatScopeLabel(scope: ClaimProblemScope) {
  return SCOPE_OPTIONS.find((option) => option.value === scope)?.label ?? scope;
}

function TreeNode({
  record,
  depth,
  selected,
  onSelect,
}: {
  record: QualityClaimProblemRecord;
  depth: number;
  selected: boolean;
  onSelect: (record: QualityClaimProblemRecord) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(record)}
      className={cn(
        "flex w-full items-center justify-between rounded-[18px] border px-4 py-3 text-left transition-colors",
        selected
          ? "border-slate-900 bg-slate-900 text-white shadow-lg shadow-slate-900/20"
          : "border-border/70 bg-background/80 hover:border-slate-300 hover:bg-background",
      )}
      style={{ marginLeft: `${depth * 18}px` }}
    >
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant={selected ? "secondary" : "outline"}
            className={cn("rounded-full px-3 py-1", selected && "border-white/20 bg-white/12 text-white")}
          >
            {record.level === "family" ? "Tipo" : "Problema"}
          </Badge>
          <Badge
            variant={selected ? "secondary" : "outline"}
            className={cn("rounded-full px-3 py-1", selected && "border-white/20 bg-white/12 text-white")}
          >
            {formatScopeLabel(record.scope)}
          </Badge>
          <Badge
            variant={selected ? "secondary" : "outline"}
            className={cn("rounded-full px-3 py-1 font-mono", selected && "border-white/20 bg-white/12 text-white")}
          >
            {record.code}
          </Badge>
          <p className="truncate text-sm font-semibold">{record.name}</p>
        </div>
        <p className={cn("text-xs", selected ? "text-white/75" : "text-muted-foreground")}>
          {record.pathLabel}
        </p>
      </div>
      <PencilLine className={cn("size-4 shrink-0", selected ? "text-white" : "text-muted-foreground")} />
    </button>
  );
}

function ProblemTreeBranch({
  childrenMap,
  parentId,
  depth,
  selectedNodeKey,
  editorMode,
  onSelect,
}: {
  childrenMap: Map<string | null, QualityClaimProblemRecord[]>;
  parentId: string | null;
  depth: number;
  selectedNodeKey: string | null;
  editorMode: EditorMode;
  onSelect: (record: QualityClaimProblemRecord) => void;
}) {
  const items = childrenMap.get(parentId) ?? [];
  return (
    <>
      {items.map((record) => (
        <div key={record.nodeKey} className="space-y-3">
          <TreeNode
            record={record}
            depth={depth}
            selected={editorMode === "edit" && selectedNodeKey === record.nodeKey}
            onSelect={onSelect}
          />
          <ProblemTreeBranch
            childrenMap={childrenMap}
            parentId={record.problemId}
            depth={depth + 1}
            selectedNodeKey={selectedNodeKey}
            editorMode={editorMode}
            onSelect={onSelect}
          />
        </div>
      ))}
    </>
  );
}

export function ClaimProblemsPage({
  initialData,
  initialError,
}: {
  initialData: QualityClaimProblemRecord[];
  initialError?: string | null;
}) {
  const initialSelected = initialData[0] ?? null;
  const [editorMode, setEditorMode] = useState<EditorMode>("create");
  const [selectedProblemId, setSelectedProblemId] = useState<string | null>(initialSelected?.problemId ?? null);
  const [selectedNodeKey, setSelectedNodeKey] = useState<string | null>(initialSelected?.nodeKey ?? null);
  const [search, setSearch] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [formValues, setFormValues] = useState<QualityClaimProblemInput>(EMPTY_FORM_VALUES);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const deferredSearch = useDeferredValue(search);

  const { data, isValidating, mutate } = useSWR(
    API_ENDPOINT,
    claimProblemsFetcher,
    {
      fallbackData: initialData,
      revalidateOnFocus: false,
      dedupingInterval: 15_000,
      onError: (error) => toast.error(error?.message || "No se pudo cargar el arbol de problemas."),
    },
  );

  const records = data ?? initialData;
  const uniqueRecords = useMemo(() => {
    const map = new Map<string, QualityClaimProblemRecord>();
    for (const record of records) {
      if (!map.has(record.problemId)) {
        map.set(record.problemId, record);
      }
    }
    return Array.from(map.values());
  }, [records]);

  const selectedRecord = editorMode === "edit"
    ? uniqueRecords.find((record) => record.problemId === selectedProblemId) ?? null
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
        record.pathLabel,
        record.parentProblemName,
        formatScopeLabel(record.scope),
      ].some((value) => String(value ?? "").toLowerCase().includes(normalized)),
    );
  }, [deferredSearch, records]);

  const childrenMap = useMemo(() => {
    const map = new Map<string | null, QualityClaimProblemRecord[]>();
    for (const record of filteredRecords) {
      const parentId = record.parentProblemId ?? null;
      const current = map.get(parentId) ?? [];
      current.push(record);
      map.set(parentId, current);
    }

    for (const items of map.values()) {
      items.sort((left, right) => left.pathLabel.localeCompare(right.pathLabel, "es", { sensitivity: "base" }));
    }

    return map;
  }, [filteredRecords]);

  const summary = useMemo(() => {
    const latest = uniqueRecords.reduce<QualityClaimProblemRecord | null>(
      (best, record) => {
        if (!record.loadedAt) return best;
        if (!best || String(record.loadedAt) > String(best.loadedAt)) return record;
        return best;
      },
      null,
    );

    return {
      total: uniqueRecords.length,
      families: uniqueRecords.filter((record) => record.level === "family").length,
      latest,
    };
  }, [uniqueRecords]);

  const availableParents = useMemo(() => {
    if (formValues.level === "family") {
      return [];
    }

    return uniqueRecords.filter((record) => {
      if (record.level !== "family" || !record.isActive) {
        return false;
      }

      if (formValues.scope === "all") {
        return true;
      }

      return record.scope === formValues.scope || record.scope === "all";
    });
  }, [formValues.level, formValues.scope, uniqueRecords]);

  const generatedCode = useMemo(
    () => buildClaimProblemCode(formValues.level, formValues.scope, formValues.name || "ITEM"),
    [formValues.level, formValues.scope, formValues.name],
  );

  const previewParents = useMemo(() => {
    const ids = uniqueNonEmpty(formValues.parentProblemIds ?? []);
    return ids
      .map((parentId) => availableParents.find((item) => item.problemId === parentId)?.name ?? parentId)
      .filter(Boolean);
  }, [availableParents, formValues.parentProblemIds]);

  useEffect(() => {
    setFormValues(selectedRecord ? mapRecordToFormValues(selectedRecord) : EMPTY_FORM_VALUES);
    setFormErrors({});
  }, [selectedRecord]);

  function updateField<Key extends keyof QualityClaimProblemInput>(
    field: Key,
    value: QualityClaimProblemInput[Key],
  ) {
    setFormValues((current) => {
      if (field === "level") {
        const nextLevel = value as ClaimProblemLevel;
        return {
          ...current,
          level: nextLevel,
          parentProblemIds: nextLevel === "family" ? [] : (current.parentProblemIds?.length ? current.parentProblemIds : [""]),
        };
      }

      if (field === "scope") {
        return {
          ...current,
          scope: value as ClaimProblemScope,
          parentProblemIds: current.level === "family" ? [] : current.parentProblemIds ?? [""],
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

  function updateParentSlot(index: number, value: string) {
    setFormValues((current) => {
      const parentProblemIds = [...(current.parentProblemIds ?? [""])];
      parentProblemIds[index] = value;
      return {
        ...current,
        parentProblemIds,
      };
    });
    setFormErrors((current) => ({
      ...current,
      parentProblemIds: undefined,
    }));
  }

  function addParentSlot() {
    setFormValues((current) => ({
      ...current,
      parentProblemIds: [...(current.parentProblemIds ?? []), ""],
    }));
  }

  function removeParentSlot(index: number) {
    setFormValues((current) => ({
      ...current,
      parentProblemIds: (current.parentProblemIds ?? []).filter((_, currentIndex) => currentIndex !== index),
    }));
  }

  function openCreateMode() {
    startTransition(() => {
      setEditorMode("create");
      setSelectedProblemId(null);
      setSelectedNodeKey(null);
    });
  }

  function openEditMode(record: QualityClaimProblemRecord) {
    startTransition(() => {
      setEditorMode("edit");
      setSelectedProblemId(record.problemId);
      setSelectedNodeKey(record.nodeKey);
    });
  }

  function resetForm() {
    setFormValues(selectedRecord ? mapRecordToFormValues(selectedRecord) : EMPTY_FORM_VALUES);
    setFormErrors({});
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextErrors = validateForm(formValues);
    setFormErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      toast.error("Revisa los campos obligatorios antes de guardar.");
      return;
    }

    setIsSaving(true);

    try {
      const isEditing = editorMode === "edit" && selectedProblemId;
      const endpoint = isEditing
        ? `${API_ENDPOINT}/${encodeURIComponent(selectedProblemId)}`
        : API_ENDPOINT;
      const method = isEditing ? "PATCH" : "POST";
      const response = await fetchJson<QualityClaimProblemPayload>(
        endpoint,
        "No se pudo guardar el problema de reclamo.",
        {
          method,
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(currentPayload),
        },
      );

      toast.success(isEditing ? "Problema de reclamo actualizado correctamente." : "Problema de reclamo creado correctamente.");
      await mutate();
      startTransition(() => {
        setEditorMode("edit");
        setSelectedProblemId(response.data.problemId);
        setSelectedNodeKey(response.data.nodeKey);
      });
    } catch (submitError) {
      toast.error(
        submitError instanceof Error
          ? submitError.message
          : "No se pudo guardar el problema de reclamo.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  const parentSelectors = formValues.level === "subfamily"
    ? (formValues.parentProblemIds?.length ? formValues.parentProblemIds : [""])
    : [];

  return (
    <div className="space-y-4">
      <SectionPageShell
        eyebrow="Administracion / Maestros por dominio / Comercial / Problemas de reclamo"
        title="Problemas de reclamo"
        subtitle="Administra el arbol maestro de tipos de problema y problemas operativos del proceso de reclamos comercial. Cada guardado conserva trazabilidad SCD2 en db_commercial.public."
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
              Nuevo problema
            </Button>
          </div>
        )}
      >
        <FilterPanel>
          <KpiGrid>
            <MetricTile label="Ramas activas" value={String(summary.total)} hint="Tipos y problemas vigentes dentro del arbol maestro." />
            <MetricTile label="Tipos raiz" value={String(summary.families)} hint="Tipos de problema que actuan como familias del arbol." />
            <MetricTile label="Ultima carga" value={summary.latest?.loadedAt ? formatDateTime(summary.latest.loadedAt) : "-"} hint="Fecha de la ultima version guardada." />
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
                <CardTitle className="text-lg">Arbol de problemas</CardTitle>
                <CardDescription>Busca una rama para editarla o crea una nueva desde el formulario.</CardDescription>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="claim-problems-search">Buscar rama</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="claim-problems-search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar por codigo, nombre, alcance o ruta..."
                  className="pl-10"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-1">
            <div className="max-h-[calc(100dvh-16rem)] space-y-3 overflow-y-auto pr-1">
              {filteredRecords.length ? (
                <ProblemTreeBranch
                  childrenMap={childrenMap}
                  parentId={null}
                  depth={0}
                  selectedNodeKey={selectedNodeKey}
                  editorMode={editorMode}
                  onSelect={openEditMode}
                />
              ) : (
                <div className="rounded-[24px] border border-dashed border-border/70 bg-background/80 px-4 py-8 text-center text-sm text-muted-foreground">
                  No hay ramas que coincidan con el filtro actual.
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
                    {editorMode === "edit" ? "Editar version vigente" : "Nueva rama"}
                  </Badge>
                  {selectedRecord ? (
                    <Badge variant="secondary" className="rounded-full px-3 py-1">
                      {formatScopeLabel(selectedRecord.scope)}
                    </Badge>
                  ) : null}
                </div>
                <div>
                  <CardTitle className="text-lg">{selectedRecord ? selectedRecord.name : "Registrar rama"}</CardTitle>
                  <CardDescription>Primero defines el tipo de problema y luego sus problemas asociados. Un mismo problema puede colgar de uno o varios tipos superiores.</CardDescription>
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
                  <Label htmlFor="claim-problem-level">Nivel</Label>
                  <select
                    id="claim-problem-level"
                    className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                    value={formValues.level}
                    onChange={(event) => updateField("level", event.target.value as ClaimProblemLevel)}
                  >
                    {LEVEL_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="claim-problem-scope">Alcance</Label>
                  <select
                    id="claim-problem-scope"
                    className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                    value={formValues.scope}
                    onChange={(event) => updateField("scope", event.target.value as ClaimProblemScope)}
                  >
                    {SCOPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="claim-problem-code">Codigo estandarizado</Label>
                  <Input
                    id="claim-problem-code"
                    className="rounded-xl font-mono"
                    value={generatedCode}
                    readOnly
                  />
                  <p className="text-xs text-muted-foreground">El codigo se genera automaticamente desde alcance, nivel y nombre. Ya no se edita manualmente.</p>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="claim-problem-name">Nombre</Label>
                  <Input
                    id="claim-problem-name"
                    className="rounded-xl"
                    value={formValues.name}
                    onChange={(event) => updateField("name", event.target.value)}
                  />
                  {formErrors.name ? <p className="text-xs text-destructive">{formErrors.name}</p> : null}
                </div>

                {formValues.level === "subfamily" ? (
                  <div className="space-y-3 md:col-span-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="space-y-1">
                        <Label>Tipos de problema superior</Label>
                        <p className="text-xs text-muted-foreground">Puedes relacionar el mismo problema con una o varias familias superiores.</p>
                      </div>
                      <Button type="button" variant="outline" className="rounded-full" onClick={addParentSlot}>
                        <Plus className="size-4" />
                        Agregar tipo superior
                      </Button>
                    </div>

                    <div className="space-y-3">
                      {parentSelectors.map((parentProblemId, index) => (
                        <div key={`parent-slot-${index}`} className="flex gap-2">
                          <select
                            className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                            value={parentProblemId}
                            onChange={(event) => updateParentSlot(index, event.target.value)}
                          >
                            <option value="">Selecciona un tipo de problema</option>
                            {availableParents.map((option) => (
                              <option key={option.problemId} value={option.problemId}>{option.name}</option>
                            ))}
                          </select>
                          <Button
                            type="button"
                            variant="outline"
                            className="rounded-xl px-3"
                            onClick={() => removeParentSlot(index)}
                            disabled={parentSelectors.length <= 1}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                    {formErrors.parentProblemIds ? <p className="text-xs text-destructive">{formErrors.parentProblemIds}</p> : null}
                  </div>
                ) : (
                  <div className="space-y-2 md:col-span-2">
                    <Label>Tipos de problema superior</Label>
                    <Input className="rounded-xl" value="No aplica para tipos raiz." readOnly />
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="claim-problem-status">Estado</Label>
                  <select
                    id="claim-problem-status"
                    className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                    value={formValues.isActive ? "active" : "inactive"}
                    onChange={(event) => updateField("isActive", event.target.value === "active")}
                  >
                    <option value="active">Activo</option>
                    <option value="inactive">Inactivo</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label>Rutas esperadas</Label>
                  <div className="min-h-10 rounded-xl border border-input bg-background px-3 py-2 text-sm">
                    {formValues.level === "family" ? (
                      <span>{formValues.name.trim() || "(sin nombre)"}</span>
                    ) : previewParents.length ? (
                      <div className="space-y-1">
                        {previewParents.map((parentName) => (
                          <p key={parentName}>{parentName} {">"} {formValues.name.trim() || "(sin nombre)"}</p>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">Selecciona al menos un tipo superior para ver la ruta.</span>
                    )}
                  </div>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="claim-problem-description">Descripcion</Label>
                  <textarea
                    id="claim-problem-description"
                    rows={3}
                    className="flex min-h-[96px] w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                    value={formValues.description ?? ""}
                    onChange={(event) => updateField("description", event.target.value)}
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="claim-problem-reason">Motivo de cambio</Label>
                  <textarea
                    id="claim-problem-reason"
                    rows={3}
                    className="flex min-h-[96px] w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                    value={formValues.changeReason ?? ""}
                    onChange={(event) => updateField("changeReason", event.target.value)}
                    placeholder="Opcional. Ej. alta o depuracion de tipos y problemas de reclamo."
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
                      Guardar rama
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
