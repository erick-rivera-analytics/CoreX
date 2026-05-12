"use client";

import { useMemo, useState } from "react";

import type { VacationSimulatorRow } from "@/lib/talento-humano-vacaciones";
import { SearchInput } from "@/shared/forms/search-input";
import { DetailSection } from "@/shared/layout/filter-panel";
import { formatDateSlash, formatInteger } from "@/shared/lib/format";
import { ScrollFadeTable } from "@/shared/tables/scroll-fade-table";
import { SortableHeader, type SortDirection } from "@/shared/tables/sortable-header";
import { StandardTable, StandardTd } from "@/shared/tables/standard-table";
import { Badge } from "@/shared/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";

type SortKey =
  | "personName"
  | "nationalId"
  | "areaName"
  | "jobClassificationCode"
  | "entryDate"
  | "tenureDays"
  | "diasAcumulados"
  | "diasTomados"
  | "diasDisponibles";

const collator = new Intl.Collator("es-EC", { numeric: true, sensitivity: "base" });

function compareValue(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return collator.compare(String(a), String(b));
}

function rowSortValue(row: VacationSimulatorRow, key: SortKey): string | number | null {
  switch (key) {
    case "personName":
      return row.personName;
    case "nationalId":
      return row.nationalId;
    case "areaName":
      return row.areaName ?? row.areaId;
    case "jobClassificationCode":
      return row.jobClassificationCode;
    case "entryDate":
      return row.entryDate;
    case "tenureDays":
      return row.tenureDays;
    case "diasAcumulados":
      return row.diasAcumulados;
    case "diasTomados":
      return row.diasTomados;
    case "diasDisponibles":
      return row.diasDisponibles;
    default:
      return null;
  }
}

function formatBadgeForDisponibles(value: number): "success" | "danger" | "outline" | "secondary" {
  if (value <= 0) return "outline";
  if (value >= 15) return "danger";
  if (value >= 8) return "secondary";
  return "success";
}

export function VacationDetailTable({
  rows,
  searchValue,
  onSearchChange,
  isValidating,
}: {
  rows: VacationSimulatorRow[];
  searchValue: string;
  onSearchChange: (value: string) => void;
  isValidating: boolean;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("personName");
  const [direction, setDirection] = useState<SortDirection>("asc");

  const handleSort = (key: string) => {
    if (key === sortKey) {
      setDirection((current) => (current === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key as SortKey);
      setDirection("asc");
    }
  };

  const sortedRows = useMemo(() => {
    const copy = [...rows];
    const multiplier = direction === "asc" ? 1 : -1;
    copy.sort((left, right) => {
      const result = compareValue(rowSortValue(left, sortKey), rowSortValue(right, sortKey));
      return result * multiplier;
    });
    return copy;
  }, [rows, sortKey, direction]);

  return (
    <DetailSection>
      <Card className="starter-panel border-border/70 bg-card/86">
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-lg font-semibold">Detalle por colaborador</CardTitle>
            <div className="w-full max-w-xs">
              <SearchInput
                value={searchValue}
                onChange={onSearchChange}
                placeholder="Buscar nombre, código o cédula..."
                ariaLabel="Buscar colaborador"
                debounceMs={220}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {formatInteger(rows.length)} colaboradores activos · {isValidating ? "actualizando…" : "datos al día"}
          </p>
        </CardHeader>
        <CardContent>
          <ScrollFadeTable topScrollbar>
            <StandardTable className="min-w-[1100px]">
              <thead>
                <tr>
                  <SortableHeader label="Colaborador" sortKey="personName" activeSortKey={sortKey} direction={direction} onSort={handleSort} />
                  <SortableHeader label="Cédula" sortKey="nationalId" activeSortKey={sortKey} direction={direction} onSort={handleSort} />
                  <SortableHeader label="Área" sortKey="areaName" activeSortKey={sortKey} direction={direction} onSort={handleSort} />
                  <SortableHeader label="Clasif." sortKey="jobClassificationCode" activeSortKey={sortKey} direction={direction} onSort={handleSort} />
                  <SortableHeader label="Ingreso" sortKey="entryDate" activeSortKey={sortKey} direction={direction} onSort={handleSort} />
                  <SortableHeader label="Antigüedad" sortKey="tenureDays" activeSortKey={sortKey} direction={direction} onSort={handleSort} align="right" />
                  <SortableHeader label="Acumulados" sortKey="diasAcumulados" activeSortKey={sortKey} direction={direction} onSort={handleSort} align="right" />
                  <SortableHeader label="Tomados" sortKey="diasTomados" activeSortKey={sortKey} direction={direction} onSort={handleSort} align="right" />
                  <SortableHeader label="Disponibles" sortKey="diasDisponibles" activeSortKey={sortKey} direction={direction} onSort={handleSort} align="right" />
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((row) => <VacationRowItem key={row.personId} row={row} />)}
              </tbody>
            </StandardTable>
          </ScrollFadeTable>
        </CardContent>
      </Card>
    </DetailSection>
  );
}

function VacationRowItem({ row }: { row: VacationSimulatorRow }) {
  return (
    <tr className="border-t border-border/60 hover:bg-muted/30">
      <StandardTd>
        <div className="flex flex-col">
          <span className="font-medium text-foreground">{row.personName}</span>
          <span className="text-xs text-muted-foreground">
            {row.personId}{row.jobTitle ? ` · ${row.jobTitle}` : ""}
          </span>
        </div>
      </StandardTd>
      <StandardTd>{row.nationalId ?? "—"}</StandardTd>
      <StandardTd>
        <div className="flex flex-col">
          <span>{row.areaName ?? row.areaId ?? "—"}</span>
          {row.areaGeneral ? (
            <span className="text-xs text-muted-foreground">{row.areaGeneral}</span>
          ) : null}
        </div>
      </StandardTd>
      <StandardTd>{row.jobClassificationCode ?? "—"}</StandardTd>
      <StandardTd>{formatDateSlash(row.entryDate)}</StandardTd>
      <StandardTd align="right">
        <div className="flex flex-col items-end">
          <span className="tabular-nums">{formatInteger(row.tenureDays)} d</span>
          {row.tenureLabel ? (
            <span className="text-xs text-muted-foreground">{row.tenureLabel}</span>
          ) : null}
        </div>
      </StandardTd>
      <StandardTd align="right">{formatInteger(row.diasAcumulados)}</StandardTd>
      <StandardTd align="right">{formatInteger(row.diasTomados)}</StandardTd>
      <StandardTd align="right">
        <Badge variant={formatBadgeForDisponibles(row.diasDisponibles)}>
          {formatInteger(row.diasDisponibles)}
        </Badge>
      </StandardTd>
    </tr>
  );
}
