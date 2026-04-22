"use client";

import { type ReactNode, useState } from "react";

import { DialogShell } from "@/shared/overlays/dialog-shell";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { ToggleSwitch } from "@/shared/forms/toggle-switch";
import { SingleSelectField } from "@/shared/filters/single-select-field";
import { MY_WORK_PRIORITY_OPTIONS, MY_WORK_STATUS_OPTIONS, type MyWorkSpace, type TaskFormValue } from "@/modules/my-work/server/types";

const selectClassName =
  "h-11 w-full rounded-[16px] border border-input bg-background px-4 text-sm text-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/40";
const textareaClassName =
  "flex min-h-[120px] w-full rounded-[16px] border border-input bg-background px-4 py-3 text-sm text-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/40";

export function TaskFormDialog({
  open,
  spaces,
  initialValue,
  onClose,
  onSubmit,
}: {
  open: boolean;
  spaces: MyWorkSpace[];
  initialValue: TaskFormValue | null;
  onClose: () => void;
  onSubmit: (value: TaskFormValue) => void | Promise<void>;
}) {
  const [draft, setDraft] = useState<TaskFormValue>(() => buildDraft(initialValue, spaces));

  return (
    <DialogShell
      open={open}
      onClose={onClose}
      maxWidth="max-w-2xl"
      title={draft.id ? "Editar tarea" : "Nueva tarea"}
      description="Registra o actualiza una tarea personal con persistencia inmediata."
    >
      <div className="space-y-4">
        <Field label="Espacio">
          <select className={selectClassName} value={draft.spaceId} onChange={(event) => setDraft((current) => ({ ...current, spaceId: event.target.value }))}>
            {spaces.map((space) => (
              <option key={space.id} value={space.id}>
                {space.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Titulo">
          <Input value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} />
        </Field>
        <div className="grid gap-4 md:grid-cols-2">
          <SingleSelectField
            id="task-status"
            label="Estado"
            value={draft.statusCode}
            emptyValue="todo"
            emptyLabel="Por hacer"
            options={MY_WORK_STATUS_OPTIONS.filter((o) => o.value !== "todo").map((o) => o.value)}
            displayValue={(v) => MY_WORK_STATUS_OPTIONS.find((o) => o.value === v)?.label ?? v}
            onChange={(v) => setDraft((current) => ({ ...current, statusCode: v as TaskFormValue["statusCode"] }))}
          />
          <SingleSelectField
            id="task-priority"
            label="Prioridad"
            value={draft.priorityCode}
            emptyValue="medium"
            emptyLabel="Normal"
            options={MY_WORK_PRIORITY_OPTIONS.filter((o) => o.value !== "medium").map((o) => o.value)}
            displayValue={(v) => MY_WORK_PRIORITY_OPTIONS.find((o) => o.value === v)?.label ?? v}
            onChange={(v) => setDraft((current) => ({ ...current, priorityCode: v as TaskFormValue["priorityCode"] }))}
          />
          <Field label="Inicio">
            <Input type="datetime-local" value={draft.startAt} onChange={(event) => setDraft((current) => ({ ...current, startAt: event.target.value }))} />
          </Field>
          <Field label="Vencimiento">
            <Input type="datetime-local" value={draft.dueAt} onChange={(event) => setDraft((current) => ({ ...current, dueAt: event.target.value }))} />
          </Field>
        </div>
        <Field label="Detalle">
          <textarea className={textareaClassName} value={draft.details} onChange={(event) => setDraft((current) => ({ ...current, details: event.target.value }))} />
        </Field>
        <div className="flex items-center justify-between rounded-[18px] border border-border/70 bg-background/70 px-4 py-3">
          <div>
            <p className="text-sm font-medium">Destacar tarea</p>
            <p className="text-sm text-muted-foreground">Fija la tarea para que gane visibilidad en la vista del dia.</p>
          </div>
          <ToggleSwitch checked={draft.isStarred} onCheckedChange={(checked) => setDraft((current) => ({ ...current, isStarred: checked }))} />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="button" onClick={() => { void onSubmit(draft); }} disabled={!draft.title.trim() || !draft.spaceId}>
            Guardar tarea
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

function buildDraft(initialValue: TaskFormValue | null, spaces: MyWorkSpace[]) {
  return initialValue ?? {
    spaceId: spaces[0]?.id ?? "",
    title: "",
    details: "",
    statusCode: "todo",
    priorityCode: "medium",
    startAt: "",
    dueAt: "",
    isStarred: false,
  };
}
