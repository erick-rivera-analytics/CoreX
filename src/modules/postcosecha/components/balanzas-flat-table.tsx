"use client";

import type { BalanzasNodeDetail } from "@/lib/postcosecha-balanzas";
import { ScrollFadeTable } from "@/shared/tables/scroll-fade-table";
import { StandardTable, StandardTd, StandardTh } from "@/shared/tables/standard-table";
import { balanzasCellAccentClass, formatBalanzasTableMetric, formatBalanzasTextValue } from "@/modules/postcosecha/components/balanzas-table-metrics";

export function BalanzasFlatTable({ detail }: { detail: BalanzasNodeDetail }) {
  // Filtrar columnas helper (isHidden) — no se renderizan pero igual están
  // disponibles en detail.rows para que el agregado las pueda sumar.
  const visibleColumns = detail.columns.filter((c) => !c.isHidden);

  return (
    <ScrollFadeTable className="rounded-[16px] border border-border/70 bg-card" innerClassName="tabular-nums" topScrollbar>
      <StandardTable className="min-w-[920px]">
        <thead className="sticky top-0 z-10 bg-card">
          <tr className="border-b border-border/70">
            {visibleColumns.map((column) => (
              <StandardTh key={column.key} align={column.numeric ? "right" : "left"}>
                {column.label}
              </StandardTh>
            ))}
          </tr>
        </thead>
        <tbody>
          {detail.rows.map((row, rowIndex) => {
            const rowKey = visibleColumns
              .map((column) => `${column.key}:${String(row[column.key] ?? "")}`)
              .join("|") || `${detail.nodeKey}-row-${rowIndex}`;

            return (
              <tr key={rowKey} className="border-b border-border/60 last:border-b-0">
              {visibleColumns.map((column) => {
                const rawValue = row[column.key];
                const accentClass = column.numeric
                  ? balanzasCellAccentClass(rawValue, column)
                  : "";
                return (
                  <StandardTd
                    key={`${rowKey}-${column.key}`}
                    align={column.numeric ? "right" : "left"}
                    className={accentClass || undefined}
                  >
                    {column.numeric
                      ? formatBalanzasTableMetric(rawValue as number | null | undefined, column)
                      : formatBalanzasTextValue(rawValue)}
                  </StandardTd>
                );
              })}
              </tr>
            );
          })}
        </tbody>
      </StandardTable>
    </ScrollFadeTable>
  );
}
