"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import type { MyWorkCalendarItem } from "@/modules/my-work/server/types";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { cn } from "@/lib/utils";

const dayLabels = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"];
const monthLabels = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

function toDateKey(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function buildCells(viewDate: Date) {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const mondayOffset = firstWeekday === 0 ? 6 : firstWeekday - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev = new Date(year, month, 0).getDate();
  const cells: { date: Date; currentMonth: boolean }[] = [];

  for (let index = mondayOffset - 1; index >= 0; index -= 1) {
    cells.push({ date: new Date(year, month - 1, daysInPrev - index), currentMonth: false });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ date: new Date(year, month, day), currentMonth: true });
  }
  while (cells.length < 42) {
    cells.push({ date: new Date(year, month + 1, cells.length - daysInMonth - mondayOffset + 1), currentMonth: false });
  }

  return cells;
}

export function MyWorkCalendar({
  viewDate,
  selectedDate,
  items,
  onChangeMonth,
  onSelectDate,
  onOpenItem,
}: {
  viewDate: Date;
  selectedDate: string;
  items: MyWorkCalendarItem[];
  onChangeMonth: (direction: -1 | 1) => void;
  onSelectDate: (dateKey: string) => void;
  onOpenItem: (item: MyWorkCalendarItem) => void;
}) {
  const byDate = items.reduce<Record<string, MyWorkCalendarItem[]>>((groups, item) => {
    const key = item.startAt.slice(0, 10);
    groups[key] = [...(groups[key] ?? []), item];
    return groups;
  }, {});

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">{monthLabels[viewDate.getMonth()]} {viewDate.getFullYear()}</p>
          <p className="text-xs text-muted-foreground">Eventos y tareas con fecha desde la vista unificada.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => onChangeMonth(-1)} aria-label="Mes anterior"><ChevronLeft className="size-4" /></Button>
          <Button variant="outline" size="sm" onClick={() => onChangeMonth(1)} aria-label="Mes siguiente"><ChevronRight className="size-4" /></Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2 text-center text-xs font-medium text-muted-foreground">
        {dayLabels.map((label) => <div key={label}>{label}</div>)}
      </div>

      <div className="grid grid-cols-7 gap-2">
        {buildCells(viewDate).map((cell) => {
          const dateKey = toDateKey(cell.date);
          const itemsForDay = byDate[dateKey] ?? [];

          return (
            <button
              key={dateKey}
              type="button"
              onClick={() => onSelectDate(dateKey)}
              className={cn(
                "min-h-28 rounded-[18px] border border-border/70 bg-background/70 p-3 text-left transition-colors hover:bg-primary/6",
                !cell.currentMonth && "opacity-55",
                selectedDate === dateKey && "ring-2 ring-ring/40",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{cell.date.getDate()}</span>
                {itemsForDay.length > 0 ? <Badge variant="outline">{itemsForDay.length}</Badge> : null}
              </div>
              <div className="mt-3 space-y-1">
                {itemsForDay.slice(0, 2).map((item) => (
                  <span
                    key={item.id}
                    onClick={(event) => {
                      event.stopPropagation();
                      onOpenItem(item);
                    }}
                    className={cn(
                      "block truncate rounded-full px-2 py-1 text-[11px]",
                      item.kind === "event" ? "bg-muted text-foreground" : "bg-primary/10 text-foreground",
                    )}
                  >
                    {item.title}
                  </span>
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
