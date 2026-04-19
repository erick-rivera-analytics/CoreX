"use client";

import { Bell, Pencil } from "lucide-react";

import type { MyWorkAgendaItem, MyWorkReminder } from "@/modules/my-work/server/types";
import { EmptyState } from "@/shared/data-display/empty-state";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { formatDateTime } from "@/shared/lib/format";

function dateKey(value: string) {
  return value.slice(0, 10);
}

export function MyWorkAgenda({
  items,
  reminders,
  onOpenItem,
  onCreateReminder,
  onUpdateReminder,
}: {
  items: MyWorkAgendaItem[];
  reminders: MyWorkReminder[];
  onOpenItem: (item: MyWorkAgendaItem) => void;
  onCreateReminder: (item: MyWorkAgendaItem) => void;
  onUpdateReminder: (reminder: MyWorkReminder, statusCode: "read" | "canceled") => void;
}) {
  if (items.length === 0 && reminders.length === 0) {
    return <EmptyState label="No hay agenda ni recordatorios en el rango actual." />;
  }

  const groups = items.reduce<Record<string, MyWorkAgendaItem[]>>((acc, item) => {
    const key = dateKey(item.startsAt);
    acc[key] = [...(acc[key] ?? []), item];
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {Object.entries(groups).map(([key, group]) => (
        <div key={key} className="rounded-[20px] border border-border/70 bg-card/92 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-sm font-semibold">{key}</p>
            <Badge variant="outline">{group.length} items</Badge>
          </div>
          <div className="space-y-2">
            {group.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 rounded-[16px] border border-border/70 bg-background/70 px-4 py-3">
                <div className="min-w-0">
                  <p className="font-medium">{item.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(item.startsAt)} - {item.spaceLabel}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={item.kind === "event" ? "outline" : item.kind === "reminder" ? "danger" : "secondary"}>
                    {item.kind === "event" ? "Evento" : item.kind === "reminder" ? "Recordatorio" : "Tarea"}
                  </Badge>
                  {item.kind !== "reminder" ? <Button variant="ghost" size="sm" onClick={() => onCreateReminder(item)} aria-label="Crear recordatorio"><Bell className="size-3.5" /></Button> : null}
                  <Button variant="ghost" size="sm" onClick={() => onOpenItem(item)} aria-label="Abrir item"><Pencil className="size-3.5" /></Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {reminders.length > 0 ? (
        <div className="rounded-[20px] border border-border/70 bg-card/92 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-sm font-semibold">Proximos recordatorios</p>
            <Badge variant="outline">{reminders.length}</Badge>
          </div>
          <div className="space-y-2">
            {reminders.filter((reminder) => reminder.statusCode === "pending").map((reminder) => (
              <div key={reminder.id} className="flex items-center justify-between gap-3 rounded-[16px] border border-border/70 bg-background/70 px-4 py-3">
                <div className="min-w-0">
                  <p className="font-medium">{reminder.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(reminder.remindAt)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => onUpdateReminder(reminder, "read")}>Leido</Button>
                  <Button variant="ghost" size="sm" onClick={() => onUpdateReminder(reminder, "canceled")}>Cancelar</Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
