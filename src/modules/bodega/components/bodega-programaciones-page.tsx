"use client";

import { AlertCircle, CalendarClock } from "lucide-react";

import type {
  DrenchWeekCalendarFilters,
  DrenchWeekCalendarOptions,
  DrenchWeekCalendarRow,
} from "@/lib/drench-week-calendar";
import { BodegaProgramacionesExplorer } from "@/modules/bodega/components/bodega-programaciones-explorer";

export function BodegaProgramacionesPage({
  initialRows,
  initialOptions,
  initialFilters,
  initialError,
}: {
  initialRows: DrenchWeekCalendarRow[];
  initialOptions: DrenchWeekCalendarOptions;
  initialFilters: DrenchWeekCalendarFilters;
  initialError?: string | null;
}) {
  return (
    <div className="space-y-4">
      {initialError ? (
        <div className="rounded-[24px] border border-amber-300/60 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <div className="min-w-0">
              <p className="font-medium">Estado del origen</p>
              <p className="mt-1 opacity-90">{initialError}</p>
            </div>
          </div>
        </div>
      ) : null}

      <BodegaProgramacionesExplorer
        initialRows={initialRows}
        initialOptions={initialOptions}
        initialFilters={initialFilters}
        icon={CalendarClock}
      />
    </div>
  );
}
