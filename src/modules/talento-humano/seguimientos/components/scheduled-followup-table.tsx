"use client";

import { useState } from "react";
import { formatDate } from "@/shared/lib/format";
import { ScrollFadeTable } from "@/shared/tables/scroll-fade-table";
import { SortableHeader } from "@/shared/tables/sortable-header";
import type { EmployeeScheduledFollowupRow } from "@/modules/talento-humano/seguimientos/server/types";

type SortKey = "personName" | "followUpDate" | "derivedRoute" | "status";

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  registered: "Registrado",
  annulled: "Anulado",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "text-amber-600",
  registered: "text-green-600",
  annulled: "text-red-500",
};

type Props = {
  rows: EmployeeScheduledFollowupRow[];
  selectedFollowup: EmployeeScheduledFollowupRow | null;
  onSelect: (row: EmployeeScheduledFollowupRow) => void;
  isLoading: boolean;
};

export function ScheduledFollowupTable({ rows, selectedFollowup, onSelect, isLoading }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("followUpDate");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  function handleSort(key: string) {
    const typed = key as SortKey;
    if (sortKey === typed) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(typed);
      setSortDir("asc");
    }
  }

  const sorted = [...rows].sort((a, b) => {
    const mul = sortDir === "asc" ? 1 : -1;
    const va = String(a[sortKey] ?? "");
    const vb = String(b[sortKey] ?? "");
    return va.localeCompare(vb) * mul;
  });

  return (
    <div className="rounded-lg border bg-card">
      <div className="border-b px-4 py-3 text-sm font-medium text-muted-foreground">
        {isLoading ? "Cargando..." : `${rows.length} seguimiento(s)`}
      </div>
      <ScrollFadeTable>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40">
              <SortableHeader label="Persona" sortKey="personName" activeSortKey={sortKey} direction={sortDir} onSort={handleSort} />
              <SortableHeader label="Fecha" sortKey="followUpDate" activeSortKey={sortKey} direction={sortDir} onSort={handleSort} />
              <SortableHeader label="Ruta" sortKey="derivedRoute" activeSortKey={sortKey} direction={sortDir} onSort={handleSort} />
              <SortableHeader label="Estado" sortKey="status" activeSortKey={sortKey} direction={sortDir} onSort={handleSort} />
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => {
              const isSelected = selectedFollowup?.uniqueFollowUpCode === row.uniqueFollowUpCode
                && selectedFollowup?.personId === row.personId;
              return (
                <tr
                  key={`${row.uniqueFollowUpCode}::${row.personId}`}
                  className={`cursor-pointer border-b transition-colors hover:bg-muted/30 ${isSelected ? "bg-muted/60 font-medium" : ""}`}
                  onClick={() => onSelect(row)}
                >
                  <td className="px-4 py-2">
                    <p className="font-medium">{row.personName}</p>
                    <p className="text-xs text-muted-foreground">{row.areaName ?? row.areaGeneral ?? "—"}</p>
                  </td>
                  <td className="px-4 py-2 text-xs">
                    {formatDate(row.followUpDate)}
                  </td>
                  <td className="px-4 py-2 text-xs font-mono">{row.derivedRoute}</td>
                  <td className={`px-4 py-2 text-xs font-medium ${STATUS_COLORS[row.status] ?? ""}`}>
                    {STATUS_LABELS[row.status] ?? row.status}
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
