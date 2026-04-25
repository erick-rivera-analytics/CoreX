"use client";

import { ChartSurface } from "@/shared/data-display/chart-surface";
import { ClickableTableRow } from "@/shared/tables/clickable-table-row";
import { InteractiveCell } from "@/shared/tables/interactive-cell";
import { ScrollFadeTable } from "@/shared/tables/scroll-fade-table";
import { formatInteger, formatPercent } from "@/shared/lib/format";

import {
  buildCompositionRows,
  buildCompositionSummaryRow,
  heatmapColor,
  type CompositionRow,
} from "@/modules/talento-humano/components/talento-view-utils";

export { buildCompositionRows };
export type { CompositionRow };

export function CompositionTable({
  title,
  dimensionLabel = "Variable",
  rows,
  asOfDate,
  onSelect,
}: {
  title: string;
  dimensionLabel?: string;
  rows: CompositionRow[];
  asOfDate: string;
  onSelect: (row: CompositionRow) => void;
}) {
  const total = rows.flatMap((row) => row.people);
  const totalRow = buildCompositionSummaryRow(total, asOfDate);

  return (
    <ChartSurface title={title}>
      <ScrollFadeTable>
        <table className="min-w-[1180px] w-full border-separate border-spacing-0 text-xs">
          <thead>
            <tr className="border-b border-border/30">
              <th rowSpan={2} className="sticky left-0 z-30 w-[210px] bg-card px-3 py-3 text-left text-xs font-semibold border-r border-border/40 align-bottom">{dimensionLabel}</th>
              <th rowSpan={2} className="sticky left-[210px] z-30 w-[120px] bg-card px-3 py-3 text-right text-xs font-semibold border-r-[2px] border-slate-700 dark:border-slate-200 align-bottom">Colaboradores</th>
              <th colSpan={5} className="border-l-[2px] border-l-slate-400 px-3 py-2.5 text-center text-[10px] font-semibold text-slate-600 dark:text-slate-300">Antiguedad</th>
              <th colSpan={2} className="border-l-[2px] border-l-slate-400 px-3 py-2.5 text-center text-[10px] font-semibold text-slate-600 dark:text-slate-300">Sexo</th>
              <th colSpan={7} className="border-l-[2px] border-l-slate-400 px-3 py-2.5 text-center text-[10px] font-semibold text-slate-600 dark:text-slate-300">Edad</th>
            </tr>
            <tr className="border-b-2 border-border/50">
              {totalRow.tenure.map((bucket, index) => (
                <th key={bucket.label} className={`px-2.5 py-2 text-center text-[10px] font-medium text-muted-foreground/80 whitespace-nowrap bg-slate-100/70 dark:bg-slate-800/60 ${index === 0 ? "border-l-[2px] border-l-slate-400" : ""}`}>{bucket.label}</th>
              ))}
              {totalRow.gender.map((bucket, index) => (
                <th key={bucket.label} className={`px-2.5 py-2 text-center text-[10px] font-medium text-muted-foreground/80 whitespace-nowrap bg-slate-100/70 dark:bg-slate-800/60 ${index === 0 ? "border-l-[2px] border-l-slate-400" : ""}`}>{bucket.label}</th>
              ))}
              {totalRow.age.map((bucket, index) => (
                <th key={bucket.label} className={`px-2.5 py-2 text-center text-[10px] font-medium text-muted-foreground/80 whitespace-nowrap bg-slate-100/70 dark:bg-slate-800/60 ${index === 0 ? "border-l-[2px] border-l-slate-400" : ""}`}>{bucket.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <CompositionTableRow key={row.label} row={row} rowIndex={rowIndex} onClick={() => onSelect(row)} />
            ))}
            <CompositionTableRow row={totalRow} rowIndex={-1} total onClick={() => onSelect(totalRow)} />
          </tbody>
        </table>
      </ScrollFadeTable>
    </ChartSurface>
  );
}

function CompositionTableRow({
  row,
  rowIndex,
  total,
  onClick,
}: {
  row: CompositionRow;
  rowIndex: number;
  total?: boolean;
  onClick: () => void;
}) {
  const stickyBg = total ? "bg-muted/40" : rowIndex % 2 === 0 ? "bg-card" : "bg-muted/[0.06]";
  const rowExtra = total ? "font-semibold border-t border-border/40" : "";
  const cell = "px-2.5 py-2 text-center text-[11px]";

  return (
    <ClickableTableRow onSelect={onClick} className={rowExtra}>
      <td className={`sticky left-0 z-10 ${stickyBg} px-3 py-2 text-left border-r border-border/30 group-hover:bg-primary/6`}>
        <InteractiveCell
          variant="underline-text"
          decorative
          label={<span className="text-left font-medium">{row.label}</span>}
        />
      </td>
      <td className={`sticky left-[210px] z-10 ${stickyBg} px-3 py-2 text-right border-r-[2px] border-slate-700 dark:border-slate-200 group-hover:bg-primary/6`}>
        <InteractiveCell
          variant="underline-text"
          decorative
          label={<span className="font-semibold tabular-nums">{formatInteger(row.people.length)}</span>}
        />
      </td>
      {row.tenure.map((bucket, index) => <HeatCell key={`tenure-${bucket.label}`} value={bucket.value} className={`${cell} ${index === 0 ? "border-l-[2px] border-l-slate-400" : ""}`} hue={215} />)}
      {row.gender.map((bucket, index) => <HeatCell key={`gender-${bucket.label}`} value={bucket.value} className={`${cell} ${index === 0 ? "border-l-[2px] border-l-slate-400" : ""}`} hue={165} />)}
      {row.age.map((bucket, index) => <HeatCell key={`age-${bucket.label}`} value={bucket.value} className={`${cell} ${index === 0 ? "border-l-[2px] border-l-slate-400" : ""}`} hue={40} />)}
    </ClickableTableRow>
  );
}

function HeatCell({ value, className, hue }: { value: number; className?: string; hue: number }) {
  return (
    <td className={className} style={{ backgroundColor: heatmapColor(value, hue) }}>
      <span className="tabular-nums text-[11px] font-medium text-foreground/88">{formatPercent(value, { input: "ratio" })}</span>
    </td>
  );
}
