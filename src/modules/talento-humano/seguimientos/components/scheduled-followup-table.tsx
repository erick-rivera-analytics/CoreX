"use client";

import { useState } from "react";
import { FileDown } from "lucide-react";
import { formatDate } from "@/shared/lib/format";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { ScrollFadeTable } from "@/shared/tables/scroll-fade-table";
import { SortableHeader } from "@/shared/tables/sortable-header";
import { ClickableTableRow } from "@/shared/tables/clickable-table-row";
import { StandardTable, StandardTd } from "@/shared/tables/standard-table";
import { cn } from "@/lib/utils";
import type { EmployeeScheduledFollowupRow } from "@/modules/talento-humano/seguimientos/server/types";

type SortKey = "personName" | "areaName" | "followUpDate" | "derivedRoute" | "status";

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  registered: "Realizado",
};

const STATUS_VARIANTS: Record<string, "outline" | "success"> = {
  pending: "outline",
  registered: "success",
};

type Props = {
  rows: EmployeeScheduledFollowupRow[];
  selectedFollowup: EmployeeScheduledFollowupRow | null;
  onSelect: (row: EmployeeScheduledFollowupRow) => void;
  isLoading: boolean;
  exportUrl: string;
};

export function ScheduledFollowupTable({ rows, selectedFollowup, onSelect, isLoading, exportUrl }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("followUpDate");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [exporting, setExporting] = useState(false);

  function handleSort(key: string) {
    const typed = key as SortKey;
    if (sortKey === typed) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(typed);
      setSortDir("asc");
    }
  }

  async function handleExport() {
    setExporting(true);
    try {
      const res = await fetch(exportUrl);
      if (!res.ok) throw new Error("Error al generar el PDF.");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `agenda_seguimientos_${new Date().toISOString().slice(0, 10)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // silently fail — server error already logged
    } finally {
      setExporting(false);
    }
  }

  const sorted = [...rows].sort((a, b) => {
    const mul = sortDir === "asc" ? 1 : -1;
    const va = String(a[sortKey] ?? "");
    const vb = String(b[sortKey] ?? "");
    return va.localeCompare(vb) * mul;
  });

  return (
    <Card className="starter-panel border-border/70 bg-card/84">
      <CardHeader className="space-y-1">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-lg">Agenda de seguimientos</CardTitle>
            <CardDescription>
              {isLoading ? "Cargando agenda..." : `${rows.length} seguimiento(s) con los filtros actuales.`}
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={handleExport}
            disabled={exporting || rows.length === 0}
          >
            <FileDown className="mr-1.5 size-4" />
            {exporting ? "Generando..." : "Exportar PDF"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <ScrollFadeTable className="border border-border/70 bg-background/70" innerClassName="max-h-[calc(100dvh-19rem)] overflow-y-auto">
          <StandardTable>
          <thead>
            <tr>
              <SortableHeader label="Nombre" sortKey="personName" activeSortKey={sortKey} direction={sortDir} onSort={handleSort} />
              <SortableHeader label="Área" sortKey="areaName" activeSortKey={sortKey} direction={sortDir} onSort={handleSort} />
              <SortableHeader label="Fecha" sortKey="followUpDate" activeSortKey={sortKey} direction={sortDir} onSort={handleSort} />
              <SortableHeader label="Clasificación" sortKey="derivedRoute" activeSortKey={sortKey} direction={sortDir} onSort={handleSort} />
              <SortableHeader label="Estado" sortKey="status" activeSortKey={sortKey} direction={sortDir} onSort={handleSort} />
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => {
              const isSelected = selectedFollowup?.uniqueFollowUpCode === row.uniqueFollowUpCode
                && selectedFollowup?.personId === row.personId;
              return (
                <ClickableTableRow
                  key={`${row.uniqueFollowUpCode}::${row.personId}`}
                  onSelect={() => onSelect(row)}
                  className={cn("border-b border-border/60", isSelected && "bg-slate-900 text-white hover:bg-slate-900")}
                >
                  <StandardTd>
                    <p className="max-w-[18rem] truncate font-medium">{row.personName}</p>
                  </StandardTd>
                  <StandardTd className="text-xs text-muted-foreground">
                    <span className={cn("max-w-[14rem] truncate block", isSelected && "text-white/70")}>
                      {row.areaName ?? row.areaGeneral ?? "—"}
                    </span>
                  </StandardTd>
                  <StandardTd className="text-xs">
                    {formatDate(row.followUpDate)}
                  </StandardTd>
                  <StandardTd className="text-xs">
                    <Badge variant={isSelected ? "secondary" : "outline"}>{row.derivedRoute}</Badge>
                  </StandardTd>
                  <StandardTd className="text-xs">
                    <Badge variant={isSelected ? "secondary" : STATUS_VARIANTS[row.status] ?? "outline"}>
                      {STATUS_LABELS[row.status] ?? row.status}
                    </Badge>
                  </StandardTd>
                </ClickableTableRow>
              );
            })}
            {!sorted.length ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  No hay seguimientos con los filtros actuales.
                </td>
              </tr>
            ) : null}
          </tbody>
          </StandardTable>
        </ScrollFadeTable>
      </CardContent>
    </Card>
  );
}
