"use client";

import { ChevronDown } from "lucide-react";
import { useId } from "react";

import {
  FENOGRAMA_METRIC_META,
  type FenogramaMetric,
} from "@/lib/fenograma-types";
import { cn } from "@/lib/utils";

const METRIC_ORDER: FenogramaMetric[] = ["stems", "greenBoxes", "whiteBoxes", "weightPerStem"];

/**
 * Selector compacto para alternar la métrica visible del Fenograma.
 *
 * Diseñado para vivir en `actions` de `SectionPageShell`. El cambio NO
 * afecta filtros ni rango de semanas — solo cambia qué se muestra en
 * tabla y chart.
 *
 * `Restablecer` (reset filtros) en el explorer NO debe modificar este state.
 */
export function FenogramaMetricSelector({
  value,
  onChange,
  className,
}: {
  value: FenogramaMetric;
  onChange: (metric: FenogramaMetric) => void;
  className?: string;
}) {
  const id = useId();
  return (
    <label
      htmlFor={`fenograma-metric-${id}`}
      className={cn(
        "relative inline-flex h-9 items-center gap-2 rounded-full border border-border/70 bg-card/96 px-3 text-xs font-medium shadow-[var(--shadow-card)]",
        className,
      )}
    >
      <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/65">
        Métrica
      </span>
      <select
        id={`fenograma-metric-${id}`}
        value={value}
        onChange={(event) => {
          const next = event.target.value as FenogramaMetric;
          onChange(next);
        }}
        aria-label="Seleccionar métrica del Fenograma"
        className="appearance-none bg-transparent pr-5 text-sm font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      >
        {METRIC_ORDER.map((metric) => (
          <option key={metric} value={metric}>
            {FENOGRAMA_METRIC_META[metric].label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
    </label>
  );
}
