"use client";

import type { BalanzasNodeDetail } from "@/lib/postcosecha-balanzas";
import { ScrollFadeTable } from "@/shared/tables/scroll-fade-table";
import { StandardTable, StandardTd, StandardTh } from "@/shared/tables/standard-table";
import { formatBalanzasTableMetric, formatBalanzasTextValue } from "@/modules/postcosecha/components/balanzas-table-metrics";

export function BalanzasFlatTable({ detail }: { detail: BalanzasNodeDetail }) {
  return (
    <ScrollFadeTable className="rounded-[16px] border border-border/70 bg-card" innerClassName="tabular-nums" topScrollbar>
      <StandardTable className="min-w-[920px]">
        <thead className="sticky top-0 z-10 bg-card">
          <tr className="border-b border-border/70">
            {detail.columns.map((column) => (
              <StandardTh key={column.key} align={column.numeric ? "right" : "left"}>
                {column.label}
              </StandardTh>
            ))}
          </tr>
        </thead>
        <tbody>
          {detail.rows.map((row, rowIndex) => {
            const rowKey = detail.columns
              .map((column) => `${column.key}:${String(row[column.key] ?? "")}`)
              .join("|") || `${detail.nodeKey}-row-${rowIndex}`;

            return (
              <tr key={rowKey} className="border-b border-border/60 last:border-b-0">
              {detail.columns.map((column) => (
                <StandardTd
                  key={`${rowKey}-${column.key}`}
                  align={column.numeric ? "right" : "left"}
                >
                  {column.numeric
                    ? formatBalanzasTableMetric(row[column.key] as number | null | undefined, column)
                    : formatBalanzasTextValue(row[column.key])}
                </StandardTd>
              ))}
              </tr>
            );
          })}
        </tbody>
      </StandardTable>
    </ScrollFadeTable>
  );
}
