"use client";

import type { ReactNode } from "react";
import { LoaderCircle, Play, TableProperties } from "lucide-react";

import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { cn } from "@/lib/utils";
import { formatInteger } from "@/shared/lib/format";
import type {
  PoscosechaClasificacionPrecheck,
  PoscosechaClasificacionRunMode,
} from "@/lib/postcosecha-clasificacion-en-blanco-types";
import { SolverMetricTile } from "@/modules/postcosecha/components/solver-feedback-states";

export function SolverPrecheckSection({
  precheck,
  precheckModes,
  flexiblePrecheck,
  hasResult,
  isResultStale,
  isRunning,
  exportAction,
  onClearResults,
  onRun,
}: {
  precheck: PoscosechaClasificacionPrecheck;
  precheckModes: Array<{
    mode: PoscosechaClasificacionRunMode;
    label: string;
    precheck: PoscosechaClasificacionPrecheck;
  }>;
  flexiblePrecheck: PoscosechaClasificacionPrecheck;
  hasResult: boolean;
  isResultStale?: boolean;
  isRunning: boolean;
  exportAction?: ReactNode;
  onClearResults: () => void;
  onRun: () => void;
}) {
  return (
    <Card className="starter-panel border-border/70 bg-card/84">
      <CardHeader className="space-y-2">
        <CardTitle className="text-lg">Validacion previa</CardTitle>
        <CardDescription>
          El precheck revisa cobertura minima y disponibilidad neta por origen antes de ejecutar la corrida multimodo.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <SolverMetricTile label="Tallos pedidos" value={formatInteger(precheck.tallosPedidos)} hint="Minimos requeridos por el maestro SKU." />
          <SolverMetricTile label="Tallos disponibles" value={formatInteger(precheck.tallosDisponibles)} hint="Netos, despues del desperdicio." />
          <SolverMetricTile
            label="Holgura captura"
            value={formatInteger(precheck.diferencia)}
            hint="Pedidos menos disponibilidad."
            tone={precheck.isValid ? "positive" : "warning"}
          />
          <SolverMetricTile
            label="Corrida"
            value={precheck.isValid ? "Lista" : "Bloqueada"}
            hint={precheck.isValid ? "Ya puedes ejecutar el solver." : "Ajusta primero pedidos o disponibilidad."}
            tone={precheck.isValid ? "positive" : "warning"}
          />
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <SolverMetricTile
            label="Holgura flexible"
            value={formatInteger(flexiblePrecheck.diferencia)}
            hint={`${formatInteger(flexiblePrecheck.tallosPedidos)} pedidos vs ${formatInteger(flexiblePrecheck.tallosDisponibles)} disponibles`}
            tone={flexiblePrecheck.isValid ? "positive" : "warning"}
          />
          {precheckModes.map(({ mode, precheck: modePrecheck }) => (
            <SolverMetricTile
              key={mode}
              label={`Holgura ${mode}`}
              value={formatInteger(modePrecheck.diferencia)}
              hint={`${formatInteger(modePrecheck.tallosPedidos)} pedidos vs ${formatInteger(modePrecheck.tallosDisponibles)} disponibles`}
              tone={modePrecheck.isValid ? "positive" : "warning"}
            />
          ))}
        </div>
        <div
          className={cn(
            "rounded-[24px] border px-4 py-4 text-sm",
            precheck.isValid
              ? "border-chart-success-bold/40 bg-chart-success-bold/10"
              : "border-slate-400/40 bg-slate-400/10",
          )}
        >
          {precheck.message}
        </div>
        <div className="space-y-2">
          <div
            className={cn(
              "rounded-[24px] border px-4 py-4 text-sm",
              flexiblePrecheck.isValid
                ? "border-chart-success-bold/40 bg-chart-success-bold/10"
                : "border-slate-400/40 bg-slate-400/10",
            )}
          >
            <strong>Flexible:</strong> {flexiblePrecheck.message}
          </div>
          {precheckModes.map(({ mode, precheck: modePrecheck }) => (
            <div
              key={mode}
              className={cn(
                "rounded-[24px] border px-4 py-4 text-sm",
                modePrecheck.isValid
                  ? "border-chart-success-bold/40 bg-chart-success-bold/10"
                  : "border-slate-400/40 bg-slate-400/10",
              )}
            >
              <strong>{mode}:</strong> {modePrecheck.message}
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <p className="max-w-2xl text-sm text-muted-foreground">
            El solver resuelve por origen y conserva la prioridad de captura por fecha antes de optimizar peso y uso de grados.
          </p>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
            <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={onClearResults} disabled={!hasResult}>
              <TableProperties className="size-4" />
              Limpiar resultados
            </Button>
            {exportAction}
            <Button
              type="button"
              className="w-full sm:w-auto"
              onClick={onRun}
              disabled={!precheckModes.some((item) => item.precheck.isValid) || isRunning}
            >
              {isRunning ? <LoaderCircle className="size-4 animate-spin" /> : <Play className="size-4" />}
              {isResultStale ? "Volver a resolver" : "Resolver modelo unificado"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
