"use client";

import { FilePenLine, Plus, RotateCcw, Scale, Trash2 } from "lucide-react";

import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { formatInteger } from "@/shared/lib/format";
import {
  getDateLabel,
  lotSlotNetStemsTotal,
  lotSlotMallasTotal,
  orderSlotActiveSkuCount,
  orderSlotTotal,
} from "@/lib/postcosecha-clasificacion-en-blanco-client";
import type {
  PoscosechaClasificacionAvailabilityRow,
  PoscosechaClasificacionLotSlot,
  PoscosechaClasificacionOrderRow,
  PoscosechaClasificacionOrderSlot,
} from "@/lib/postcosecha-clasificacion-en-blanco-types";
import { SolverMetricTile } from "@/modules/postcosecha/components/solver-feedback-states";

export function SolverInputsSection({
  orders,
  availability,
  desperdicio,
  orderSlots,
  lotSlots,
  ordersWithCapture,
  gradesWithCapture,
  onResetOrders,
  onResetAvailability,
  onAddOrderSlot,
  onAddLotSlot,
  onEditOrderSlot,
  onEditLotSlot,
  onRemoveOrderSlot,
  onRemoveLotSlot,
  onOpenWeightEditor,
}: {
  orders: PoscosechaClasificacionOrderRow[];
  availability: PoscosechaClasificacionAvailabilityRow[];
  desperdicio: number;
  orderSlots: PoscosechaClasificacionOrderSlot[];
  lotSlots: PoscosechaClasificacionLotSlot[];
  ordersWithCapture: number;
  gradesWithCapture: number;
  onResetOrders: () => void;
  onResetAvailability: () => void;
  onAddOrderSlot: () => void;
  onAddLotSlot: () => void;
  onEditOrderSlot: (key: PoscosechaClasificacionOrderSlot["key"]) => void;
  onEditLotSlot: (key: PoscosechaClasificacionLotSlot["key"]) => void;
  onRemoveOrderSlot: (key: PoscosechaClasificacionOrderSlot["key"]) => void;
  onRemoveLotSlot: (key: PoscosechaClasificacionLotSlot["key"]) => void;
  onOpenWeightEditor: () => void;
}) {
  return (
    <div className="grid gap-4 2xl:grid-cols-2">
      <Card className="starter-panel min-w-0 border-border/70 bg-card/84">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 space-y-2">
              <CardTitle className="text-lg">Pedidos por SKU</CardTitle>
              <CardDescription className="max-w-2xl">
                Captura manual de bunches por prioridad de orden. La base siempre nace desde el maestro activo de SKU.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
              <Button type="button" variant="outline" size="icon" onClick={onAddOrderSlot} aria-label="Agregar orden">
                <Plus className="size-4" />
              </Button>
              <Button type="button" variant="outline" className="min-w-0 sm:min-w-[116px]" onClick={onResetOrders}>
                <RotateCcw className="size-4" />
                Limpiar
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 rounded-[20px] border border-border/70 bg-background/60 px-4 py-3 text-sm text-muted-foreground">
            <div className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
              <span>Resolucion: <strong>GV / APERTURA / PRECLASIFICACION</strong></span>
              <span>Ordenes activas: <strong>{orderSlots.length}</strong></span>
            </div>
            <div className="flex flex-wrap gap-2">
              {orderSlots.map((slot, index) => (
                <span key={slot.key} className="max-w-full rounded-full border border-border/70 px-3 py-1 text-xs leading-5 break-words">
                  {`Orden ${index + 1}`}{slot.restriction ? ` | restr. ${slot.restriction} ${slot.restrictionMode === "STRICT" ? "estricta" : "suave"}` : ""}
                </span>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
            <span>{formatInteger(orderSlots.length)} ordenes configuradas.</span>
            <span>{formatInteger(ordersWithCapture)} SKU con pedido activo.</span>
          </div>

          <div className="grid gap-3 xl:grid-cols-2">
            {orderSlots.map((slot) => (
              <div key={slot.key} className="min-w-0 rounded-[24px] border border-border/70 bg-background/80 px-4 py-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground break-words">{getDateLabel(slot.key).replace("Fecha", "Orden")}</p>
                    <p className="mt-1 text-xs text-muted-foreground break-words">
                      {slot.restriction
                        ? `Restriccion ${slot.restriction.toLowerCase()} ${slot.restrictionMode === "STRICT" ? "estricta" : "suave"}`
                        : "Sin restriccion de origen"}
                    </p>
                  </div>
                  <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                    <Button type="button" size="sm" variant="outline" className="w-full sm:w-auto" onClick={() => onEditOrderSlot(slot.key)}>
                      <FilePenLine className="size-4" />
                      Modificar
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="w-full sm:w-auto"
                      onClick={() => onRemoveOrderSlot(slot.key)}
                      disabled={orderSlots.length <= 1}
                    >
                      <Trash2 className="size-4" />
                      Eliminar
                    </Button>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 xl:grid-cols-2">
                  <SolverMetricTile
                    label="Bunches"
                    value={formatInteger(orderSlotTotal(orders, [slot.key]))}
                    hint="Total cargado para esta orden."
                  />
                  <SolverMetricTile
                    label="SKU activos"
                    value={formatInteger(orderSlotActiveSkuCount(orders, [slot.key]))}
                    hint="SKU con pedido mayor a cero."
                    tone={orderSlotActiveSkuCount(orders, [slot.key]) > 0 ? "positive" : "default"}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="starter-panel min-w-0 border-border/70 bg-card/84">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 space-y-2">
              <CardTitle className="text-lg">Disponibilidad por grado</CardTitle>
              <CardDescription className="max-w-2xl">
                Captura manual de mallas por prioridad. El peso tallo seed se edita de forma global por grado.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
              <Button type="button" variant="outline" size="icon" onClick={onOpenWeightEditor} aria-label="Editar pesos seed">
                <Scale className="size-4" />
              </Button>
              <Button type="button" variant="outline" size="icon" onClick={onAddLotSlot} aria-label="Agregar lote">
                <Plus className="size-4" />
              </Button>
              <Button type="button" variant="outline" className="min-w-0 sm:min-w-[132px]" onClick={onResetAvailability}>
                <RotateCcw className="size-4" />
                Restaurar
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_220px]">
            <div className="min-w-0 rounded-[20px] border border-border/70 bg-background/60 px-4 py-3 text-sm text-muted-foreground">
              El peso seed se administra globalmente y cada lote conserva su fecha real y origen.
            </div>
            <SolverMetricTile
              label="Grados con captura"
              value={formatInteger(gradesWithCapture)}
              hint="Filas con mallas mayores a cero."
              tone={gradesWithCapture > 0 ? "positive" : "default"}
            />
          </div>

          <div className="grid gap-3 xl:grid-cols-2">
            {lotSlots.map((slot) => (
              <div key={slot.key} className="min-w-0 rounded-[24px] border border-border/70 bg-background/80 px-4 py-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground break-words">{getDateLabel(slot.key)}</p>
                    <p className="mt-1 text-xs text-muted-foreground break-words">
                      {slot.origin}{slot.lotDate ? ` | ${slot.lotDate}` : ""}
                    </p>
                  </div>
                  <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                    <Button type="button" size="sm" variant="outline" className="w-full sm:w-auto" onClick={() => onEditLotSlot(slot.key)}>
                      <FilePenLine className="size-4" />
                      Modificar
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="w-full sm:w-auto"
                      onClick={() => onRemoveLotSlot(slot.key)}
                      disabled={lotSlots.length <= 1}
                    >
                      <Trash2 className="size-4" />
                      Eliminar
                    </Button>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 xl:grid-cols-2">
                  <SolverMetricTile
                    label="Mallas"
                    value={formatInteger(lotSlotMallasTotal(availability, [slot.key]))}
                    hint="Total cargado en el lote."
                  />
                  <SolverMetricTile
                    label="Tallos netos"
                    value={formatInteger(lotSlotNetStemsTotal(availability, [slot.key], desperdicio))}
                    hint="Estimado con desperdicio actual."
                    tone={lotSlotNetStemsTotal(availability, [slot.key], desperdicio) > 0 ? "positive" : "default"}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
