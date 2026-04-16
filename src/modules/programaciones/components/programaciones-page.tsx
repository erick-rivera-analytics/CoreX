"use client";

import { AlertCircle } from "lucide-react";

import { ProgramacionesExplorer } from "@/modules/programaciones/components/programaciones-explorer";
import type { ProgramacionRecord } from "@/lib/programaciones";

export function ProgramacionesPage({
  initialData,
  initialDateFrom,
  initialDateTo,
  initialError,
}: {
  initialData: ProgramacionRecord[];
  initialDateFrom: string;
  initialDateTo: string;
  initialError?: string | null;
}) {
  return (
    <div className="space-y-4">
      {initialError ? (
        <div className="rounded-[24px] border border-slate-300/60 bg-slate-500/10 px-4 py-3 text-sm text-slate-950 dark:text-slate-100">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <div className="min-w-0">
              <p className="font-medium">Estado del origen</p>
              <p className="mt-1 text-sm opacity-90">{initialError}</p>
            </div>
          </div>
        </div>
      ) : null}

      <ProgramacionesExplorer
        initialData={initialData}
        initialDateFrom={initialDateFrom}
        initialDateTo={initialDateTo}
      />
    </div>
  );
}
