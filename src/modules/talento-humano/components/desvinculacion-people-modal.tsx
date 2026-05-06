"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";

import type { TalentoExitRecord } from "@/lib/talento-humano";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/shared/data-display/empty-state";
import { formatDateSlash, formatInteger, formatPercent } from "@/shared/lib/format";
import { DialogShell } from "@/shared/overlays/dialog-shell";
import { ClickableTableRow } from "@/shared/tables/clickable-table-row";
import { ScrollFadeTable } from "@/shared/tables/scroll-fade-table";
import { StandardTable, StandardTd, StandardTh } from "@/shared/tables/standard-table";
import { Input } from "@/shared/ui/input";
import { PersonInfoOverlay } from "@/modules/talento-humano/components/person-info-overlay";

function getComplianceTone(value: number | null) {
  if (value === null) return "neutral";
  if (value > 1) return "success";
  if (value >= 0.9) return "warning";
  return "danger";
}

function toneClass(tone: ReturnType<typeof getComplianceTone>) {
  if (tone === "success") return "text-[var(--color-chart-success-bold)]";
  if (tone === "warning") return "text-[var(--color-chart-warning)]";
  if (tone === "danger") return "text-[var(--color-chart-danger)]";
  return "text-muted-foreground";
}

export function ExitPeopleModal({
  title,
  rows,
  onClose,
}: {
  title: string;
  rows: TalentoExitRecord[];
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const [selectedPerson, setSelectedPerson] = useState<TalentoExitRecord | null>(null);

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) =>
      [row.personId, row.personName, row.nationalId, row.exitReason, row.resignationCategory]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term)),
    );
  }, [rows, search]);

  return (
    <>
      <DialogShell
        title={title}
        description={`${formatInteger(rows.length)} desvinculaciones`}
        onClose={onClose}
        maxWidth="max-w-6xl"
        headerActions={(
          <button
            type="button"
            onClick={onClose}
            className="rounded-[10px] p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Cerrar listado"
          >
            <X className="size-4" />
          </button>
        )}
      >
        <div className="space-y-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por nombre, ID, cedula o motivo..."
              className="pl-8"
            />
          </div>
          {filteredRows.length ? (
            <ScrollFadeTable>
              <StandardTable>
                <thead className="border-b border-border/70">
                  <tr>
                    <StandardTh>Persona</StandardTh>
                    <StandardTh>Fecha salida</StandardTh>
                    <StandardTh>Motivo</StandardTh>
                    <StandardTh>Categoria</StandardTh>
                    <StandardTh>Cumpl.</StandardTh>
                    <StandardTh>Obs.</StandardTh>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => (
                    <ClickableTableRow
                      key={`${row.personId}-${row.entryDate}-${row.exitDate}-${row.resignationCategory ?? "na"}`}
                      onSelect={() => setSelectedPerson(row)}
                      className="border-b border-border/50 last:border-0"
                    >
                      <StandardTd>
                        <div className="text-xs font-medium">{row.personName}</div>
                        <div className="text-[11px] text-muted-foreground">ID {row.personId}</div>
                      </StandardTd>
                      <StandardTd className="text-xs text-muted-foreground">{formatDateSlash(row.exitDate ?? row.lastExitDate)}</StandardTd>
                      <StandardTd className="max-w-[220px] truncate text-xs text-muted-foreground">
                        {row.exitReason ?? row.resignationReason ?? "-"}
                      </StandardTd>
                      <StandardTd className="max-w-[220px] truncate text-xs text-muted-foreground">
                        {row.resignationCategory ?? "-"}
                      </StandardTd>
                      <StandardTd className={cn("text-xs font-semibold tabular-nums", toneClass(getComplianceTone(row.cumplimiento)))}>
                        {formatPercent(row.cumplimiento, { input: "ratio" })}
                      </StandardTd>
                      <StandardTd className="max-w-[260px] truncate text-xs text-muted-foreground">{row.observations ?? "-"}</StandardTd>
                    </ClickableTableRow>
                  ))}
                </tbody>
              </StandardTable>
            </ScrollFadeTable>
          ) : (
            <EmptyState label="Sin resultados." />
          )}
        </div>
      </DialogShell>
      {selectedPerson ? (
        <PersonInfoOverlay
          personId={selectedPerson.personId}
          personName={selectedPerson.personName}
          onClose={() => setSelectedPerson(null)}
        />
      ) : null}
    </>
  );
}
