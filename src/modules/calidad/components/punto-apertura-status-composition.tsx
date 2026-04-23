"use client";

import { X } from "lucide-react";

import type { PuntoAperturaRecord, PuntoAperturaStatus } from "@/lib/calidad-punto-apertura";
import { MetricTile } from "@/shared/data-display/metric-tile";
import { formatInteger, formatPercent } from "@/shared/lib/format";
import { KpiGrid } from "@/shared/layout/filter-panel";
import { DialogShell } from "@/shared/overlays/dialog-shell";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";

const APERTURE_COMPOSITION = [
  { key: "boton", label: "Botón" },
  { key: "unoTres", label: "1 a 3" },
  { key: "cuatroNueve", label: "4 a 9" },
  { key: "diezVeinte", label: "10 a 20" },
  { key: "masVeinte", label: "Más de 20" },
] as const;

export type StatusComposition = ReturnType<typeof buildStatusComposition>;

export function buildStatusComposition(records: PuntoAperturaRecord[], status: PuntoAperturaStatus) {
  const filtered = records.filter((record) => record.estado === status);
  const totals = {
    boton: 0,
    unoTres: 0,
    cuatroNueve: 0,
    diezVeinte: 0,
    masVeinte: 0,
  };
  let dominantTotal = 0;

  for (const record of filtered) {
    totals.boton += record.apertura.boton;
    totals.unoTres += record.apertura.unoTres;
    totals.cuatroNueve += record.apertura.cuatroNueve;
    totals.diezVeinte += record.apertura.diezVeinte;
    totals.masVeinte += record.apertura.masVeinte;
    dominantTotal += record.dominanteValor;
  }

  const total = Object.values(totals).reduce((sum, value) => sum + value, 0);
  const otherTotal = Math.max(total - dominantTotal, 0);

  return {
    records: filtered.length,
    total,
    dominantTotal,
    otherTotal,
    dominantPct: total > 0 ? (dominantTotal / total) * 100 : 0,
    otherPct: total > 0 ? (otherTotal / total) * 100 : 0,
    items: APERTURE_COMPOSITION.map((entry) => ({
      key: entry.key,
      label: entry.label,
      count: totals[entry.key],
      pct: total > 0 ? (totals[entry.key] / total) * 100 : 0,
    })),
  };
}

export function StatusCompositionPanel({
  title,
  composition,
  emptyLabel,
}: {
  title: string;
  composition: StatusComposition;
  emptyLabel: string;
}) {
  return (
    <div className="space-y-3 rounded-[28px] border border-border/70 bg-background/70 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-xs text-muted-foreground">
            Distribución calculada solo sobre los registros de este grupo.
          </p>
        </div>
        <Badge variant="secondary" className="rounded-full px-3 py-1">
          {formatInteger(composition.records)} registros | {formatInteger(composition.total)} tallos
        </Badge>
      </div>

      {composition.total > 0 ? (
        <KpiGrid columns={2}>
          <MetricTile label="Punto dominante" value={formatPercent(composition.dominantPct)} hint={`${formatInteger(composition.dominantTotal)} tallos`} accent="success" />
          <MetricTile label="Otros puntos" value={formatPercent(composition.otherPct)} hint={`${formatInteger(composition.otherTotal)} tallos`} />
        </KpiGrid>
      ) : (
        <p className="rounded-[18px] border border-dashed border-border/70 px-4 py-6 text-center text-sm text-muted-foreground">
          {emptyLabel}
        </p>
      )}
    </div>
  );
}

export function StatusCompositionDialog({
  title,
  composition,
  emptyLabel,
  onClose,
}: {
  title: string;
  composition: StatusComposition;
  emptyLabel: string;
  onClose: () => void;
}) {
  return (
    <DialogShell
      title={title}
      description="Distribución calculada solo sobre los registros del grupo seleccionado."
      maxWidth="max-w-5xl"
      onClose={onClose}
      headerActions={(
        <Button variant="ghost" size="sm" onClick={onClose} aria-label="Cerrar distribución">
          <X className="size-4" aria-hidden="true" />
        </Button>
      )}
    >
      <StatusCompositionPanel title={title} composition={composition} emptyLabel={emptyLabel} />
    </DialogShell>
  );
}
