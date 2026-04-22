"use client";

import type { ReactNode } from "react";
import { BrainCircuit } from "lucide-react";

import { Badge } from "@/shared/ui/badge";
import { FilterPanel } from "@/shared/layout/filter-panel";
import { SectionPageShell } from "@/shared/layout/section-page-shell";

export function SolverShell({
  engine,
  masterSource,
  workbookPath,
  usedFallbackDefaults,
  kpis,
  children,
}: {
  engine: string;
  masterSource: string;
  workbookPath?: string | null;
  usedFallbackDefaults?: boolean;
  kpis: ReactNode;
  children: ReactNode;
}) {
  return (
    <SectionPageShell
      eyebrow="Gestion / Poscosecha / Planificacion / Solver"
      title="Clasificacion en blanco"
      subtitle="Esta vista usa el maestro activo de SKU de postcosecha como fuente oficial y ejecuta el solver real para resolver bunches por fecha, mezcla de grados y tabla final en mallas."
      icon={<BrainCircuit className="size-6" aria-hidden="true" />}
      actions={(
        <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto lg:justify-end">
          <Badge variant="secondary" className="max-w-full rounded-full px-3 py-1 text-xs break-words">
            Maestro SKU desde PostgreSQL
          </Badge>
          <Badge variant="outline" className="max-w-full rounded-full px-3 py-1 text-xs break-words">
            {engine}
          </Badge>
        </div>
      )}
    >
      <FilterPanel>
        {kpis}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-col gap-2 text-xs text-muted-foreground sm:flex-row sm:flex-wrap sm:items-center">
            <span className="break-words">
              Origen maestro: <strong>{masterSource}</strong>
            </span>
            {workbookPath ? (
              <span className="break-all">
                Workbook semilla: <strong>{workbookPath}</strong>
              </span>
            ) : null}
            {usedFallbackDefaults ? (
              <Badge variant="outline" className="max-w-full rounded-full px-3 py-1 text-xs break-words">
                Semillas locales de respaldo
              </Badge>
            ) : null}
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto lg:justify-end">
            {children}
          </div>
        </div>
      </FilterPanel>
    </SectionPageShell>
  );
}
