"use client";

import { useEffect, useMemo, useState } from "react";
import { LoaderCircle, Save } from "lucide-react";
import { toast } from "sonner";

import { fetchJson } from "@/lib/fetch-json";
import type { PoscosechaSkuInput, PoscosechaSkuPayload, PoscosechaSkuRecord } from "@/lib/postcosecha-sku-types";
import { SheetShell } from "@/shared/overlays/sheet-shell";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { formatDateTime, formatDecimal } from "@/shared/lib/format";

type FormErrors = Partial<Record<keyof PoscosechaSkuInput, string>>;

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

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toInteger(value: unknown, fallback = 0) {
  return Math.round(toNumber(value, fallback));
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

  if (!payload.sku) errors.sku = "El SKU es obligatorio.";
  if (payload.pesoIdealBunch <= 0) errors.pesoIdealBunch = "El peso ideal debe ser mayor a cero.";
  if (payload.tallosMin < 1) errors.tallosMin = "Los tallos minimos deben ser al menos 1.";
  if (payload.tallosMax < payload.tallosMin) errors.tallosMax = "Los tallos maximos no pueden ser menores a los minimos.";
  if (payload.pesoMinObjetivo <= 0) errors.pesoMinObjetivo = "El peso minimo debe ser mayor a cero.";
  if (payload.pesoMaxObjetivo < payload.pesoMinObjetivo) errors.pesoMaxObjetivo = "El peso maximo no puede ser menor al minimo.";
  if (payload.maxGradosObjetivo < 1) errors.maxGradosObjetivo = "El maximo de grados debe ser al menos 1.";

  return errors;
}

export function SolverSkuInfoOverlay({
  record,
  onClose,
  onSaved,
}: {
  record: PoscosechaSkuRecord | null;
  onClose: () => void;
  onSaved: (record: PoscosechaSkuRecord) => void;
}) {
  const [formValues, setFormValues] = useState<PoscosechaSkuInput | null>(record ? mapRecordToFormValues(record) : null);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setFormValues(record ? mapRecordToFormValues(record) : null);
    setFormErrors({});
  }, [record]);

  const currentRecord = record;
  const currentFormValues = formValues;
  const isOpen = currentRecord !== null && currentFormValues !== null;
  const currentPayload = useMemo(
    () => (currentFormValues ? buildPayload(currentFormValues) : null),
    [currentFormValues],
  );

  if (!currentRecord || !currentFormValues || !currentPayload) {
    return null;
  }

  function updateField<Key extends keyof PoscosechaSkuInput>(
    key: Key,
    value: PoscosechaSkuInput[Key],
  ) {
    setFormValues((current) => (current ? { ...current, [key]: value } : current));
    setFormErrors((current) => ({ ...current, [key]: undefined }));
  }

  async function handleSave() {
    const recordToSave = currentRecord;
    const formToSave = currentFormValues;

    if (!recordToSave || !formToSave) {
      return;
    }

    const errors = validateForm(formToSave);
    setFormErrors(errors);

    if (Object.keys(errors).length > 0) {
      toast.error("Revisa los campos obligatorios antes de guardar el SKU.");
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetchJson<PoscosechaSkuPayload>(
        `/api/postcosecha/administrar-maestros/skus/${encodeURIComponent(recordToSave.skuId)}`,
        "No se pudo actualizar el SKU del solver.",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(currentPayload),
        },
      );

      onSaved(response.data);
      toast.success("SKU actualizado correctamente.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo actualizar el SKU del solver.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <SheetShell
      open={isOpen}
      onClose={onClose}
      widthClassName="max-w-3xl"
      title={currentRecord.sku}
      description="Detalle operativo del SKU maestro usado por Clasificacion en blanco."
      footer={(
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cerrar
          </Button>
          <Button type="button" onClick={() => void handleSave()} disabled={isSaving}>
            {isSaving ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
            Guardar cambios
          </Button>
        </div>
      )}
    >
      <div className="space-y-5">
        <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="rounded-full px-3 py-1">
            Valido desde {currentRecord.validFrom ? formatDateTime(currentRecord.validFrom) : "-"}
          </Badge>
          <Badge variant="secondary" className="rounded-full px-3 py-1">
            Actor {currentRecord.actorId ?? "-"}
          </Badge>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <Field label="SKU" error={formErrors.sku}>
            <Input value={currentFormValues.sku} onChange={(event) => updateField("sku", event.target.value)} />
          </Field>
          <Field label="Peso ideal bunch (g)" error={formErrors.pesoIdealBunch}>
            <Input
              type="number"
              min={0}
              step={0.01}
              value={currentFormValues.pesoIdealBunch}
              onChange={(event) => updateField("pesoIdealBunch", toNumber(event.target.value, 0))}
            />
          </Field>
          <Field label="Tallos min" error={formErrors.tallosMin}>
            <Input
              type="number"
              min={1}
              step={1}
              value={currentFormValues.tallosMin}
              onChange={(event) => updateField("tallosMin", toInteger(event.target.value, 1))}
            />
          </Field>
          <Field label="Tallos max" error={formErrors.tallosMax}>
            <Input
              type="number"
              min={1}
              step={1}
              value={currentFormValues.tallosMax}
              onChange={(event) => updateField("tallosMax", toInteger(event.target.value, 1))}
            />
          </Field>
          <Field label="Peso min objetivo (g)" error={formErrors.pesoMinObjetivo}>
            <Input
              type="number"
              min={0}
              step={0.01}
              value={currentFormValues.pesoMinObjetivo}
              onChange={(event) => updateField("pesoMinObjetivo", toNumber(event.target.value, 0))}
            />
          </Field>
          <Field label="Peso max objetivo (g)" error={formErrors.pesoMaxObjetivo}>
            <Input
              type="number"
              min={0}
              step={0.01}
              value={currentFormValues.pesoMaxObjetivo}
              onChange={(event) => updateField("pesoMaxObjetivo", toNumber(event.target.value, 0))}
            />
          </Field>
          <Field label="Max grados objetivo" error={formErrors.maxGradosObjetivo}>
            <Input
              type="number"
              min={1}
              step={1}
              value={currentFormValues.maxGradosObjetivo}
              onChange={(event) => updateField("maxGradosObjetivo", toInteger(event.target.value, 3))}
            />
          </Field>
          <Field label="Motivo del cambio">
            <Input
              value={currentFormValues.changeReason ?? ""}
              onChange={(event) => updateField("changeReason", event.target.value)}
              placeholder="Ej. ajuste operativo para solver"
            />
          </Field>
        </div>

        <div className="rounded-[24px] border border-border/70 bg-background/80 p-4 text-sm text-muted-foreground">
          <p>Peso ideal actual: {formatDecimal(currentRecord.pesoIdealBunch)} g.</p>
          <p>
            Rango objetivo vigente: {formatDecimal(currentRecord.pesoMinObjetivo)} - {formatDecimal(currentRecord.pesoMaxObjetivo)} g.
          </p>
        </div>
      </div>
    </SheetShell>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
