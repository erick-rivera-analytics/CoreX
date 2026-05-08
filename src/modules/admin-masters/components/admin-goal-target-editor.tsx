"use client";

import { ArrowDown, ArrowUp, Plus, Save, X } from "lucide-react";

import { Badge } from "@/shared/ui/badge";
import { DateField } from "@/shared/filters/date-field";
import { MultiSelectField } from "@/shared/filters/multi-select-field";
import { SingleSelectField } from "@/shared/filters/single-select-field";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";

export type VariantValue = {
  level_key: string;
  level_label: string;
  value_code: string;
  value_label: string;
};

export type MetaEditorForm = {
  grainCode: string;
  targetCode: string;
  metricCode: string;
  domainCodesEncoded: string;
  typeItemCodesEncoded: string;
  operatorCode: string;
  valueMin: string;
  valueMax: string;
  valueText: string;
  validFromDate: string;
  notesText: string;
  changeReason: string;
  variantValues: VariantValue[];
};

export type EditorOption = { code: string; label: string };
export type EditorMode = "idle" | "create-meta" | "add-variant" | "edit-variant";

type Props = {
  mode: EditorMode;
  form: MetaEditorForm;
  setForm: React.Dispatch<React.SetStateAction<MetaEditorForm>>;
  grainLabel: string | null;
  metricOptions: EditorOption[];
  domainOptions: EditorOption[];
  goalTypeOptions: EditorOption[];
  operatorOptions: EditorOption[];
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  onDeactivate?: () => void;
  onCancel: () => void;
};

const RANGE_OPS = new Set(["between"]);

function labelOf(opts: EditorOption[]) {
  const map = new Map(opts.map((o) => [o.code, o.label] as const));
  return (v: string) => map.get(v) ?? v;
}

