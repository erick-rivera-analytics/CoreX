"use client";

import { startTransition, useDeferredValue, useEffect, useMemo, useState } from "react";
import { ClipboardList, DatabaseZap, PencilLine, Plus, RefreshCcw, Save, Search } from "lucide-react";
import { toast } from "sonner";
import useSWR from "swr";

import { fetchJson } from "@/lib/fetch-json";
import type {
  BodegaCategoryInput,
  BodegaCategoryLevel,
  BodegaCategoryPayload,
  BodegaCategoryRecord,
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

type BodegaCategoriasPageProps = {
  initialData: BodegaCategoryRecord[];
  initialError?: string | null;
};

type EditorMode = "create" | "edit";
type FormErrors = Partial<Record<keyof BodegaCategoryInput, string>>;

const EMPTY_FORM_VALUES: BodegaCategoryInput = {
  code: "",
  name: "",
  level: "family",
  parentCategoryId: null,
  sortOrder: 10,
  description: "",
  isActive: true,
  changeReason: "",
};

const LEVEL_OPTIONS: Array<{ value: BodegaCategoryLevel; label: string }> = [
  { value: "family", label: "Familia" },
  { value: "subfamily", label: "Subfamilia" },
];

const categoriesFetcher = (url: string) =>
  fetchJson<BodegaCategoryRecord[]>(url, "No se pudo cargar el catalogo de Bodega.");

function mapRecordToFormValues(record: BodegaCategoryRecord): BodegaCategoryInput {
  return {
    code: record.code,
    name: record.name,
    level: record.level,
    parentCategoryId: record.parentCategoryId,
    sortOrder: record.sortOrder,
    description: record.description ?? "",
    isActive: record.isActive,
    changeReason: "",
  };
}

function buildPayload(values: BodegaCategoryInput): BodegaCategoryInput {
  return {
    code: values.code.trim().toUpperCase(),
    name: values.name.trim(),
    level: values.level,
    parentCategoryId: values.level === "family" ? null : (values.parentCategoryId?.trim() || null),
    sortOrder: Math.max(Math.round(Number(values.sortOrder) || 0), 0),
    description: values.description?.trim() || null,
    isActive: values.isActive,
    changeReason: values.changeReason?.trim() || null,
  };
}

function validateForm(values: BodegaCategoryInput): FormErrors {
  const payload = buildPayload(values);
  const errors: FormErrors = {};

  if (!payload.code) errors.code = "El codigo es obligatorio.";
  if (!payload.name) errors.name = "El nombre es obligatorio.";
  if (payload.level === "subfamily" && !payload.parentCategoryId) {
    errors.parentCategoryId = "Debes seleccionar una categoria superior.";
  }

  return errors;
}

function TreeNode({
  record,
  depth,
  selected,
  onSelect,
}: {
  record: BodegaCategoryRecord;
  depth: number;
  selected: boolean;
  onSelect: (categoryId: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(record.categoryId)}
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
            {record.level}
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

function CategoryTreeBranch({
  childrenMap,
  parentId,
  depth,
  selectedCategoryId,
  editorMode,
  onSelect,
}: {
  childrenMap: Map<string | null, BodegaCategoryRecord[]>;
  parentId: string | null;
  depth: number;
  selectedCategoryId: string | null;
  editorMode: EditorMode;
  onSelect: (categoryId: string) => void;
}) {
  const items = childrenMap.get(parentId) ?? [];
  return (
    <>
      {items.map((record) => (
        <div key={record.categoryId} className="space-y-3">
          <TreeNode
            record={record}
            depth={depth}
            selected={editorMode === "edit" && selectedCategoryId === record.categoryId}
            onSelect={onSelect}
          />
          <CategoryTreeBranch
            childrenMap={childrenMap}
            parentId={record.categoryId}
            depth={depth + 1}
            selectedCategoryId={selectedCategoryId}
            editorMode={editorMode}
            onSelect={onSelect}
          />
        </div>
      ))}
    </>
  );
}

export function BodegaCategoriasPage({
  initialData,
  initialError,
}: BodegaCategoriasPageProps) {
  const [editorMode, setEditorMode] = useState<EditorMode>("create");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(initialData[0]?.categoryId ?? null);
  const [search, setSearch] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [formValues, setFormValues] = useState<BodegaCategoryInput>(EMPTY_FORM_VALUES);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const deferredSearch = useDeferredValue(search);

  const { data, isValidating, mutate } = useSWR(
    "/api/bodega/administrar-maestros/categorias",
    categoriesFetcher,
    {
      fallbackData: initialData,
      revalidateOnFocus: false,
      dedupingInterval: 15000,
      onError: (error) => toast.error(error?.message || "No se pudo cargar el catalogo de Bodega."),
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

    return records.filter((record) => {
      return [record.code, record.name, record.pathLabel]
        .some((value) => String(value ?? "").toLowerCase().includes(normalized));
    });
  }, [deferredSearch, records]);

  const childrenMap = useMemo(() => {
    const map = new Map<string | null, BodegaCategoryRecord[]>();
    for (const record of filteredRecords) {
      const parentId = record.parentCategoryId ?? null;
      const current = map.get(parentId) ?? [];
      current.push(record);
      map.set(parentId, current);
    }

    for (const items of map.values()) {
      items.sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name));
    }

    return map;
  }, [filteredRecords]);

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
      families: records.filter((record) => record.level === "family").length,
      latest,
    };
  }, [records]);

  const availableParents = useMemo(() => {
    if (formValues.level === "family") return [];
    return records.filter((record) => record.level === "family" && record.isActive);
  }, [formValues.level, records]);

  useEffect(() => {
    setFormValues(selectedRecord ? mapRecordToFormValues(selectedRecord) : EMPTY_FORM_VALUES);
    setFormErrors({});
  }, [selectedRecord]);

  function updateField<Key extends keyof BodegaCategoryInput>(field: Key, value: BodegaCategoryInput[Key]) {
    setFormValues((current) => {
      if (field === "level") {
        const nextLevel = value as BodegaCategoryLevel;
        return {
          ...current,
          level: nextLevel,
          parentCategoryId: nextLevel === "family" ? null : current.parentCategoryId,
        };
      }

      return {
        ...current,
        [field]: value,
      };
    });
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
        ? `/api/bodega/administrar-maestros/categorias/${encodeURIComponent(selectedCategoryId)}`
        : "/api/bodega/administrar-maestros/categorias";
      const method = isEditing ? "PATCH" : "POST";
      const response = await fetchJson<BodegaCategoryPayload>(
        endpoint,
        "No se pudo guardar la categoria.",
        {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(currentPayload),
        },
      );

      toast.success(isEditing ? "Categoria actualizada correctamente." : "Categoria creada correctamente.");
      await mutate();
      startTransition(() => {
        setEditorMode("edit");
        setSelectedCategoryId(response.data.categoryId);
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar la categoria.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <SectionPageShell
        eyebrow="Gestion / Bodega / Administrar Maestros"
        title="Configurar catalogo"
        subtitle="Arbol operativo del catalogo de Bodega organizado en familias y subfamilias. Cada guardado crea una nueva version vigente y conserva trazabilidad SCD2 en db_camp.public."
        icon={<ClipboardList className="size-5" aria-hidden="true" />}
        actions={(
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" className="rounded-full" onClick={() => void mutate()}>
              <RefreshCcw className={cn("size-4", isValidating && "animate-spin")} />
              Recargar
            </Button>
            <Button type="button" className="rounded-full" onClick={openCreateMode}>
              <Plus className="size-4" />
              Nueva rama
            </Button>
          </div>
        )}
      >
        <FilterPanel>
          <KpiGrid>
            <MetricTile label="Ramas activas" value={String(summary.total)} hint="Familias y subfamilias vigentes." />
            <MetricTile label="Familias raiz" value={String(summary.families)} hint="Ramas superiores del arbol." />
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
                <CardTitle className="text-lg">Arbol del catalogo</CardTitle>
                <CardDescription>Busca una rama para editarla o crea una nueva desde el formulario.</CardDescription>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="bodega-categorias-search">Buscar rama</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="bodega-categorias-search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar por codigo, nombre o ruta..."
                  className="pl-10"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-1">
            <div className="max-h-[calc(100dvh-16rem)] space-y-3 overflow-y-auto pr-1">
              {filteredRecords.length ? (
                <CategoryTreeBranch
                  childrenMap={childrenMap}
                  parentId={null}
                  depth={0}
                  selectedCategoryId={selectedCategoryId}
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
                      {selectedRecord.level}
                    </Badge>
                  ) : null}
                </div>
                <div>
                  <CardTitle className="text-lg">{selectedRecord ? selectedRecord.name : "Registrar rama"}</CardTitle>
                  <CardDescription>El usuario operativo luego solo busca esta rama desde Productos.</CardDescription>
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
                  <Label htmlFor="category-level">Nivel</Label>
                  <select
                    id="category-level"
                    className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                    value={formValues.level}
                    onChange={(event) => updateField("level", event.target.value as BodegaCategoryLevel)}
                  >
                    {LEVEL_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category-parent">Categoria superior</Label>
                  <select
                    id="category-parent"
                    className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                    value={formValues.parentCategoryId ?? ""}
                    onChange={(event) => updateField("parentCategoryId", event.target.value || null)}
                    disabled={formValues.level === "family"}
                  >
                    <option value="">{formValues.level === "family" ? "No aplica" : "Selecciona una familia"}</option>
                    {availableParents.map((option) => (
                      <option key={option.categoryId} value={option.categoryId}>{option.pathLabel}</option>
                    ))}
                  </select>
                  {formErrors.parentCategoryId ? <p className="text-xs text-destructive">{formErrors.parentCategoryId}</p> : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category-code">Codigo</Label>
                  <Input id="category-code" className="rounded-xl" value={formValues.code} onChange={(event) => updateField("code", event.target.value)} />
                  {formErrors.code ? <p className="text-xs text-destructive">{formErrors.code}</p> : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category-order">Orden visual</Label>
                  <Input
                    id="category-order"
                    type="number"
                    step="1"
                    min="0"
                    className="rounded-xl"
                    value={formValues.sortOrder}
                    onChange={(event) => updateField("sortOrder", Number(event.target.value))}
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="category-name">Nombre</Label>
                  <Input id="category-name" className="rounded-xl" value={formValues.name} onChange={(event) => updateField("name", event.target.value)} />
                  {formErrors.name ? <p className="text-xs text-destructive">{formErrors.name}</p> : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category-status">Estado</Label>
                  <select
                    id="category-status"
                    className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                    value={formValues.isActive ? "active" : "inactive"}
                    onChange={(event) => updateField("isActive", event.target.value === "active")}
                  >
                    <option value="active">Activa</option>
                    <option value="inactive">Inactiva</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category-preview">Ruta esperada</Label>
                  <Input
                    id="category-preview"
                    className="rounded-xl"
                    value={[
                      availableParents.find((item) => item.categoryId === formValues.parentCategoryId)?.pathLabel,
                      formValues.name.trim() || "(sin nombre)",
                    ].filter(Boolean).join(" > ")}
                    readOnly
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="category-description">Descripcion</Label>
                  <textarea
                    id="category-description"
                    rows={3}
                    className="flex min-h-[96px] w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                    value={formValues.description ?? ""}
                    onChange={(event) => updateField("description", event.target.value)}
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="category-reason">Motivo de cambio</Label>
                  <textarea
                    id="category-reason"
                    rows={3}
                    className="flex min-h-[96px] w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                    value={formValues.changeReason ?? ""}
                    onChange={(event) => updateField("changeReason", event.target.value)}
                    placeholder="Opcional. Ej. reorganizacion de familias y subfamilias de bodega."
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
