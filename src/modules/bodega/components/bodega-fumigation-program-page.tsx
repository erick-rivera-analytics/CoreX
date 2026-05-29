"use client";

import { AlertCircle, SprayCan } from "lucide-react";

import type {
  FumigationWeekProgramFilters,
  FumigationWeekProgramOptions,
  FumigationWeekProgramRow,
} from "@/lib/fumigation-week-program";
import { BodegaFumigationProgramExplorer } from "@/modules/bodega/components/bodega-fumigation-program-explorer";

export function BodegaFumigationProgramPage({
  initialRows,
  initialOptions,
  initialFilters,
  initialError,
}: {
  initialRows: FumigationWeekProgramRow[];
  initialOptions: FumigationWeekProgramOptions;
  initialFilters: FumigationWeekProgramFilters;
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

      <BodegaFumigationProgramExplorer
        initialRows={initialRows}
        initialOptions={initialOptions}
        initialFilters={initialFilters}
        icon={SprayCan}
      />
    </div>
  );
}
