"use client";

import { type ReactNode, useState } from "react";

import { DialogShell } from "@/shared/overlays/dialog-shell";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { SingleSelectField } from "@/shared/filters/single-select-field";
import { MY_WORK_SPACE_COLORS, type SpaceFormValue } from "@/modules/my-work/server/types";

export function SpaceFormDialog({
  open,
  initialValue,
  onClose,
  onSubmit,
  onArchive,
}: {
  open: boolean;
  initialValue: SpaceFormValue | null;
  onClose: () => void;
  onSubmit: (value: SpaceFormValue) => void | Promise<void>;
  onArchive?: () => void | Promise<void>;
}) {
  const [draft, setDraft] = useState<SpaceFormValue>(() => initialValue ?? {
    name: "",
    colorToken: "slate",
    sortOrder: 0,
  });

  return (
    <DialogShell
      open={open}
      onClose={onClose}
      maxWidth="max-w-lg"
      title={draft.id ? "Editar espacio" : "Nuevo espacio"}
      description="Bloque simple para organizar tareas y agenda personal por contexto."
    >
      <div className="space-y-4">
        <Field label="Nombre">
          <Input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} />
        </Field>
        <div className="grid gap-4 md:grid-cols-2">
          <SingleSelectField
            id="space-color"
            label="Color"
            value={draft.colorToken}
            emptyValue="slate"
            emptyLabel="Grafito"
            options={MY_WORK_SPACE_COLORS.slice(1).map((o) => o.value)}
            displayValue={(v) => MY_WORK_SPACE_COLORS.find((o) => o.value === v)?.label ?? v}
            onChange={(v) => setDraft((current) => ({ ...current, colorToken: v as SpaceFormValue["colorToken"] }))}
          />
          <Field label="Orden">
            <Input type="number" min={0} value={String(draft.sortOrder)} onChange={(event) => setDraft((current) => ({ ...current, sortOrder: Number(event.target.value || 0) }))} />
          </Field>
        </div>
        <div className="flex justify-end gap-2">
          {onArchive ? <Button type="button" variant="outline" onClick={() => { void onArchive(); }}>Archivar</Button> : null}
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="button" onClick={() => { void onSubmit(draft); }} disabled={!draft.name.trim()}>
            Guardar espacio
          </Button>
        </div>
      </div>
    </DialogShell>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
