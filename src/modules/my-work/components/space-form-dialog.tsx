"use client";

import { type ReactNode, useState } from "react";

import { DialogShell } from "@/shared/overlays/dialog-shell";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { MY_WORK_SPACE_COLORS, type SpaceFormValue } from "@/modules/my-work/server/types";

const selectClassName =
  "h-11 w-full rounded-[16px] border border-input bg-background px-4 text-sm text-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/40";

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
          <Field label="Color">
            <select className={selectClassName} value={draft.colorToken} onChange={(event) => setDraft((current) => ({ ...current, colorToken: event.target.value as SpaceFormValue["colorToken"] }))}>
              {MY_WORK_SPACE_COLORS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </Field>
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
