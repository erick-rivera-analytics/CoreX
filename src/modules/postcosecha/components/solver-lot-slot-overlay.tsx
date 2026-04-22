"use client";

import type {
  PoscosechaClasificacionAvailabilityRow,
  PoscosechaClasificacionLotSlot,
  SolverDateKey,
} from "@/lib/postcosecha-clasificacion-en-blanco-types";
import { getDateLabel, lotSlotMallasTotal, lotSlotNetStemsTotal } from "@/lib/postcosecha-clasificacion-en-blanco-client";
import { DialogShell } from "@/shared/overlays/dialog-shell";
import { Button } from "@/shared/ui/button";
import { Label } from "@/shared/ui/label";
import { AvailabilityInputTable } from "@/modules/postcosecha/components/solver-form";
import { formatInteger } from "@/shared/lib/format";

const selectClassName =
  "h-11 w-full rounded-[16px] border border-input bg-background px-4 text-sm text-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/40";

export function SolverLotSlotOverlay({
  open,
  availability,
  desperdicio,
  slot,
  onClose,
  onUpdateSlot,
  onAvailabilityDateChange,
}: {
  open: boolean;
  availability: PoscosechaClasificacionAvailabilityRow[];
  desperdicio: number;
  slot: PoscosechaClasificacionLotSlot | null;
  onClose: () => void;
  onUpdateSlot: (key: SolverDateKey, patch: Partial<PoscosechaClasificacionLotSlot>) => void;
  onAvailabilityDateChange: (grado: number, dateKey: SolverDateKey, value: string) => void;
}) {
  if (!slot) {
    return null;
  }

  return (
    <DialogShell
      open={open}
      onClose={onClose}
      maxWidth="max-w-6xl"
      title={`Capturar ${getDateLabel(slot.key)}`}
      description="Aqui puedes ajustar la configuracion del lote y cargar sus mallas."
    >
      <div className="space-y-5">
        <div className="rounded-[24px] border border-border/70 bg-background/80 p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Fecha real del lote</Label>
              <input
                type="date"
                className={selectClassName}
                value={slot.lotDate ?? ""}
                onChange={(event) => onUpdateSlot(slot.key, { lotDate: event.target.value || null })}
              />
            </div>
            <div className="space-y-2">
              <Label>Origen</Label>
              <select
                className={selectClassName}
                value={slot.origin}
                onChange={(event) =>
                  onUpdateSlot(slot.key, {
                    origin:
                      event.target.value === "APERTURA" || event.target.value === "PRECLASIFICACION"
                        ? event.target.value
                        : "GV",
                  })
                }
              >
                <option value="GV">GV</option>
                <option value="APERTURA">Apertura</option>
                <option value="PRECLASIFICACION">Preclasificacion</option>
              </select>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-6 text-sm text-muted-foreground">
            <span>{formatInteger(lotSlotMallasTotal(availability, [slot.key]))} mallas en total</span>
            <span>{formatInteger(lotSlotNetStemsTotal(availability, [slot.key], desperdicio))} tallos netos</span>
          </div>
        </div>

        <AvailabilityInputTable
          rows={availability}
          desperdicio={desperdicio}
          onDateChange={onAvailabilityDateChange}
          onWeightChange={() => undefined}
          weightReadOnly
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
