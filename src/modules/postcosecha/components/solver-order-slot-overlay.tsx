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
import { SingleSelectField } from "@/shared/filters/single-select-field";
import { formatInteger } from "@/shared/lib/format";
import { OrdersInputTable } from "@/modules/postcosecha/components/solver-form";

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
            <SingleSelectField
              id="order-slot-restriction"
              label="Restriccion de origen"
              value={slot.restriction ?? ""}
              emptyValue=""
              emptyLabel="Cualquiera"
              options={["GV", "APERTURA", "PRECLASIFICACION"]}
              displayValue={(v) => v === "APERTURA" ? "Apertura" : v === "PRECLASIFICACION" ? "Preclasificacion" : v}
              onChange={(v) =>
                onUpdateSlot(slot.key, {
                  restriction: v ? (v as PoscosechaClasificacionOrderSlot["restriction"]) : null,
                })
              }
            />
            <SingleSelectField
              id="order-slot-restriction-mode"
              label="Tipo de restriccion"
              value={slot.restrictionMode}
              emptyValue="SOFT"
              emptyLabel="Suave"
              options={["STRICT"]}
              displayValue={() => "Estricta"}
              onChange={(v) =>
                onUpdateSlot(slot.key, {
                  restrictionMode: v === "STRICT" ? "STRICT" : "SOFT",
                })
              }
            />
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
