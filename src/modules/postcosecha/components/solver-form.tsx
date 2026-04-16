"use client";

import { Input } from "@/shared/ui/input";
import { buildClasificacionAvailabilityDerived, getDateLabel } from "@/lib/postcosecha-clasificacion-en-blanco-client";
import type {
  PoscosechaClasificacionAvailabilityRow,
  PoscosechaClasificacionOrderRow,
} from "@/lib/postcosecha-clasificacion-en-blanco-types";
import { SOLVER_DATE_KEYS } from "@/lib/postcosecha-clasificacion-en-blanco-types";
import { formatInteger } from "@/shared/lib/format";

import {
  orderTotal,
  type SolverAvailabilityDateUpdater,
  type SolverOrderValueUpdater,
} from "@/modules/postcosecha/components/solver-utils";

export function OrdersInputTable({
  rows,
  onChange,
}: {
  rows: PoscosechaClasificacionOrderRow[];
  onChange: SolverOrderValueUpdater;
}) {
  return (
    <div className="max-h-[600px] overflow-auto rounded-[24px] border border-border/70 bg-background/80">
      <table className="min-w-[720px] w-full text-sm">
        <thead className="sticky top-0 bg-card/96 backdrop-blur">
          <tr className="border-b border-border/70 text-left text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            <th className="px-4 py-3 font-medium">SKU</th>
            {SOLVER_DATE_KEYS.map((key) => (
              <th key={key} className="px-3 py-3 text-center font-medium">
                {getDateLabel(key)}
              </th>
            ))}
            <th className="px-4 py-3 text-right font-medium">Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.skuId} className="border-b border-border/50 last:border-b-0">
              <td className="px-4 py-3 align-middle font-medium">{row.sku}</td>
              {SOLVER_DATE_KEYS.map((key) => (
                <td key={key} className="px-3 py-2 text-center">
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    value={row[key]}
                    onChange={(event) => onChange(row.skuId, key, event.target.value)}
                    className="mx-auto h-11 w-20 text-right"
                  />
                </td>
              ))}
              <td className="px-4 py-3 text-right font-medium text-muted-foreground">
                {formatInteger(orderTotal(row))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AvailabilityInputTable({
  rows,
  desperdicio,
  onDateChange,
  onWeightChange,
}: {
  rows: PoscosechaClasificacionAvailabilityRow[];
  desperdicio: number;
  onDateChange: SolverAvailabilityDateUpdater;
  onWeightChange: (grado: number, value: string) => void;
}) {
  const derivedRows = buildClasificacionAvailabilityDerived(rows, desperdicio);
  const derivedByGrade = new Map(derivedRows.map((row) => [row.grado, row]));

  return (
    <div className="max-h-[600px] overflow-auto rounded-[24px] border border-border/70 bg-background/80">
      <table className="min-w-[860px] w-full text-sm">
        <thead className="sticky top-0 bg-card/96 backdrop-blur">
          <tr className="border-b border-border/70 text-left text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            <th className="px-4 py-3 font-medium">Grado</th>
            {SOLVER_DATE_KEYS.map((key) => (
              <th key={key} className="px-3 py-3 text-center font-medium">
                {getDateLabel(key)}
              </th>
            ))}
            <th className="px-3 py-3 text-center font-medium">Peso tallo seed (g)</th>
            <th className="px-4 py-3 text-right font-medium">Mallas</th>
            <th className="px-4 py-3 text-right font-medium">Tallos netos</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const derived = derivedByGrade.get(row.grado);

            return (
              <tr key={row.grado} className="border-b border-border/50 last:border-b-0">
                <td className="px-4 py-3 align-middle font-medium">{row.grado}</td>
                {SOLVER_DATE_KEYS.map((key) => (
                  <td key={key} className="px-3 py-2 text-center">
                    <Input
                      type="number"
                      min={0}
                      step={1}
                      value={row[key]}
                      onChange={(event) => onDateChange(row.grado, key, event.target.value)}
                      className="mx-auto h-11 w-20 text-right"
                    />
                  </td>
                ))}
                <td className="px-3 py-2 text-center">
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    value={row.pesoTalloSeed}
                    onChange={(event) => onWeightChange(row.grado, event.target.value)}
                    className="mx-auto h-11 w-24 text-right"
                  />
                </td>
                <td className="px-4 py-3 text-right font-medium text-muted-foreground">
                  {formatInteger(derived?.mallasTotales ?? 0)}
                </td>
                <td className="px-4 py-3 text-right font-medium text-muted-foreground">
                  {formatInteger(derived?.tallosNetos ?? 0)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
