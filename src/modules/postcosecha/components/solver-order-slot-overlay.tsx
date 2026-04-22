"use client";

import type {
  PoscosechaClasificacionOrderRow,
  PoscosechaClasificacionOrderSlot,
  SolverDateKey,
} from "@/lib/postcosecha-clasificacion-en-blanco-types";
import { getDateLabel, orderSlotActiveSkuCount, orderSlotTotal } from "@/lib/postcosecha-clasificacion-en-blanco-client";
import { DialogShell } from "@/shared/overlays/dialog-shell";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { formatInteger } from "@/shared/lib/format";
import { OrdersInputTable } from "@/modules/postcosecha/components/solver-form";

const selectClassName =
  "h-11 w-full rounded-[16px] border border-input bg-background px-4 text-sm text-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/40";

export function SolverOrderSlotOverlay({
  open,
  orders,
  filteredOrders,
  search,
  slot,
  onClose,
  onSearchChange,
  onOrderChange,
  onUpdateSlot,
  onOpenSkuInfo,
}: {
  open: boolean;
  orders: PoscosechaClasificacionOrderRow[];
  filteredOrders: PoscosechaClasificacionOrderRow[];
  search: string;
  slot: PoscosechaClasificacionOrderSlot | null;
  onClose: () => void;
  onSearchChange: (value: string) => void;
  onOrderChange: (skuId: string, dateKey: SolverDateKey, value: string) => void;
  onUpdateSlot: (key: SolverDateKey, patch: Partial<PoscosechaClasificacionOrderSlot>) => void;
  onOpenSkuInfo: (skuId: string) => void;
}) {
  if (!slot) {
    return null;
  }

  return (
    <DialogShell
      open={open}
      onClose={onClose}
      maxWidth="max-w-6xl"
      title={`Capturar ${getDateLabel(slot.key).replace("Fecha", "Orden")}`}
      description="Aqui puedes ajustar la restriccion de la orden y cargar sus bunches."
    >
      <div className="space-y-5">
        <div className="rounded-[24px] border border-border/70 bg-background/80 p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Restriccion de origen</Label>
              <select
                className={selectClassName}
                value={slot.restriction ?? ""}
                onChange={(event) =>
                  onUpdateSlot(slot.key, {
                    restriction: event.target.value ? (event.target.value as PoscosechaClasificacionOrderSlot["restriction"]) : null,
                  })
                }
              >
                <option value="">Cualquiera</option>
                <option value="GV">GV</option>
                <option value="APERTURA">Apertura</option>
                <option value="PRECLASIFICACION">Preclasificacion</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Tipo de restriccion</Label>
              <select
                className={selectClassName}
                value={slot.restrictionMode}
                onChange={(event) =>
                  onUpdateSlot(slot.key, {
                    restrictionMode: event.target.value === "STRICT" ? "STRICT" : "SOFT",
                  })
                }
              >
                <option value="SOFT">Suave</option>
                <option value="STRICT">Estricta</option>
              </select>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-6 text-sm text-muted-foreground">
            <span>{formatInteger(orderSlotTotal(orders, [slot.key]))} bunches en total</span>
            <span>{formatInteger(orderSlotActiveSkuCount(orders, [slot.key]))} SKU activos</span>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="solver-order-overlay-search">Buscar SKU</Label>
          <Input
            id="solver-order-overlay-search"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Filtra por nombre de SKU"
          />
        </div>

        <OrdersInputTable
          rows={filteredOrders}
          onChange={onOrderChange}
          onOpenSkuInfo={onOpenSkuInfo}
          visibleDateKeys={[slot.key]}
        />

        <div className="flex justify-end">
          <Button type="button" variant="outline" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </div>
    </DialogShell>
  );
}
