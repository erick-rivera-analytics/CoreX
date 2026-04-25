import type { FenogramaMetric, FenogramaWeekMetricValues } from "@/lib/fenograma-types";

/**
 * Devuelve el valor de la celda (semana + grupo) según la métrica activa.
 *
 * Para `weightPerStem`: ratio de sumas (`greenWeightKg * 1000 / NULLIF(stems, 0)`).
 * NUNCA promedio de ratios.
 */
export function getCellValueForMetric(
  cell: FenogramaWeekMetricValues | null | undefined,
  metric: FenogramaMetric,
): number | null {
  if (!cell) return null;
  if (metric === "stems") return cell.stems || null;
  if (metric === "greenBoxes") return cell.greenBoxes || null;
  if (metric === "whiteBoxes") return cell.whiteBoxes || null;
  // weightPerStem
  if (!cell.stems || cell.stems <= 0) return null;
  return (cell.greenWeightKg * 1000) / cell.stems;
}

/**
 * Total de fila/columna por métrica. Para weightPerStem es ratio de sumas.
 */
export function getTotalForMetric(
  totals: { stems: number; greenBoxes: number; whiteBoxes: number; greenWeightKg: number },
  metric: FenogramaMetric,
): number | null {
  if (metric === "stems") return totals.stems || null;
  if (metric === "greenBoxes") return totals.greenBoxes || null;
  if (metric === "whiteBoxes") return totals.whiteBoxes || null;
  if (!totals.stems || totals.stems <= 0) return null;
  return (totals.greenWeightKg * 1000) / totals.stems;
}
