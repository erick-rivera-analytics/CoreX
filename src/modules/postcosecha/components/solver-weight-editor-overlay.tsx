"use client";

import { DialogShell } from "@/shared/overlays/dialog-shell";
import { Label } from "@/shared/ui/label";
import { Input } from "@/shared/ui/input";
import type { PoscosechaClasificacionAvailabilityRow } from "@/lib/postcosecha-clasificacion-en-blanco-types";

export function SolverWeightEditorOverlay({
  open,
  rows,
  onClose,
  onWeightChange,
}: {
  open: boolean;
  rows: PoscosechaClasificacionAvailabilityRow[];
  onClose: () => void;
  onWeightChange: (grado: number, value: string) => void;
}) {
  return (
    <DialogShell
      open={open}
      onClose={onClose}
      maxWidth="max-w-3xl"
      title="Pesos seed por grado"
      description="Ajusta los pesos tallo seed usados como referencia para construir la disponibilidad gestionable."
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((row) => (
          <div key={row.grado} className="rounded-[24px] border border-border/70 bg-background/80 p-4">
            <Label htmlFor={`solver-weight-${row.grado}`}>Grado {row.grado}</Label>
            <Input
              id={`solver-weight-${row.grado}`}
              type="number"
              min={0}
              step={0.01}
              className="mt-3"
              value={row.pesoTalloSeed}
              onChange={(event) => onWeightChange(row.grado, event.target.value)}
            />
          </div>
        ))}
      </div>
    </DialogShell>
  );
}
