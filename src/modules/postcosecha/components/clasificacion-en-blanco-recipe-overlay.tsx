"use client";

import { LoaderCircle } from "lucide-react";

import { Badge } from "@/shared/ui/badge";
import type { PoscosechaClasificacionRecipeResult } from "@/lib/postcosecha-clasificacion-en-blanco-types";
import { cn } from "@/lib/utils";
import { formatDecimal, formatInteger } from "@/shared/lib/format";
import { SheetShell } from "@/shared/overlays/sheet-shell";

function RecipeMetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-[24px] border border-border/70 bg-background/80 px-4 py-4">
      <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
      <p className="mt-2 text-sm text-muted-foreground">{hint}</p>
    </div>
  );
}

function RecipeStatusBadge({ status }: { status: string }) {
  const tone = status === "Dentro de objetivo"
    ? "border-chart-success-bold/45 bg-chart-success-bold/10 text-foreground"
    : status === "Debajo de objetivo"
      ? "border-slate-400/45 bg-slate-400/12 text-foreground"
      : "border-slate-500/45 bg-slate-500/12 text-foreground";

  return (
    <span className={cn("inline-flex rounded-full border px-3 py-1 text-xs font-medium", tone)}>
      {status}
    </span>
  );
}

export function PoscosechaClasificacionRecipeOverlay({
  sku,
  data,
  isLoading,
  error,
  onClose,
}: {
  sku: string;
  data: PoscosechaClasificacionRecipeResult | null;
  isLoading: boolean;
  error?: string | null;
  onClose: () => void;
}) {
  const summary = data?.summary ?? null;

  return (
    <SheetShell
      open={true}
      title={sku}
      description="Receta interna por bunch construida desde los tallos resueltos en Clasificacion en blanco."
      onClose={onClose}
      widthClassName="max-w-5xl"
    >
      <div className="space-y-5">
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="rounded-full px-3 py-1">
            Solver de receta
          </Badge>
          <Badge variant="secondary" className="rounded-full px-3 py-1">
            {sku}
          </Badge>
          {summary ? (
            <Badge variant="outline" className="rounded-full px-3 py-1">
              {formatInteger(summary.bunchesResueltos)} bunches
            </Badge>
          ) : null}
        </div>

        {isLoading ? (
          <div className="flex min-h-[280px] items-center justify-center">
            <div className="flex items-center gap-3 rounded-full border border-border/70 bg-background/80 px-4 py-3 text-sm text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" />
              Construyendo receta del SKU…
            </div>
          </div>
        ) : error ? (
          <div className="min-h-[220px] rounded-2xl border border-slate-300/70 bg-slate-50/80 px-4 py-4 text-sm text-slate-900">
            {error}
          </div>
        ) : summary && data ? (
          <>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <RecipeMetricCard
                label="Recetas activas"
                value={formatInteger(summary.recetasUsadas)}
                hint="Combinaciones distintas usadas por el solver."
              />
              <RecipeMetricCard
                label="Tallos totales"
                value={formatInteger(summary.tallosTotales)}
                hint="Suma neta a repartir entre los bunches resueltos."
              />
              <RecipeMetricCard
                label="Peso promedio real"
                value={`${formatDecimal(summary.pesoPromedioReal)} g`}
                hint={`Ideal por bunch: ${formatDecimal(summary.pesoIdealBunch)} g`}
              />
              <RecipeMetricCard
                label="Penalidad rango"
                value={formatDecimal(summary.penalidadRango)}
                hint={`Estado del solver: ${summary.status}`}
              />
            </div>

            {summary.penalidadRango > 0 ? (
              <div className="rounded-2xl border border-slate-300/70 bg-slate-50/80 px-4 py-4 text-sm text-slate-900">
                La receta encontro una solucion factible, pero algunas combinaciones quedaron fuera del rango
                objetivo de peso para conservar exactamente los tallos resueltos por el primer solver.
              </div>
            ) : null}

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.9fr)]">
              <div className="rounded-2xl border border-border/70">
                <div className="border-b border-border/60 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/65">
                    Recetas por bunch
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Haz scroll para revisar cuantas veces usar cada combinacion de tallos.
                  </p>
                </div>
                <div className="overflow-auto">
                  <table className="min-w-full border-separate border-spacing-0 text-sm">
                    <thead className="sticky top-0 bg-card/95 backdrop-blur">
                      <tr>
                        <th className="border-b border-r border-border/60 bg-card px-3 py-3 text-left font-semibold text-foreground">Cantidad</th>
                        <th className="border-b border-r border-border/60 bg-card px-3 py-3 text-left font-semibold text-foreground">Combinacion</th>
                        <th className="border-b border-r border-border/60 bg-card px-3 py-3 text-right font-semibold text-foreground">Tallos</th>
                        <th className="border-b border-r border-border/60 bg-card px-3 py-3 text-right font-semibold text-foreground">Peso/bunch</th>
                        <th className="border-b border-r border-border/60 bg-card px-3 py-3 text-right font-semibold text-foreground">Dif. ideal</th>
                        <th className="border-b bg-card px-3 py-3 text-left font-semibold text-foreground">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.rows.map((row, index) => (
                        <tr key={row.recetaId} className={index % 2 === 0 ? "bg-background/90" : "bg-muted/18"}>
                          <td className="border-b border-r border-border/40 px-3 py-2.5 font-semibold">
                            {formatInteger(row.cantidad)}
                          </td>
                          <td className="border-b border-r border-border/40 px-3 py-2.5">
                            <div className="flex flex-wrap gap-2">
                              {row.composicion.map((item) => (
                                <span
                                  key={`${row.recetaId}-${item.grado}`}
                                  className="inline-flex rounded-full border border-border/60 bg-background px-2.5 py-1 text-xs font-medium"
                                >
                                  G{item.grado} x {formatInteger(item.tallos)}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="border-b border-r border-border/40 px-3 py-2.5 text-right tabular-nums">
                            {formatInteger(row.tallosPorBunch)}
                          </td>
                          <td className="border-b border-r border-border/40 px-3 py-2.5 text-right tabular-nums">
                            {formatDecimal(row.pesoPorBunch)} g
                          </td>
                          <td className="border-b border-r border-border/40 px-3 py-2.5 text-right tabular-nums">
                            {formatDecimal(row.difIdeal)} g
                          </td>
                          <td className="border-b px-3 py-2.5">
                            <RecipeStatusBadge status={row.estadoPeso} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-2xl border border-border/70">
                <div className="border-b border-border/60 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/65">
                    Consumo por grado
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Cruce entre el objetivo por grado y lo repartido por la receta final.
                  </p>
                </div>
                <div className="overflow-auto">
                  <table className="min-w-full border-separate border-spacing-0 text-sm">
                    <thead className="sticky top-0 bg-card/95 backdrop-blur">
                      <tr>
                        <th className="border-b border-r border-border/60 bg-card px-3 py-3 text-left font-semibold text-foreground">Grado</th>
                        <th className="border-b border-r border-border/60 bg-card px-3 py-3 text-right font-semibold text-foreground">Objetivo</th>
                        <th className="border-b border-r border-border/60 bg-card px-3 py-3 text-right font-semibold text-foreground">Asignado</th>
                        <th className="border-b border-r border-border/60 bg-card px-3 py-3 text-right font-semibold text-foreground">Peso seed</th>
                        <th className="border-b bg-card px-3 py-3 text-right font-semibold text-foreground">Peso total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.gradeTotals.map((row, index) => (
                        <tr key={row.grado} className={index % 2 === 0 ? "bg-background/90" : "bg-muted/18"}>
                          <td className="border-b border-r border-border/40 px-3 py-2.5 font-semibold">{row.grado}</td>
                          <td className="border-b border-r border-border/40 px-3 py-2.5 text-right tabular-nums">
                            {formatInteger(row.tallosObjetivo)}
                          </td>
                          <td className="border-b border-r border-border/40 px-3 py-2.5 text-right tabular-nums">
                            {formatInteger(row.tallosAsignados)}
                          </td>
                          <td className="border-b border-r border-border/40 px-3 py-2.5 text-right tabular-nums">
                            {formatDecimal(row.pesoTalloSeed)} g
                          </td>
                          <td className="border-b px-3 py-2.5 text-right tabular-nums">
                            {formatDecimal(row.pesoTotal)} g
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </SheetShell>
  );
}
