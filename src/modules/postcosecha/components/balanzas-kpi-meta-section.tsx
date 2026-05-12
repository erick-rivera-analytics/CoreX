"use client";

import { type ReactNode } from "react";

import type { BalanzasNodeKpi } from "@/lib/postcosecha-balanzas";
import { MetricTile } from "@/shared/data-display/metric-tile";
import { KpiGrid } from "@/shared/layout/filter-panel";
import {
  ajusteAccent,
  cumplimientoAccent,
  cumplimientoAccentInverso,
} from "@/shared/lib/cumplimiento";
import { formatDecimal, formatPercent } from "@/shared/lib/format";

/**
 * Sección "Indicadores con meta" del modal de nodo Balanzas.
 *
 * Renderiza 3 sub-bloques opcionales (Hidratación / Desperdicio / Ajuste)
 * según qué KPIs vinieron en `detail.kpi`. Cada KPI muestra 3 tiles:
 * Real / Meta / Cumplimiento, con accent semáforo de `@/shared/lib/cumplimiento`.
 *
 * Convenciones canon:
 *
 *   Hidratación
 *     real         = SUM(B2)/SUM(B1C) − 1  (ratio de crecimiento, mayor es mejor)
 *     meta         = ponderada por peso B1C
 *     cumplimiento = real / meta           (>1 sobre meta)
 *     Valor numéricamente IDÉNTICO al header legacy `HIDR%`.
 *
 *   Desperdicio
 *     real         = 1 − SUM(B2A)/SUM(B2)  (fracción de pérdida POSITIVA, menor es mejor)
 *     meta         = ponderada por peso B2 (máximo aceptable, almacenado positivo en SCD2)
 *     cumplimiento = meta / real           (>1 sobre meta — menos pérdida que el límite)
 *
 *   Ajuste (visible solo en nodos de cierre b2-vs-b2a y b1c-vs-b2a-vs-ideal;
 *           el cómputo lee datos de la MV `b1c_vs_b2_weight` vía cross-MV)
 *     razón        = peso_tallo_venta_semanal / peso_tallo_estimado_ponderado
 *     bruto        = α + β·razón
 *     final        = LEAST(GREATEST(bruto, 0.98), 1.02)   (censurado)
 *     accent warning cuando el final toca el borde de censura.
 */
export function BalanzasKpiMetaSection({ kpi }: { kpi: BalanzasNodeKpi }) {
  const { hydration, waste, adjustment } = kpi;
  if (!hydration && !waste && !adjustment) return null;

  return (
    <section className="space-y-3 rounded-2xl border border-border/60 bg-card/60 p-4">
      <header className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-foreground">Indicadores con meta</h3>
        <span className="text-xs text-muted-foreground">Meta canon SCD2 · `db_admin`</span>
      </header>

      {hydration ? (
        <KpiBlock title="Hidratación">
          <MetricTile
            label="Hidratación real"
            value={formatPercent(hydration.real, { input: "ratio" })}
            hint="SUM(B2) / SUM(B1C) − 1. Mismo número que el header HIDR%."
          />
          <MetricTile
            label="Meta hidratación"
            value={formatPercent(hydration.meta, { input: "ratio" })}
            hint={
              hydration.rowsMissingMeta > 0
                ? `Ponderada por peso B1C. ${hydration.rowsMissingMeta} fila(s) sin meta de grado.`
                : "Ponderada por peso B1C."
            }
          />
          <MetricTile
            label="Cumplimiento"
            value={formatPercent(hydration.cumplimiento, { input: "ratio" })}
            hint="real / meta — mayor es mejor"
            accent={cumplimientoAccent(hydration.cumplimiento)}
          />
        </KpiBlock>
      ) : null}

      {waste ? (
        <KpiBlock title="Desperdicio">
          <MetricTile
            label="Desperdicio real"
            value={formatPercent(waste.real, { input: "ratio" })}
            hint="1 − SUM(B2A) / SUM(B2). Fracción de pérdida de peso."
          />
          <MetricTile
            label="Meta desperdicio"
            value={formatPercent(waste.meta, { input: "ratio" })}
            hint={
              waste.rowsMissingMeta > 0
                ? `Ponderada por peso B2. ${waste.rowsMissingMeta} fila(s) sin meta de destino.`
                : "Ponderada por peso B2 (máximo aceptable)."
            }
          />
          <MetricTile
            label="Cumplimiento"
            value={formatPercent(waste.cumplimiento, { input: "ratio" })}
            hint="meta / real — menor es mejor (>1 sobre meta)"
            accent={cumplimientoAccentInverso(waste.cumplimiento)}
          />
        </KpiBlock>
      ) : null}

      {adjustment ? (
        <KpiBlock title="Ajuste">
          <MetricTile
            label="Razón ajuste"
            value={formatDecimal(adjustment.razonAjuste, 4)}
            hint={`α = ${formatDecimal(adjustment.alpha, 2)} · β = ${formatDecimal(adjustment.beta, 2)}`}
          />
          <MetricTile
            label="Ajuste bruto"
            value={formatDecimal(adjustment.ajusteBruto, 4)}
            hint="α + β · razón"
          />
          <MetricTile
            label="Ajuste final"
            value={formatDecimal(adjustment.ajusteFinal, 4)}
            hint={
              adjustment.weeksCovered.length > 0
                ? `Censurado [0.98 – 1.02]. Semanas: ${adjustment.weeksCovered.join(", ")}.`
                : "Censurado [0.98 – 1.02]."
            }
            accent={ajusteAccent(adjustment.ajusteFinal)}
          />
        </KpiBlock>
      ) : null}
    </section>
  );
}

function KpiBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{title}</p>
      <KpiGrid columns={3}>{children}</KpiGrid>
    </div>
  );
}
