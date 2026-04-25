"use client";

import { X } from "lucide-react";

import { DialogShell } from "@/shared/overlays/dialog-shell";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { KpiGrid } from "@/shared/layout/filter-panel";
import { MetricTile } from "@/shared/data-display/metric-tile";
import { formatInteger, formatIsoWeekLabel, formatPercent } from "@/shared/lib/format";
import type { PuntoAperturaRecord } from "@/lib/calidad-punto-apertura";

const APERTURE_ROWS = [
  { key: "boton", label: "Botón" },
  { key: "unoTres", label: "1 a 3" },
  { key: "cuatroNueve", label: "4 a 9" },
  { key: "diezVeinte", label: "10 a 20" },
  { key: "masVeinte", label: "Más de 20" },
] as const;

export function PuntoAperturaRecordOverlay({
  record,
  lowerLimitPct,
  onClose,
}: {
  record: PuntoAperturaRecord | null;
  lowerLimitPct: number;
  onClose: () => void;
}) {
  if (!record) return null;

  return (
    <DialogShell
      title={`Registro ${record.fecha} / Bloque ${record.bloque}`}
      description="Participación completa por punto de apertura para la malla seleccionada."
      maxWidth="max-w-5xl"
      onClose={onClose}
      headerActions={(
        <Button variant="ghost" size="sm" onClick={onClose} aria-label="Cerrar detalle">
          <X className="size-4" aria-hidden="true" />
        </Button>
      )}
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={record.estado === "Homogeneo" ? "success" : "danger"} className="rounded-full px-3 py-1">
            {record.estado}
          </Badge>
          <Badge variant="outline" className="rounded-full px-3 py-1">{record.dominanteClase}</Badge>
          <span className="text-sm text-muted-foreground">
            Límite inferior visible: {formatPercent(lowerLimitPct)}
          </span>
        </div>

        <KpiGrid columns={4}>
          <MetricTile label="Participación dominante" value={formatPercent(record.dominantePct)} hint={record.dominanteClase} accent={record.estado === "Homogeneo" ? "success" : "warning"} />
          <MetricTile label="Total apertura" value={formatInteger(record.totalApertura)} hint="Suma de categorías" />
          <MetricTile label="Tallos malla" value={record.tallosMalla === null ? "-" : formatInteger(record.tallosMalla)} hint="Referencia capturada" />
          <MetricTile label="Semana" value={formatIsoWeekLabel(record.isoWeekId)} hint={`${record.area} / ${record.spType}`} />
        </KpiGrid>

        <div className="grid gap-4 lg:grid-cols-[1fr_0.85fr]">
          <div className="rounded-[24px] border border-border/70 bg-background/70 p-4">
            <p className="mb-4 text-sm font-semibold">Participación por punto de apertura</p>
            <div className="space-y-3">
              {APERTURE_ROWS.map((entry) => {
                const pct = record.participacion[entry.key];
                const count = record.apertura[entry.key];
                const isDominant = entry.label === record.dominanteClase;
                return (
                  <div key={entry.key} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className={isDominant ? "font-semibold text-foreground" : "text-muted-foreground"}>{entry.label}</span>
                      <span className="font-medium">{formatPercent(pct)} · {formatInteger(count)} tallos</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className={isDominant ? "h-full rounded-full bg-emerald-500" : "h-full rounded-full bg-slate-400"}
                        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-[24px] border border-border/70 bg-background/70 p-4">
            <p className="mb-4 text-sm font-semibold">Contexto del registro</p>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <DetailItem label="Ciclo" value={record.ciclo} wide />
              <DetailItem label="Área" value={record.area} />
              <DetailItem label="Tipo SP" value={record.spType} />
              <DetailItem label="Año" value={record.year} />
              <DetailItem label="Mes" value={record.month} />
              <DetailItem label="Bloque" value={record.bloque} />
              <DetailItem label="Valor dominante" value={formatInteger(record.dominanteValor)} />
              <DetailItem label="Fecha" value={record.fecha} />
            </dl>
          </div>
        </div>
      </div>
    </DialogShell>
  );
}

function DetailItem({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? "col-span-2" : ""}>
      <dt className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words font-medium">{value || "-"}</dd>
    </div>
  );
}
