"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import type { MyWorkCalendarItem } from "@/modules/my-work/server/types";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { cn } from "@/lib/utils";

const dayLabels = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"];
const monthLabels = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

const COLOR_PILL: Record<string, string> = {
  slate:   "bg-slate-100   text-slate-800   dark:bg-slate-800   dark:text-slate-200",
  sky:     "bg-sky-100     text-sky-800     dark:bg-sky-900     dark:text-sky-200",
  emerald: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  amber:   "bg-amber-100   text-amber-800   dark:bg-amber-900   dark:text-amber-200",
  rose:    "bg-rose-100    text-rose-800    dark:bg-rose-900    dark:text-rose-200",
};

function pillClass(colorToken: string | null | undefined, kind: "task" | "event") {
  const base = COLOR_PILL[colorToken ?? ""] ?? (kind === "event" ? COLOR_PILL.sky : COLOR_PILL.slate);
  return base;
}

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
            <div
              key={dateKey}
              className={cn(
                "relative min-h-28 rounded-[18px] border border-border/70 bg-background/70 p-3 text-left transition-colors hover:bg-primary/6",
                !cell.currentMonth && "opacity-55",
                selectedDate === dateKey && "ring-2 ring-ring/40",
              )}
            >
              <button
                type="button"
                onClick={() => onSelectDate(dateKey)}
                aria-label={`Seleccionar ${dateKey}`}
                className="absolute inset-0 rounded-[18px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              />
              <div className="pointer-events-none relative z-10">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{cell.date.getDate()}</span>
                  {itemsForDay.length > 0 ? <Badge variant="outline">{itemsForDay.length}</Badge> : null}
                </div>
                <div className="mt-3 space-y-1">
                  {itemsForDay.slice(0, 2).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onOpenItem(item)}
                      className={cn(
                        "pointer-events-auto block w-full truncate rounded-full px-2 py-1 text-left text-[11px] font-medium",
                        pillClass(item.colorToken, item.kind),
                      )}
                    >
                      {item.kind === "event" ? "● " : "○ "}{item.title}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
