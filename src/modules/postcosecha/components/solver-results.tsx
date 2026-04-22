"use client";

import { EmptyState } from "@/shared/data-display/empty-state";
import { formatDecimal, formatInteger, formatPercent } from "@/shared/lib/format";
import type {
  PoscosechaClasificacionResult,
  PoscosechaClasificacionResultOrderRow,
} from "@/lib/postcosecha-clasificacion-en-blanco-types";

import { ResultStatusBadge, SimpleTableCard, SolverMetricTile } from "@/modules/postcosecha/components/solver-feedback-states";

export function SolverResults({
  result,
  canOpenRecipe,
  onOpenRecipe,
  onOpenSkuInfo,
}: {
  result: PoscosechaClasificacionResult;
  canOpenRecipe: (sku: string) => boolean;
  onOpenRecipe: (sku: string) => void;
  onOpenSkuInfo: (sku: string) => void;
}) {
  if (result.orderRows.length === 0) {
    return <EmptyState label="No hay pedidos resueltos para mostrar." />;
  }

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SolverMetricTile
          label="Peso disponible"
          value={formatDecimal(result.stage2Summary.peso_disponible_total ?? 0)}
          hint="Gestionable segun tallos netos y peso seed."
        />
        <SolverMetricTile
          label="Peso ideal pedido"
          value={formatDecimal(result.stage2Summary.peso_ideal_pedido_total ?? 0)}
          hint="Referencia total del pedido capturado."
        />
        <SolverMetricTile
          label="Peso ideal resuelto"
          value={formatDecimal(result.stage2Summary.peso_ideal_resuelto_total ?? 0)}
          hint="Solo sobre bunches finalmente resueltos."
        />
        <SolverMetricTile
          label="Peso real final"
          value={formatDecimal(result.stage2Summary.peso_real_total ?? 0)}
          hint={`Delta vs ideal: ${formatDecimal(result.stage2Summary.sobrepeso_real_vs_ideal ?? 0)}`}
          tone="positive"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SolverMetricTile
          label="Bunches pedidos"
          value={formatInteger(result.stage1Summary.pedido_bunches_total ?? 0)}
          hint="Demanda total capturada."
        />
        <SolverMetricTile
          label="Bunches resueltos"
          value={formatInteger(result.stage1Summary.pedido_bunches_resuelto ?? 0)}
          hint="Salida efectiva del solver."
          tone="positive"
        />
        <SolverMetricTile
          label="No realizados"
          value={formatInteger(result.stage1Summary.ajuste_bunches_total ?? 0)}
          hint="Pedido que no pudo resolverse."
        />
        <SolverMetricTile
          label="Sobrepeso macro"
          value={formatPercent(result.stage2Summary.sobrepeso_pct_macro ?? 0, { input: "ratio" })}
          hint={`Status: ${String(result.solverMeta.status ?? "n/a")}`}
        />
      </div>

      <SimpleTableCard
        title="Prioridad de cumplimiento por fecha"
        description="Secuencia de la etapa interna de resolucion de pedidos."
        table={(
          <div className="overflow-x-auto rounded-[24px] border border-border/70">
            <table className="min-w-[720px] w-full text-sm">
              <thead className="bg-background/95">
                <tr className="border-b border-border/70 text-left text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Prioridad</th>
                  <th className="px-4 py-3 font-medium">Fecha</th>
                  <th className="px-4 py-3 text-right font-medium">Pedido</th>
                  <th className="px-4 py-3 text-right font-medium">Resuelto</th>
                  <th className="px-4 py-3 text-right font-medium">No realizado</th>
                  <th className="px-4 py-3 text-right font-medium">Cumplimiento</th>
                </tr>
              </thead>
              <tbody>
                {result.priorityRows.map((row) => (
                  <tr key={row.prioridad} className="border-b border-border/50 last:border-b-0">
                    <td className="px-4 py-3">{row.prioridad}</td>
                    <td className="px-4 py-3 font-medium">{row.fecha}</td>
                    <td className="px-4 py-3 text-right">{formatInteger(row.pedido)}</td>
                    <td className="px-4 py-3 text-right">{formatInteger(row.resuelto)}</td>
                    <td className="px-4 py-3 text-right">{formatInteger(row.noRealizado)}</td>
                    <td className="px-4 py-3 text-right">{formatPercent(row.cumplimiento, { input: "ratio" })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      />

      <SimpleTableCard
        title="Resumen por pedido"
        description="Lectura por SKU del resultado final y del estado de peso. Haz click en un SKU resuelto para ver su receta."
        table={(
          <div className="overflow-x-auto rounded-[24px] border border-border/70">
            <table className="min-w-[1620px] w-full text-sm">
              <thead className="bg-background/95">
                <tr className="border-b border-border/70 text-left text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                  <th className="px-4 py-3 font-medium">SKU</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 text-right font-medium">Pedido</th>
                  <th className="px-4 py-3 text-right font-medium">Resuelto</th>
                  <th className="px-4 py-3 text-right font-medium">Ajuste</th>
                  <th className="px-4 py-3 text-right font-medium">Cumplimiento</th>
                  <th className="px-4 py-3 text-right font-medium">Peso ideal pedido</th>
                  <th className="px-4 py-3 text-right font-medium">Peso ideal resuelto</th>
                  <th className="px-4 py-3 text-right font-medium">Peso real total</th>
                  <th className="px-4 py-3 text-right font-medium">Peso real bunch</th>
                  <th className="px-4 py-3 text-right font-medium">Rango objetivo</th>
                  <th className="px-4 py-3 text-right font-medium">Sobrepeso %</th>
                  <th className="px-4 py-3 text-right font-medium">Mallas</th>
                  <th className="px-4 py-3 text-right font-medium">Grados</th>
                </tr>
              </thead>
              <tbody>
                {result.orderRows.map((row) => (
                  <SolverOrderRow
                    key={row.sku}
                    row={row}
                    canOpenRecipe={canOpenRecipe(row.sku)}
                    onOpenRecipe={onOpenRecipe}
                    onOpenSkuInfo={onOpenSkuInfo}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      />

      <SimpleTableCard
        title="Tabla final en mallas"
        description="Matriz SKU por grado que sale del solver redondeada a la vista operativa. Tambien puedes abrir la receta desde cada SKU."
        table={(
          <div className="overflow-x-auto rounded-[24px] border border-border/70">
            <table className="min-w-[960px] w-full text-sm">
              <thead className="bg-background/95">
                <tr className="border-b border-border/70 text-left text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                  <th className="px-4 py-3 font-medium">SKU</th>
                  {result.matrix.gradeLabels.map((gradeLabel) => (
                    <th key={gradeLabel} className="px-4 py-3 text-right font-medium">
                      {gradeLabel}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {result.matrix.rows.map((row) => (
                  <tr key={row.sku} className="border-b border-border/50 last:border-b-0">
                    <td className="px-4 py-3 font-medium">
                      {canOpenRecipe(row.sku) ? (
                        <button
                          type="button"
                          className="text-left text-foreground transition hover:text-slate-700 hover:underline"
                          onClick={() => onOpenRecipe(row.sku)}
                        >
                          <span className="block">{row.sku}</span>
                          <span className="block text-xs font-normal text-muted-foreground">
                            Ver receta
                          </span>
                        </button>
                      ) : (
                        row.sku
                      )}
                    </td>
                    {result.matrix.gradeLabels.map((gradeLabel) => (
                      <td key={`${row.sku}-${gradeLabel}`} className="px-4 py-3 text-right">
                        {formatInteger(row.values[String(gradeLabel)] ?? 0)}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-right font-semibold">{formatInteger(row.total)}</td>
                  </tr>
                ))}
                <tr className="bg-background/70 font-semibold">
                  <td className="px-4 py-3">TOTAL</td>
                  {result.matrix.gradeLabels.map((gradeLabel) => (
                    <td key={`total-${gradeLabel}`} className="px-4 py-3 text-right">
                      {formatInteger(result.matrix.totals[String(gradeLabel)] ?? 0)}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right">{formatInteger(result.matrix.grandTotal)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      />

      <SimpleTableCard
        title="Disponibilidad final por grado"
        description="Lectura de consumo, remanente y peso gestionable despues de la corrida."
        table={(
          <div className="overflow-x-auto rounded-[24px] border border-border/70">
            <table className="min-w-[1240px] w-full text-sm">
              <thead className="bg-background/95">
                <tr className="border-b border-border/70 text-left text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Grado</th>
                  <th className="px-4 py-3 text-right font-medium">Peso seed</th>
                  <th className="px-4 py-3 text-right font-medium">Tallos brutos</th>
                  <th className="px-4 py-3 text-right font-medium">Tallos netos</th>
                  <th className="px-4 py-3 text-right font-medium">Usados netos</th>
                  <th className="px-4 py-3 text-right font-medium">Restantes netos</th>
                  <th className="px-4 py-3 text-right font-medium">Peso disponible</th>
                  <th className="px-4 py-3 text-right font-medium">Peso usado</th>
                  <th className="px-4 py-3 text-right font-medium">Peso restante</th>
                  <th className="px-4 py-3 text-right font-medium">Mallas usadas</th>
                </tr>
              </thead>
              <tbody>
                {result.availabilityRows.map((row) => (
                  <tr key={row.grado} className="border-b border-border/50 last:border-b-0">
                    <td className="px-4 py-3 font-medium">{row.grado}</td>
                    <td className="px-4 py-3 text-right">{formatDecimal(row.pesoTalloSeed)}</td>
                    <td className="px-4 py-3 text-right">{formatInteger(row.tallosBrutos)}</td>
                    <td className="px-4 py-3 text-right">{formatInteger(row.tallosNetos)}</td>
                    <td className="px-4 py-3 text-right">{formatDecimal(row.tallosUsadosNetos)}</td>
                    <td className="px-4 py-3 text-right">{formatDecimal(row.tallosRestantesNetos)}</td>
                    <td className="px-4 py-3 text-right">{formatDecimal(row.pesoTotalGestionable)}</td>
                    <td className="px-4 py-3 text-right">{formatDecimal(row.pesoUsado)}</td>
                    <td className="px-4 py-3 text-right">{formatDecimal(row.pesoRestante)}</td>
                    <td className="px-4 py-3 text-right">{formatDecimal(row.mallasUsadas)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      />
    </>
  );
}

function SolverOrderRow({
  row,
  canOpenRecipe,
  onOpenRecipe,
  onOpenSkuInfo,
}: {
  row: PoscosechaClasificacionResultOrderRow;
  canOpenRecipe: boolean;
  onOpenRecipe: (sku: string) => void;
  onOpenSkuInfo: (sku: string) => void;
}) {
  return (
    <tr className="border-b border-border/50 last:border-b-0">
      <td className="px-4 py-3 font-medium">
        {canOpenRecipe ? (
          <div className="space-y-1">
            <button
              type="button"
              className="block text-left text-foreground transition hover:text-slate-700 hover:underline"
              onClick={() => onOpenRecipe(row.sku)}
            >
              <span className="block">{row.sku}</span>
              <span className="block text-xs font-normal text-muted-foreground">
                Ver receta
              </span>
            </button>
            <button
              type="button"
              className="text-xs font-normal text-muted-foreground transition hover:text-foreground hover:underline"
              onClick={() => onOpenSkuInfo(row.sku)}
            >
              Editar SKU
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="text-left text-foreground transition hover:text-slate-700 hover:underline"
            onClick={() => onOpenSkuInfo(row.sku)}
          >
            <span className="block">{row.sku}</span>
            <span className="block text-xs font-normal text-muted-foreground">
              Editar SKU
            </span>
          </button>
        )}
      </td>
      <td className="px-4 py-3">
        <ResultStatusBadge status={row.estadoPeso} />
      </td>
      <td className="px-4 py-3 text-right">{formatInteger(row.pedidoTotal)}</td>
      <td className="px-4 py-3 text-right">{formatInteger(row.pedidoResuelto)}</td>
      <td className="px-4 py-3 text-right">{formatInteger(row.ajusteBunches)}</td>
      <td className="px-4 py-3 text-right">{formatPercent(row.cumplimientoBunches, { input: "ratio" })}</td>
      <td className="px-4 py-3 text-right">{formatDecimal(row.pesoIdealPedido)}</td>
      <td className="px-4 py-3 text-right">{formatDecimal(row.pesoIdealResuelto)}</td>
      <td className="px-4 py-3 text-right">{formatDecimal(row.pesoRealTotal)}</td>
      <td className="px-4 py-3 text-right">{formatDecimal(row.pesoRealBunch)}</td>
      <td className="px-4 py-3 text-right">
        {formatDecimal(row.pesoMinObjetivo)} / {formatDecimal(row.pesoMaxObjetivo)}
      </td>
      <td className="px-4 py-3 text-right">{formatPercent(row.sobrepesoPct, { input: "ratio" })}</td>
      <td className="px-4 py-3 text-right">{formatDecimal(row.mallasTotales)}</td>
      <td className="px-4 py-3 text-right">{formatInteger(row.gradosUsados)}</td>
    </tr>
  );
}
