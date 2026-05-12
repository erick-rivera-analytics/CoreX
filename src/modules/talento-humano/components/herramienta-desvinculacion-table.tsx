"use client";

import { useMemo, useState } from "react";

import type { DesvinculacionToolRow } from "@/lib/talento-humano-herramienta-desvinculacion";
import { SearchInput } from "@/shared/forms/search-input";
import { DetailSection } from "@/shared/layout/filter-panel";
import {
  formatInteger,
  formatIsoWeekLabel,
  formatPercent,
} from "@/shared/lib/format";
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
  | "pctHoursRend"
  | "pctHoursHn"
  | "rendimiento"
  | "rendimientoMin"
  | "cumplimiento";

const collator = new Intl.Collator("es-EC", { numeric: true, sensitivity: "base" });

function compareValue(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return collator.compare(String(a), String(b));
}

function pctHoursRend(row: DesvinculacionToolRow): number | null {
  return row.totalActualHours > 0 ? row.actualHoursRend / row.totalActualHours : null;
}

function pctHoursHn(row: DesvinculacionToolRow): number | null {
  return row.totalActualHours > 0 ? row.actualHoursHn / row.totalActualHours : null;
}

function rowSortValue(row: DesvinculacionToolRow, key: SortKey): string | number | null {
  switch (key) {
    case "personName": return row.personName;
    case "nationalId": return row.nationalId;
    case "areaName": return row.areaName ?? row.areaId;
    case "jobClassificationCode": return row.jobClassificationCode;
    case "pctHoursRend": return pctHoursRend(row);
    case "pctHoursHn": return pctHoursHn(row);
    case "rendimiento": return row.rendimiento;
    case "rendimientoMin": return row.rendimientoMin;
    case "cumplimiento": return row.cumplimiento;
    default: return null;
  }
}

function complianceVariant(value: number | null): "success" | "danger" | "secondary" | "outline" {
  if (value == null) return "outline";
  if (value >= 1) return "success";
  if (value >= 0.9) return "secondary";
  return "danger";
}

function formatRatioPct(value: number | null): string {
  return value == null
    ? "—"
    : formatPercent(value, {
      input: "ratio",
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
}

export function DesvinculacionDetailTable({
  rows,
  weekId,
  searchValue,
  onSearchChange,
  isValidating,
  selectedPersonId,
  onSelectPerson,
}: {
  rows: DesvinculacionToolRow[];
  weekId: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  isValidating: boolean;
  selectedPersonId: string | null;
  onSelectPerson: (personId: string) => void;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("cumplimiento");
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
    copy.sort((left, right) => compareValue(rowSortValue(left, sortKey), rowSortValue(right, sortKey)) * multiplier);
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
            {formatInteger(rows.length)} colaboradores con cumplimiento · semana {formatIsoWeekLabel(weekId)} · {isValidating ? "actualizando…" : "datos al día"}
          </p>
        </CardHeader>
        <CardContent>
          <ScrollFadeTable>
            <StandardTable className="w-full">
              <thead>
                <tr>
                  <SortableHeader label="Colaborador" sortKey="personName" activeSortKey={sortKey} direction={direction} onSort={handleSort} />
                  <SortableHeader label="Cédula" sortKey="nationalId" activeSortKey={sortKey} direction={direction} onSort={handleSort} />
                  <SortableHeader label="Área" sortKey="areaName" activeSortKey={sortKey} direction={direction} onSort={handleSort} />
                  <SortableHeader label="Clasif." sortKey="jobClassificationCode" activeSortKey={sortKey} direction={direction} onSort={handleSort} />
                  <SortableHeader label="H rend" sortKey="pctHoursRend" activeSortKey={sortKey} direction={direction} onSort={handleSort} align="right" />
                  <SortableHeader label="H norm" sortKey="pctHoursHn" activeSortKey={sortKey} direction={direction} onSort={handleSort} align="right" />
                  <SortableHeader label="Rendimiento" sortKey="rendimiento" activeSortKey={sortKey} direction={direction} onSort={handleSort} align="right" />
                  <SortableHeader label="Rend. mínimo" sortKey="rendimientoMin" activeSortKey={sortKey} direction={direction} onSort={handleSort} align="right" />
                  <SortableHeader label="Cumplimiento" sortKey="cumplimiento" activeSortKey={sortKey} direction={direction} onSort={handleSort} align="right" />
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((row) => (
                  <DesvinculacionRowItem
                    key={row.personId}
                    row={row}
                    isSelected={row.personId === selectedPersonId}
                    onSelect={onSelectPerson}
                  />
                ))}
              </tbody>
            </StandardTable>
          </ScrollFadeTable>
        </CardContent>
      </Card>
    </DetailSection>
  );
}

function DesvinculacionRowItem({
  row,
  isSelected,
  onSelect,
}: {
  row: DesvinculacionToolRow;
  isSelected: boolean;
  onSelect: (personId: string) => void;
}) {
  return (
    <tr
      role="button"
      tabIndex={0}
      onClick={() => onSelect(row.personId)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(row.personId);
        }
      }}
      className={`border-t border-border/60 cursor-pointer transition-colors ${
        isSelected ? "bg-primary/10 hover:bg-primary/15" : "hover:bg-muted/30"
      }`}
    >
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
      <StandardTd align="right">{formatRatioPct(pctHoursRend(row))}</StandardTd>
      <StandardTd align="right">{formatRatioPct(pctHoursHn(row))}</StandardTd>
      <StandardTd align="right">{formatRatioPct(row.rendimiento)}</StandardTd>
      <StandardTd align="right">{formatRatioPct(row.rendimientoMin)}</StandardTd>
      <StandardTd align="right">
        {row.cumplimiento == null ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <Badge variant={complianceVariant(row.cumplimiento)}>
            {formatPercent(row.cumplimiento, {
              input: "ratio",
              minimumFractionDigits: 1,
              maximumFractionDigits: 1,
            })}
          </Badge>
        )}
      </StandardTd>
    </tr>
  );
}
