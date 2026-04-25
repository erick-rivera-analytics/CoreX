"use client";

import { SingleSelectField } from "@/shared/filters/single-select-field";
import {
  FENOGRAMA_METRIC_META,
  isValidFenogramaMetric,
  type FenogramaMetric,
} from "@/lib/fenograma-types";
import { cn } from "@/lib/utils";

const METRIC_ORDER: FenogramaMetric[] = ["stems", "greenBoxes", "whiteBoxes", "weightPerStem"];

/**
 * Selector compacto para alternar la métrica visible del Fenograma.
 *
 * Vive en `actions` de `SectionPageShell`. El cambio NO afecta filtros ni
 * rango de semanas — solo cambia qué se muestra en tabla y chart.
 *
 * `Restablecer` (reset filtros) en el explorer NO modifica este state.
 *
 * Usa `SingleSelectField` canónico con `hideLabel` (label sr-only para a11y)
 * y `omitEmpty` (no opción "Todos"). El override de className compacta el
 * field a la altura del header en lugar del default `h-11` del filtro.
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
  return (
    <SingleSelectField
      id="fenograma-metric"
      label="Métrica del Fenograma"
      hideLabel
      omitEmpty
      value={value}
      options={[...METRIC_ORDER]}
      displayValue={(option) =>
        isValidFenogramaMetric(option) ? FENOGRAMA_METRIC_META[option].label : option
      }
      onChange={(next) => {
        if (isValidFenogramaMetric(next)) {
          onChange(next);
        }
      }}
      className={cn("min-w-[180px]", className)}
    />
  );
}
