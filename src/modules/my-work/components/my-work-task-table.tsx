"use client";

import { Bell, Pencil, Trash2 } from "lucide-react";

import type { MyWorkTask } from "@/modules/my-work/server/types";
import { EmptyState } from "@/shared/data-display/empty-state";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { ScrollFadeTable } from "@/shared/tables/scroll-fade-table";
import { StandardTable, StandardTd, StandardTh } from "@/shared/tables/standard-table";
import { formatDateTime } from "@/shared/lib/format";

function statusVariant(statusCode: MyWorkTask["statusCode"]) {
  if (statusCode === "done") return "success";
  if (statusCode === "blocked") return "danger";
  return "outline";
}

function priorityVariant(priorityCode: MyWorkTask["priorityCode"]) {
  if (priorityCode === "urgent") return "danger";
  if (priorityCode === "high") return "secondary";
  return "outline";
}

const statusLabels: Record<MyWorkTask["statusCode"], string> = {
  todo: "Por hacer",
  in_progress: "En progreso",
  blocked: "Bloqueada",
  done: "Hecha",
};

const priorityLabels: Record<MyWorkTask["priorityCode"], string> = {
  low: "Baja",
  medium: "Normal",
  high: "Alta",
  urgent: "Urgente",
};

export function MyWorkTaskTable({
  tasks,
  onEdit,
  onArchive,
  onToggleDone,
  onCreateReminder,
}: {
  tasks: MyWorkTask[];
  onEdit: (task: MyWorkTask) => void;
  onArchive: (task: MyWorkTask) => void;
  onToggleDone: (task: MyWorkTask) => void;
  onCreateReminder: (task: MyWorkTask) => void;
}) {
  if (tasks.length === 0) {
    return <EmptyState label="No hay tareas para los filtros seleccionados." />;
  }

  return (
    <ScrollFadeTable>
      <StandardTable>
        <thead>
          <tr className="border-b border-border/60">
            <StandardTh>Tarea</StandardTh>
            <StandardTh>Estado</StandardTh>
            <StandardTh>Prioridad</StandardTh>
            <StandardTh>Inicio</StandardTh>
            <StandardTh>Vence</StandardTh>
            <StandardTh align="right">Acciones</StandardTh>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => (
            <tr key={task.id} className="border-b border-border/50 last:border-0 hover:bg-primary/6">
              <StandardTd>
                <div className="space-y-1">
                  <p className="font-medium">{task.title}</p>
                  {task.details ? <p className="max-w-md text-xs text-muted-foreground">{task.details}</p> : null}
                </div>
              </StandardTd>
              <StandardTd><Badge variant={statusVariant(task.statusCode)}>{statusLabels[task.statusCode]}</Badge></StandardTd>
              <StandardTd><Badge variant={priorityVariant(task.priorityCode)}>{priorityLabels[task.priorityCode]}</Badge></StandardTd>
              <StandardTd className="text-muted-foreground">{task.startAt ? formatDateTime(task.startAt) : "-"}</StandardTd>
              <StandardTd className="text-muted-foreground">{task.dueAt ? formatDateTime(task.dueAt) : "-"}</StandardTd>
              <StandardTd align="right">
                <div className="flex items-center justify-end gap-1">
                  <Button variant="ghost" size="sm" onClick={() => onToggleDone(task)}>{task.statusCode === "done" ? "Reabrir" : "Hecha"}</Button>
                  <Button variant="ghost" size="sm" onClick={() => onCreateReminder(task)} aria-label="Crear recordatorio"><Bell className="size-3.5" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => onEdit(task)} aria-label="Editar tarea"><Pencil className="size-3.5" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => onArchive(task)} aria-label="Archivar tarea"><Trash2 className="size-3.5" /></Button>
                </div>
              </StandardTd>
            </tr>
          ))}
        </tbody>
      </StandardTable>
    </ScrollFadeTable>
  );
}
