"use client";

import { ScrollFadeTable } from "@/shared/tables/scroll-fade-table";
import { Input } from "@/shared/ui/input";
import { buildClasificacionAvailabilityDerived, getDateLabel } from "@/lib/postcosecha-clasificacion-en-blanco-client";
import type {
  PoscosechaClasificacionAvailabilityRow,
  PoscosechaClasificacionOrderRow,
  SolverDateKey,
} from "@/lib/postcosecha-clasificacion-en-blanco-types";
import { SOLVER_DATE_KEYS } from "@/lib/postcosecha-clasificacion-en-blanco-types";
import { formatInteger } from "@/shared/lib/format";

import {
  handleCaptureInputTab,
  orderTotal,
  type SolverAvailabilityDateUpdater,
  type SolverOrderValueUpdater,
} from "@/modules/postcosecha/components/solver-utils";

export function OrdersInputTable({
  rows,
  onChange,
  onOpenSkuInfo,
  visibleDateKeys = SOLVER_DATE_KEYS,
}: {
  rows: PoscosechaClasificacionOrderRow[];
  onChange: SolverOrderValueUpdater;
  onOpenSkuInfo?: (skuId: string) => void;
  visibleDateKeys?: readonly SolverDateKey[];
}) {
  return (
    <div
      className="max-h-[600px] overflow-y-auto rounded-[24px] border border-border/70 bg-background/80"
      data-capture-scope="true"
    >
      <ScrollFadeTable className="rounded-none border-0">
        <table className="min-w-[840px] w-full text-sm">
        <thead className="sticky top-0 bg-card/96 backdrop-blur">
          <tr className="border-b border-border/70 text-left text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            <th className="px-4 py-3 font-medium">SKU</th>
            {visibleDateKeys.map((key) => (
              <th key={key} className="px-3 py-3 text-center font-medium">
                {getDateLabel(key)}
              </th>
            ))}
            <th className="px-4 py-3 text-right font-medium">Total</th>
            {onOpenSkuInfo ? <th className="px-4 py-3 text-right font-medium">Detalle</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.skuId} className="border-b border-border/50 last:border-b-0">
              <td className="px-4 py-3 align-middle font-medium">{row.sku}</td>
              {visibleDateKeys.map((key) => (
                <td key={key} className="px-3 py-2 text-center">
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    value={row[key]}
                    onChange={(event) => onChange(row.skuId, key, event.target.value)}
                    onKeyDown={handleCaptureInputTab}
                    data-capture-input="true"
                    className="mx-auto h-11 w-20 text-right"
                  />
                </td>
              ))}
              <td className="px-4 py-3 text-right font-medium text-muted-foreground">
                {formatInteger(orderTotal(row))}
              </td>
              {onOpenSkuInfo ? (
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    className="text-sm font-medium text-foreground transition hover:text-slate-700 hover:underline"
                    onClick={() => onOpenSkuInfo(row.skuId)}
                  >
                    Ver SKU
                  </button>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
        </table>
      </ScrollFadeTable>
    </div>
  );
}

export function AvailabilityInputTable({
  rows,
  desperdicio,
  onDateChange,
  onWeightChange,
  weightReadOnly = false,
  visibleDateKeys = SOLVER_DATE_KEYS,
}: {
  rows: PoscosechaClasificacionAvailabilityRow[];
  desperdicio: number;
  onDateChange: SolverAvailabilityDateUpdater;
  onWeightChange: (grado: number, value: string) => void;
  weightReadOnly?: boolean;
  visibleDateKeys?: readonly SolverDateKey[];
}) {
  const derivedRows = buildClasificacionAvailabilityDerived(rows, desperdicio);
  const derivedByGrade = new Map(derivedRows.map((row) => [row.grado, row]));

  return (
    <div
      className="max-h-[600px] overflow-y-auto rounded-[24px] border border-border/70 bg-background/80"
      data-capture-scope="true"
    >
      <ScrollFadeTable className="rounded-none border-0">
        <table className="min-w-[860px] w-full text-sm">
        <thead className="sticky top-0 bg-card/96 backdrop-blur">
          <tr className="border-b border-border/70 text-left text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            <th className="px-4 py-3 font-medium">Grado</th>
            {visibleDateKeys.map((key) => (
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
                {visibleDateKeys.map((key) => (
                  <td key={key} className="px-3 py-2 text-center">
                    <Input
                      type="number"
                      min={0}
                      step={1}
                      value={row[key]}
                      onChange={(event) => onDateChange(row.grado, key, event.target.value)}
                      onKeyDown={handleCaptureInputTab}
                      data-capture-input="true"
                      className="mx-auto h-11 w-20 text-right"
                    />
                  </td>
                ))}
                <td className="px-3 py-2 text-center">
                  {weightReadOnly ? (
                    <div className="mx-auto flex h-11 w-24 items-center justify-end rounded-[16px] border border-border/70 bg-muted/20 px-3 text-right text-sm text-muted-foreground">
                      {row.pesoTalloSeed}
                    </div>
                  ) : (
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      value={row.pesoTalloSeed}
                      onChange={(event) => onWeightChange(row.grado, event.target.value)}
                      onKeyDown={handleCaptureInputTab}
                      data-capture-input="true"
                      className="mx-auto h-11 w-24 text-right"
                    />
                  )}
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
      </ScrollFadeTable>
    </div>
  );
}
