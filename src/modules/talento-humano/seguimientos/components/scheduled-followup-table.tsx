"use client";

import { useState } from "react";
import { FileDown, Sheet } from "lucide-react";
import { toast } from "sonner";
import { formatDate, localDateString } from "@/shared/lib/format";
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
type PdfSortKey = "areaId" | "personName" | "followUpDate" | "derivedRoute" | "status";
type PdfSortRule = { key: PdfSortKey | ""; direction: "asc" | "desc" };

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  registered: "Realizado",
};

const STATUS_VARIANTS: Record<string, "outline" | "success"> = {
  pending: "outline",
  registered: "success",
};

const PDF_SORT_OPTIONS: Array<{ value: PdfSortKey; label: string }> = [
  { value: "areaId", label: "Cod. Area" },
  { value: "personName", label: "Nombre" },
  { value: "followUpDate", label: "Fecha" },
  { value: "derivedRoute", label: "Clasificacion" },
  { value: "status", label: "Estado" },
];

type Props = {
  rows: EmployeeScheduledFollowupRow[];
  selectedFollowup: EmployeeScheduledFollowupRow | null;
  onSelect: (row: EmployeeScheduledFollowupRow) => void;
  isLoading: boolean;
  exportUrl: string;
  exportXlsxUrl: string;
};

export function ScheduledFollowupTable({ rows, selectedFollowup, onSelect, isLoading, exportUrl, exportXlsxUrl }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("followUpDate");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [exporting, setExporting] = useState<"pdf" | "xlsx" | null>(null);
  const [pdfSortRules, setPdfSortRules] = useState<PdfSortRule[]>([
    { key: "", direction: "asc" },
    { key: "", direction: "asc" },
    { key: "", direction: "asc" },
  ]);

  function handleSort(key: string) {
    const typed = key as SortKey;
    if (sortKey === typed) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(typed);
      setSortDir("asc");
    }
  }

  function appendSortRules(exportEndpoint: URL) {
    pdfSortRules
      .filter((rule): rule is { key: PdfSortKey; direction: "asc" | "desc" } => Boolean(rule.key))
      .forEach((rule) => exportEndpoint.searchParams.append("sort", `${rule.key}:${rule.direction}`));
  }

  async function handleExportPdf() {
    setExporting("pdf");
    try {
      const exportEndpoint = new URL(exportUrl, window.location.origin);
      appendSortRules(exportEndpoint);

      const res = await fetch(exportEndpoint.toString(), { credentials: "same-origin" });
      if (!res.ok) throw new Error("Error al generar el PDF.");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `agenda_seguimientos_${localDateString()}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("No se pudo generar el PDF. Intente nuevamente.");
    } finally {
      setExporting(null);
    }
  }

  async function handleExportXlsx() {
    setExporting("xlsx");
    try {
      const exportEndpoint = new URL(exportXlsxUrl, window.location.origin);
      appendSortRules(exportEndpoint);

      const res = await fetch(exportEndpoint.toString(), { credentials: "same-origin" });
      if (!res.ok) throw new Error("Error al generar el XLSX.");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `agenda_seguimientos_${localDateString()}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("No se pudo generar el XLSX. Intente nuevamente.");
    } finally {
      setExporting(null);
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
          <div className="flex shrink-0 flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleExportPdf}
              disabled={Boolean(exporting) || rows.length === 0}
            >
              <FileDown className="mr-1.5 size-4" />
              {exporting === "pdf" ? "Generando..." : "Exportar PDF"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleExportXlsx}
              disabled={Boolean(exporting) || rows.length === 0}
            >
              <Sheet className="mr-1.5 size-4" />
              {exporting === "xlsx" ? "Generando..." : "Exportar XLSX"}
            </Button>
          </div>
        </div>
        <div className="grid gap-2 rounded-[16px] border border-border/60 bg-background/70 p-2 sm:grid-cols-3">
          {pdfSortRules.map((rule, index) => (
            <div key={index} className="grid min-w-0 grid-cols-[minmax(0,1fr)_88px] gap-2">
              <label className="sr-only" htmlFor={`pdf-sort-key-${index}`}>
                Orden PDF {index + 1}
              </label>
              <select
                id={`pdf-sort-key-${index}`}
                value={rule.key}
                onChange={(event) => {
                  const key = event.target.value as PdfSortKey | "";
                  setPdfSortRules((current) => current.map((item, itemIndex) => (
                    itemIndex === index ? { ...item, key } : item
                  )));
                }}
                className="h-9 min-w-0 rounded-[12px] border border-input bg-background px-3 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              >
                <option value="">{index === 0 ? "Orden PDF" : `Orden ${index + 1}`}</option>
                {PDF_SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <label className="sr-only" htmlFor={`pdf-sort-dir-${index}`}>
                Direccion PDF {index + 1}
              </label>
              <select
                id={`pdf-sort-dir-${index}`}
                value={rule.direction}
                onChange={(event) => {
                  const direction = event.target.value === "desc" ? "desc" : "asc";
                  setPdfSortRules((current) => current.map((item, itemIndex) => (
                    itemIndex === index ? { ...item, direction } : item
                  )));
                }}
                disabled={!rule.key}
                className="h-9 rounded-[12px] border border-input bg-background px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-55"
              >
                <option value="asc">Asc</option>
                <option value="desc">Desc</option>
              </select>
            </div>
          ))}
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
