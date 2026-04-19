"use client";

import { type ReactNode, useState } from "react";

import { DialogShell } from "@/shared/overlays/dialog-shell";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import type { MyWorkEvent, MyWorkTask, ReminderFormValue } from "@/modules/my-work/server/types";

const selectClassName =
  "h-11 w-full rounded-[16px] border border-input bg-background px-4 text-sm text-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/40";
const textareaClassName =
  "flex min-h-[120px] w-full rounded-[16px] border border-input bg-background px-4 py-3 text-sm text-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/40";

export function ReminderFormDialog({
  open,
  tasks,
  events,
  initialValue,
  onClose,
  onSubmit,
}: {
  open: boolean;
  tasks: MyWorkTask[];
  events: MyWorkEvent[];
  initialValue: ReminderFormValue | null;
  onClose: () => void;
  onSubmit: (value: ReminderFormValue) => void | Promise<void>;
}) {
  const [draft, setDraft] = useState<ReminderFormValue>(() => initialValue ?? {
    targetType: "task",
    targetId: tasks[0]?.id ?? "",
    title: "",
    remindAt: "",
    noteText: "",
  });

  const targetOptions = draft.targetType === "task" ? tasks.filter((task) => !task.isArchived) : events.filter((event) => !event.isArchived);

  return (
    <DialogShell
      open={open}
      onClose={onClose}
      maxWidth="max-w-xl"
      title={draft.id ? "Editar recordatorio" : "Nuevo recordatorio"}
      description="Asocia un recordatorio ligero a una tarea o evento personal."
    >
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Tipo">
            <select className={selectClassName} value={draft.targetType} onChange={(event) => setDraft((current) => ({ ...current, targetType: event.target.value as ReminderFormValue["targetType"], targetId: "" }))}>
              <option value="task">Tarea</option>
              <option value="event">Evento</option>
            </select>
          </Field>
          <Field label="Elemento asociado">
            <select className={selectClassName} value={draft.targetId} onChange={(event) => setDraft((current) => ({ ...current, targetId: event.target.value }))}>
              <option value="">Selecciona uno</option>
              {targetOptions.map((item) => (
                <option key={item.id} value={item.id}>{item.title}</option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Titulo">
          <Input value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} />
        </Field>
        <Field label="Recordar en">
          <Input type="datetime-local" value={draft.remindAt} onChange={(event) => setDraft((current) => ({ ...current, remindAt: event.target.value }))} />
        </Field>
        <Field label="Nota interna">
          <textarea className={textareaClassName} value={draft.noteText} onChange={(event) => setDraft((current) => ({ ...current, noteText: event.target.value }))} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="button" onClick={() => { void onSubmit(draft); }} disabled={!draft.targetId || !draft.title.trim() || !draft.remindAt}>
            Guardar recordatorio
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
