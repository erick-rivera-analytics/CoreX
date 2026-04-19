"use client";

import { type ReactNode, useState } from "react";

import { DialogShell } from "@/shared/overlays/dialog-shell";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { ToggleSwitch } from "@/shared/forms/toggle-switch";
import type { EventFormValue, MyWorkSpace, MyWorkTask } from "@/modules/my-work/server/types";

const selectClassName =
  "h-11 w-full rounded-[16px] border border-input bg-background px-4 text-sm text-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/40";
const textareaClassName =
  "flex min-h-[120px] w-full rounded-[16px] border border-input bg-background px-4 py-3 text-sm text-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/40";

export function EventFormDialog({
  open,
  spaces,
  tasks,
  initialValue,
  onClose,
  onSubmit,
  onArchive,
}: {
  open: boolean;
  spaces: MyWorkSpace[];
  tasks: MyWorkTask[];
  initialValue: EventFormValue | null;
  onClose: () => void;
  onSubmit: (value: EventFormValue) => void | Promise<void>;
  onArchive?: () => void | Promise<void>;
}) {
  const [draft, setDraft] = useState<EventFormValue>(() => buildDraft(initialValue, spaces));

  const linkedTasks = tasks.filter((task) => !task.isArchived);
  const dateInputType = draft.allDay ? "date" : "datetime-local";

  return (
    <DialogShell
      open={open}
      onClose={onClose}
      maxWidth="max-w-2xl"
      title={draft.id ? "Editar evento" : "Nuevo evento"}
      description="Bloque operativo para agenda personal, con enlace opcional a tarea."
    >
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Espacio">
            <select className={selectClassName} value={draft.spaceId} onChange={(event) => setDraft((current) => ({ ...current, spaceId: event.target.value }))}>
              {spaces.map((space) => (
                <option key={space.id} value={space.id}>{space.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Tarea ligada (opcional)">
            <select className={selectClassName} value={draft.linkedTaskId} onChange={(event) => setDraft((current) => ({ ...current, linkedTaskId: event.target.value }))}>
              <option value="">Sin tarea ligada</option>
              {linkedTasks.map((task) => (
                <option key={task.id} value={task.id}>{task.title}</option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Titulo">
          <Input value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} />
        </Field>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label={draft.allDay ? "Fecha inicio" : "Inicio"}>
            <Input type={dateInputType} value={draft.startAt} onChange={(event) => setDraft((current) => ({ ...current, startAt: event.target.value }))} />
          </Field>
          <Field label={draft.allDay ? "Fecha fin" : "Fin"}>
            <Input type={dateInputType} value={draft.endAt} onChange={(event) => setDraft((current) => ({ ...current, endAt: event.target.value }))} />
          </Field>
        </div>
        <Field label="Ubicacion">
          <Input value={draft.locationText} onChange={(event) => setDraft((current) => ({ ...current, locationText: event.target.value }))} />
        </Field>
        <Field label="Detalle">
          <textarea className={textareaClassName} value={draft.details} onChange={(event) => setDraft((current) => ({ ...current, details: event.target.value }))} />
        </Field>
        <div className="grid gap-3 md:grid-cols-2">
          <ToggleRow
            title="Todo el dia"
            hint="Cambia los campos de fecha a modo dia completo."
            checked={draft.allDay}
            onCheckedChange={(checked) => setDraft((current) => ({ ...current, allDay: checked }))}
          />
          <ToggleRow
            title="Marcar ocupado"
            hint="Ayuda a visualizar huecos libres y bloqueados en la agenda."
            checked={draft.isBusy}
            onCheckedChange={(checked) => setDraft((current) => ({ ...current, isBusy: checked }))}
          />
        </div>
        <div className="flex justify-end gap-2">
          {onArchive ? <Button type="button" variant="outline" onClick={() => { void onArchive(); }}>Archivar</Button> : null}
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="button" onClick={() => { void onSubmit(draft); }} disabled={!draft.title.trim() || !draft.spaceId || !draft.startAt}>
            Guardar evento
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

function ToggleRow({
  title,
  hint,
  checked,
  onCheckedChange,
}: {
  title: string;
  hint: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-[18px] border border-border/70 bg-background/70 px-4 py-3">
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{hint}</p>
      </div>
      <ToggleSwitch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function buildDraft(initialValue: EventFormValue | null, spaces: MyWorkSpace[]) {
  return initialValue ?? {
    spaceId: spaces[0]?.id ?? "",
    title: "",
    details: "",
    startAt: "",
    endAt: "",
    linkedTaskId: "",
    allDay: false,
    isBusy: true,
    locationText: "",
  };
}