function ScopeLevelEditor({
  values,
  setForm,
}: {
  values: VariantValue[];
  setForm: React.Dispatch<React.SetStateAction<MetaEditorForm>>;
}) {
  function updateLevel(index: number, patch: Partial<VariantValue>) {
    setForm((current) => ({
      ...current,
      variantValues: current.variantValues.map((level, i) =>
        i === index ? { ...level, ...patch } : level,
      ),
    }));
  }

  function moveLevel(index: number, direction: -1 | 1) {
    setForm((current) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.variantValues.length) return current;
      const nextValues = [...current.variantValues];
      const [item] = nextValues.splice(index, 1);
      if (!item) return current;
      nextValues.splice(nextIndex, 0, item);
      return { ...current, variantValues: nextValues };
    });
  }

  return (
    <div className="space-y-3">
      {values.length === 0 && (
        <p className="rounded-xl border border-dashed border-border/70 px-3 py-4 text-xs text-muted-foreground">
          Sin niveles definidos. Puedes crear caminos con 3, 4, 6 o cualquier cantidad de niveles.
        </p>
      )}

      {values.map((level, index) => (
        <div key={`${index}-${level.level_key || "level"}`} className="rounded-lg border border-border/50 bg-background/60 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-muted-foreground">Nivel {index + 1}</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30"
                disabled={index === 0}
                title="Subir nivel"
                onClick={() => moveLevel(index, -1)}
              >
                <ArrowUp className="size-3.5" />
              </button>
              <button
                type="button"
                className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30"
                disabled={index === values.length - 1}
                title="Bajar nivel"
                onClick={() => moveLevel(index, 1)}
              >
                <ArrowDown className="size-3.5" />
              </button>
              <button
                type="button"
                className="rounded-full p-1 text-muted-foreground transition-colors hover:text-destructive"
                title="Quitar nivel"
                onClick={() =>
                  setForm((current) => ({
                    ...current,
                    variantValues: current.variantValues.filter((_, i) => i !== index),
                  }))
                }
              >
                <X className="size-3.5" />
              </button>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Clave (level_key)</Label>
              <Input
                className="rounded-lg font-mono text-xs"
                value={level.level_key}
                placeholder="variety_code"
                onChange={(e) => updateLevel(index, { level_key: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Etiqueta dimensión</Label>
              <Input
                className="rounded-lg text-xs"
                value={level.level_label}
                placeholder="Variedad"
                onChange={(e) => updateLevel(index, { level_label: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Código del valor</Label>
              <Input
                className="rounded-lg font-mono text-xs"
                value={level.value_code}
                placeholder="CLO"
                onChange={(e) => updateLevel(index, { value_code: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Etiqueta del valor</Label>
              <Input
                className="rounded-lg text-xs"
                value={level.value_label}
                placeholder="CLO"
                onChange={(e) => updateLevel(index, { value_label: e.target.value })}
              />
            </div>
          </div>
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="rounded-full gap-1.5"
        onClick={() =>
          setForm((current) => ({
            ...current,
            variantValues: [
              ...current.variantValues,
              { level_key: "", level_label: "", value_code: "", value_label: "" },
            ],
          }))
        }
      >
        <Plus className="size-3.5" />
        Agregar nivel
      </Button>
    </div>
  );
}

export function AdminGoalTargetEditor({
  mode,
  form,
  setForm,
  grainLabel,
  metricOptions,
  domainOptions,
  goalTypeOptions,
  operatorOptions,
  onSubmit,
  onDeactivate,
  onCancel,
}: Props) {
  if (mode === "idle") {
    return (
      <Card className="starter-panel border-border/70 bg-card/84 flex min-h-[280px] items-center justify-center">
        <div className="space-y-1 text-center text-sm text-muted-foreground">
          <p className="font-medium">Ninguna variante seleccionada</p>
          <p className="text-xs">Crea una nueva meta o selecciona una variante del catálogo.</p>
        </div>
      </Card>
    );
  }

  const showRange = RANGE_OPS.has(form.operatorCode);
  const isCreate = mode === "create-meta";
  const isAdd = mode === "add-variant";
  const isEdit = mode === "edit-variant";

  return (
    <Card className="starter-panel border-border/70 bg-card/84 xl:sticky xl:top-4 xl:self-start">
      <CardHeader>
        <CardTitle className="text-lg">
          {isCreate && "Nueva meta"}
          {isAdd && `Agregar camino - ${grainLabel ?? ""}`}
          {isEdit && (grainLabel ?? "Editar variante")}
        </CardTitle>
        <CardDescription>
          {isCreate && "Define la identidad de la meta y el primer camino. Cada camino puede tener sus propios niveles."}
          {isAdd && "Crea una hoja nueva. Puedes reutilizar niveles existentes o cambiarlos libremente sin afectar otras ramas."}
          {isEdit && "Solo puedes modificar el valor objetivo. Al guardar se cierra la versión vigente y se inserta una nueva (SCD2)."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-5" onSubmit={onSubmit}>
          {isCreate && (
            <div className="space-y-4 rounded-xl border border-border/60 bg-muted/20 p-4">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Identidad de la meta
              </Label>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="grain-code">Grain code</Label>
                  <Input
                    id="grain-code"
                    className="rounded-xl font-mono text-sm"
                    value={form.grainCode}
                    onChange={(e) => setForm((current) => ({ ...current, grainCode: e.target.value }))}
                    placeholder="ej: boxes_per_bed"
                  />
                </div>
                <div className="space-y-2">
                  <SingleSelectField
                    id="target-metric"
                    label="Métrica"
                    value={form.metricCode || "all"}
                    options={metricOptions.map((o) => o.code)}
                    displayValue={labelOf(metricOptions)}
                    emptyLabel="Sin métrica"
                    onChange={(v) => setForm((current) => ({ ...current, metricCode: v === "all" ? "" : v }))}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <MultiSelectField
                    id="target-domains"
                    label="Dominios"
                    value={form.domainCodesEncoded}
                    options={domainOptions.map((o) => o.code)}
                    displayValue={labelOf(domainOptions)}
                    onChange={(v) => setForm((current) => ({ ...current, domainCodesEncoded: v }))}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <MultiSelectField
                    id="target-types"
                    label="Tipos de meta"
                    value={form.typeItemCodesEncoded}
                    options={goalTypeOptions.map((o) => o.code)}
                    displayValue={labelOf(goalTypeOptions)}
                    onChange={(v) => setForm((current) => ({ ...current, typeItemCodesEncoded: v }))}
                  />
                </div>
              </div>
            </div>
          )}

          <div className="space-y-3 rounded-xl border border-border/60 bg-muted/20 p-4">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Valor objetivo
            </Label>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <SingleSelectField
                  id="target-operator"
                  label="Operador"
                  value={form.operatorCode || "all"}
                  options={operatorOptions.map((o) => o.code)}
                  displayValue={labelOf(operatorOptions)}
                  emptyLabel="Sin operador"
                  onChange={(v) => setForm((current) => ({ ...current, operatorCode: v === "all" ? "" : v }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="value-min">{showRange ? "Valor mínimo" : "Valor"}</Label>
                <Input
                  id="value-min"
                  type="number"
                  className="rounded-xl"
                  value={form.valueMin}
                  onChange={(e) => setForm((current) => ({ ...current, valueMin: e.target.value }))}
                />
              </div>
              {showRange && (
                <div className="space-y-2">
                  <Label htmlFor="value-max">Valor máximo</Label>
                  <Input
                    id="value-max"
                    type="number"
                    className="rounded-xl"
                    value={form.valueMax}
                    onChange={(e) => setForm((current) => ({ ...current, valueMax: e.target.value }))}
                  />
                </div>
              )}
            </div>
          </div>

          {(isCreate || isAdd) && (
            <div className="space-y-3 rounded-xl border border-border/60 bg-muted/30 p-4">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Camino / niveles dinámicos
                </Label>
                <span className="text-[11px] text-muted-foreground">
                  {form.variantValues.length} {form.variantValues.length === 1 ? "nivel" : "niveles"}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                El JSONB genera `levels` y `filters` desde estas claves. Un mismo grain puede tener ramas con distinta profundidad.
              </p>
              <ScopeLevelEditor values={form.variantValues} setForm={setForm} />
            </div>
          )}

          {isEdit && form.variantValues.length > 0 && (
            <div className="space-y-2 rounded-xl border border-border/60 bg-muted/30 p-3">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Alcance - solo lectura
              </Label>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {form.variantValues.map((level) => (
                  <Badge key={level.level_key} variant="outline" className="rounded-full px-2 py-0.5 text-[11px] font-normal">
                    <span className="font-medium">{level.level_label}:</span>&nbsp;{level.value_label}
                  </Badge>
                ))}
              </div>
              {form.grainCode && (
                <p className="font-mono text-[10px] text-muted-foreground">{form.grainCode}</p>
              )}
            </div>
          )}

          {!isEdit && (
            <div className="space-y-2">
              <Label htmlFor="target-code">Código de variante</Label>
              <Input
                id="target-code"
                className="rounded-xl font-mono text-sm"
                value={form.targetCode}
                onChange={(e) => setForm((current) => ({ ...current, targetCode: e.target.value }))}
                placeholder="Se autogenera si lo dejas vacío"
              />
              <p className="text-[11px] text-muted-foreground">
                Avanzado. Si queda vacío, se genera desde métrica + niveles.
              </p>
            </div>
          )}

          <DateField
            id="target-valid-from"
            label="Vigente desde"
            value={form.validFromDate}
            onChange={(v) => setForm((current) => ({ ...current, validFromDate: v }))}
            helperText={isEdit ? "La versión anterior se cierra automáticamente un día antes." : undefined}
          />

          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="target-notes">Notas</Label>
              <textarea
                id="target-notes"
                rows={2}
                className="flex min-h-[64px] w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                value={form.notesText}
                onChange={(e) => setForm((current) => ({ ...current, notesText: e.target.value }))}
              />
            </div>
            {isEdit && (
              <div className="space-y-2">
                <Label htmlFor="target-reason">Motivo del cambio</Label>
                <Input
                  id="target-reason"
                  className="rounded-xl"
                  value={form.changeReason}
                  onChange={(e) => setForm((current) => ({ ...current, changeReason: e.target.value }))}
                  placeholder="Opcional. Se registra en el historial."
                />
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" className="rounded-full" onClick={onCancel}>
              Cancelar
            </Button>
            {isEdit && onDeactivate && (
              <Button type="button" variant="outline" className="rounded-full" onClick={onDeactivate}>
                Desactivar
              </Button>
            )}
            <Button type="submit" className="rounded-full">
              <Save className="size-4" />
              {isEdit ? "Guardar nueva versión" : isAdd ? "Agregar camino" : "Crear meta"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
