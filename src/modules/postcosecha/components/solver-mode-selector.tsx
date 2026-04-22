"use client";

import { cn } from "@/lib/utils";
import type {
  PoscosechaClasificacionModeResult,
  PoscosechaClasificacionRunMode,
} from "@/lib/postcosecha-clasificacion-en-blanco-types";

const MODE_LABELS: Record<PoscosechaClasificacionRunMode, string> = {
  GV: "GV",
  APERTURA: "Apertura",
  PRECLASIFICACION: "Preclasificacion",
};

export function SolverModeSelector({
  runs,
  activeMode,
  onModeChange,
}: {
  runs: PoscosechaClasificacionModeResult[];
  activeMode: PoscosechaClasificacionRunMode;
  onModeChange: (mode: PoscosechaClasificacionRunMode) => void;
}) {
  if (runs.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {runs.map((run) => {
        const isActive = run.mode === activeMode;
        const hasResult = run.result !== null;

        return (
          <button
            key={run.mode}
            type="button"
            onClick={() => onModeChange(run.mode)}
            className={cn(
              "rounded-full border px-4 py-1.5 text-sm font-medium transition",
              isActive
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-background text-muted-foreground hover:border-foreground/40 hover:text-foreground",
              !hasResult && "opacity-50",
            )}
          >
            {MODE_LABELS[run.mode]}
            {!hasResult ? <span className="ml-1.5 text-xs opacity-70">Sin resultado</span> : null}
          </button>
        );
      })}
    </div>
  );
}
