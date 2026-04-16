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
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Badge variant="secondary" className="rounded-full px-3 py-1">
            Maestro SKU desde PostgreSQL
          </Badge>
          <Badge variant="outline" className="rounded-full px-3 py-1">
            {engine}
          </Badge>
        </div>
      )}
    >
      <FilterPanel>
        {kpis}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>
              Origen maestro: <strong>{masterSource}</strong>
            </span>
            {workbookPath ? (
              <span>
                Workbook semilla: <strong>{workbookPath}</strong>
              </span>
            ) : null}
            {usedFallbackDefaults ? (
              <Badge variant="outline" className="rounded-full px-3 py-1">
                Semillas locales de respaldo
              </Badge>
            ) : null}
          </div>
          {children}
        </div>
      </FilterPanel>
    </SectionPageShell>
  );
}
