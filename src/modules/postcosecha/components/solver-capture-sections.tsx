"use client";

import { LoaderCircle, Play, RotateCcw, Search, TableProperties } from "lucide-react";

import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { cn } from "@/lib/utils";
import { formatInteger } from "@/shared/lib/format";
import { buildClasificacionPrecheck } from "@/lib/postcosecha-clasificacion-en-blanco-client";
import type {
  PoscosechaClasificacionAvailabilityRow,
  PoscosechaClasificacionOrderRow,
  SolverDateKey,
} from "@/lib/postcosecha-clasificacion-en-blanco-types";

import { SolverMetricTile } from "@/modules/postcosecha/components/solver-feedback-states";
import { AvailabilityInputTable, OrdersInputTable } from "@/modules/postcosecha/components/solver-form";

export function SolverInputsSection({
  orders,
  filteredOrders,
  ordersWithCapture,
  search,
  availability,
  desperdicio,
  gradesWithCapture,
  onSearchChange,
  onResetOrders,
  onOrderChange,
  onResetAvailability,
  onDesperdicioChange,
  onAvailabilityDateChange,
  onAvailabilityWeightChange,
}: {
  orders: PoscosechaClasificacionOrderRow[];
  filteredOrders: PoscosechaClasificacionOrderRow[];
  ordersWithCapture: number;
  search: string;
  availability: PoscosechaClasificacionAvailabilityRow[];
  desperdicio: number;
  gradesWithCapture: number;
  onSearchChange: (value: string) => void;
  onResetOrders: () => void;
  onOrderChange: (skuId: string, dateKey: SolverDateKey, value: string) => void;
  onResetAvailability: () => void;
  onDesperdicioChange: (value: string) => void;
  onAvailabilityDateChange: (grado: number, dateKey: SolverDateKey, value: string) => void;
  onAvailabilityWeightChange: (grado: number, value: string) => void;
}) {
  return (
    <div className="space-y-4">
      <Card className="starter-panel border-border/70 bg-card/84">
        <CardHeader className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-2">
              <CardTitle className="text-lg">Pedidos por SKU</CardTitle>
              <CardDescription>
                Captura manual de bunches por fecha. La base siempre nace desde el maestro activo de SKU.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" onClick={onResetOrders}>
                <RotateCcw className="size-4" />
                Limpiar pedidos
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="solver-sku-search">Buscar SKU</Label>
            <div className="relative max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="solver-sku-search"
                value={search}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder="Filtra por nombre de SKU"
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
            <span>Mostrando {filteredOrders.length} de {orders.length} SKU.</span>
            <span>{formatInteger(ordersWithCapture)} SKU con pedido activo.</span>
          </div>
          <OrdersInputTable rows={filteredOrders} onChange={onOrderChange} />
        </CardContent>
      </Card>

      <Card className="starter-panel border-border/70 bg-card/84">
        <CardHeader className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-2">
              <CardTitle className="text-lg">Disponibilidad por grado</CardTitle>
              <CardDescription>
                Captura manual de mallas por fecha y peso tallo seed en gramos para cada grado.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" onClick={onResetAvailability}>
                <RotateCcw className="size-4" />
                Restaurar base
              </Button>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_200px]">
            <div className="space-y-2">
              <Label htmlFor="solver-desperdicio">Desperdicio</Label>
              <Input
                id="solver-desperdicio"
                type="number"
                min={0}
                max={0.95}
                step={0.01}
                value={desperdicio}
                onChange={(event) => onDesperdicioChange(event.target.value)}
              />
            </div>
            <SolverMetricTile
              label="Grados con captura"
              value={formatInteger(gradesWithCapture)}
              hint="Filas con mallas mayores a cero."
              tone={gradesWithCapture > 0 ? "positive" : "default"}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <AvailabilityInputTable
            rows={availability}
            desperdicio={desperdicio}
            onDateChange={onAvailabilityDateChange}
            onWeightChange={onAvailabilityWeightChange}
          />
        </CardContent>
      </Card>
    </div>
  );
}

export function SolverPrecheckSection({
  precheck,
  result,
  isRunning,
  onClearResults,
  onRun,
}: {
  precheck: ReturnType<typeof buildClasificacionPrecheck>;
  result: unknown;
  isRunning: boolean;
  onClearResults: () => void;
  onRun: () => void;
}) {
  return (
    <Card className="starter-panel border-border/70 bg-card/84">
      <CardHeader className="space-y-2">
        <CardTitle className="text-lg">Validacion previa</CardTitle>
        <CardDescription>
          La corrida solo se habilita cuando los tallos pedidos minimos son al menos iguales a los tallos disponibles netos.
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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            El solver prioriza Fecha 1, luego Fecha 2 y asi sucesivamente antes de optimizar peso y uso de grados.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" onClick={onClearResults} disabled={!result}>
              <TableProperties className="size-4" />
              Limpiar resultados
            </Button>
            <Button type="button" onClick={onRun} disabled={!precheck.isValid || isRunning}>
              {isRunning ? <LoaderCircle className="size-4 animate-spin" /> : <Play className="size-4" />}
              Resolver modelo unificado
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
