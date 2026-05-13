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
  const { hydration, waste, adjustment, utilization } = kpi;
  if (!hydration && !waste && !adjustment && !utilization) return null;

  return (
    <section className="space-y-4 rounded-2xl border border-border/60 bg-card/60 p-5">
      <header className="flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-foreground">Indicadores con meta</h3>
        <span className="text-xs text-muted-foreground">Metas administradas en Admin · Maestros</span>
      </header>

      {hydration ? (
        <KpiBlock title="Hidratación">
          <MetricTile
            label="Valor real"
            value={formatPercent(hydration.real, { input: "ratio" })}
            hint="Cuánto peso ganó el lote entre B1C y B2."
          />
          <MetricTile
            label="Meta"
            value={formatPercent(hydration.meta, { input: "ratio" })}
            hint={
              hydration.rowsMissingMeta > 0
                ? `Promedio ponderado por peso. ${hydration.rowsMissingMeta} fila(s) sin meta.`
                : "Promedio ponderado por peso."
            }
          />
          <MetricTile
            label="Cumplimiento"
            value={formatPercent(hydration.cumplimiento, { input: "ratio" })}
            hint="Más alto = mejor desempeño."
            accent={cumplimientoAccent(hydration.cumplimiento)}
          />
        </KpiBlock>
      ) : null}

      {waste ? (
        <KpiBlock title="Desperdicio">
          <MetricTile
            label="Valor real"
            value={formatPercent(waste.real, { input: "ratio" })}
            hint="Fracción de peso perdido entre B2 y B2A."
          />
          <MetricTile
            label="Meta"
            value={formatPercent(waste.meta, { input: "ratio" })}
            hint={
              waste.rowsMissingMeta > 0
                ? `Máximo aceptable por destino. ${waste.rowsMissingMeta} fila(s) sin meta.`
                : "Máximo aceptable por destino (ponderado por peso)."
            }
          />
          <MetricTile
            label="Cumplimiento"
            value={formatPercent(waste.cumplimiento, { input: "ratio" })}
            hint="Más alto = mejor desempeño."
            accent={cumplimientoAccentInverso(waste.cumplimiento)}
          />
        </KpiBlock>
      ) : null}

      {adjustment ? (
        <KpiBlock title="Ajuste">
          <MetricTile
            label="Razón ajuste"
            value={formatDecimal(adjustment.razonAjuste, 4)}
            hint="Relación entre el peso estimado y el peso real de ventas."
          />
          <MetricTile
            label="Ajuste bruto"
            value={formatDecimal(adjustment.ajusteBruto, 4)}
            hint="Resultado del modelo antes de aplicar el límite operativo."
          />
          <MetricTile
            label="Ajuste final"
            value={formatDecimal(adjustment.ajusteFinal, 4)}
            hint={
              adjustment.weeksCovered.length > 0
                ? `Limitado al rango operativo. Cubre ${adjustment.weeksCovered.length} semana(s).`
                : "Limitado al rango operativo."
            }
            accent={ajusteAccent(adjustment.ajusteFinal)}
          />
        </KpiBlock>
      ) : null}

      {utilization ? (
        <KpiBlock title="Aprovechamiento vs Peso ideal">
          <MetricTile
            label="Valor real"
            value={formatPercent(utilization.real, { input: "ratio" })}
            hint="Razón peso ideal / peso B1C — capacidad máxima estimada del lote."
          />
          <MetricTile
            label="Meta"
            value={formatPercent(utilization.meta, { input: "ratio" })}
            hint="(1 + meta hidr.) × (1 − meta desp.) × ajuste final."
          />
          <MetricTile
            label="Cumplimiento"
            value={formatPercent(utilization.cumplimiento, { input: "ratio" })}
            hint="Más alto = mejor desempeño."
            accent={cumplimientoAccent(utilization.cumplimiento)}
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
