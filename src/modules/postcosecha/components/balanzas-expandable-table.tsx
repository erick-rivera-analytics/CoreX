"use client";

import { useMemo } from "react";

import { ExpandableTreeTable, type ExpandableTreeTableColumn, type TreeNode } from "@/shared/tables/expandable-tree-table";
import { ScrollFadeTable } from "@/shared/tables/scroll-fade-table";
import type { BalanzasNodeDetail } from "@/lib/postcosecha-balanzas";
import {
  aggregateBalanzasMetrics,
  buildBalanzasLeafMetrics,
  formatBalanzasTableMetric,
} from "@/modules/postcosecha/components/balanzas-table-metrics";

export type BalanzasGroupBy = "destination" | "grade" | "gradeGroup" | null;

type BalanzasRow = Record<string, unknown>;

type BalanzasNodeData = {
  /** Filas hoja agrupadas en este nodo (vacío para hojas individuales). */
  rowCount: number;
  /** Subtotales numéricos calculados por columna. */
  metrics: Record<string, number | null>;
  /** Si es hoja, esta es la fila cruda. */
  rawRow?: BalanzasRow;
};

const DATE_COLUMN_CANDIDATES = ["work_date", "lot_date", "fecha", "event_date"] as const;
const GROUP_BY_COLUMN: Record<Exclude<BalanzasGroupBy, null>, string[]> = {
  destination: ["destination", "destino"],
  grade: ["grade", "grado"],
  gradeGroup: ["grade_group", "grupo_grado", "gradeGroup"],
};

function findDateColumn(columns: BalanzasNodeDetail["columns"]) {
  for (const candidate of DATE_COLUMN_CANDIDATES) {
    if (columns.some((c) => c.key === candidate)) return candidate;
  }
  return null;
}

function findGroupByColumn(columns: BalanzasNodeDetail["columns"], groupBy: Exclude<BalanzasGroupBy, null>) {
  const candidates = GROUP_BY_COLUMN[groupBy];
  for (const candidate of candidates) {
    if (columns.some((c) => c.key === candidate)) return candidate;
  }
  return null;
}

function isoWeekFromDate(value: unknown): string | null {
  if (!value) return null;
  const raw = value instanceof Date ? value.toISOString().slice(0, 10) : String(value).trim();
  if (!raw) return null;
  const datePart = raw.includes("T") ? raw.split("T")[0] : raw;
  const match = datePart && /^(\d{4})-(\d{2})-(\d{2})$/.exec(datePart);
  if (!match) return null;
  const [, yyyy, mm, dd] = match;
  const date = new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd)));
  if (Number.isNaN(date.getTime())) return null;
  // ISO week (YYWW) compact format used elsewhere en CoreX.
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  const yyShort = String(date.getUTCFullYear()).slice(2);
  const wwPad = String(weekNo).padStart(2, "0");
  return `${yyShort}${wwPad}`;
}

function formatLeafCell(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "—";
    return value.toLocaleString("es-EC", { maximumFractionDigits: 4 });
  }
  const str = String(value);
  if (str === "" || str === "null" || str === "undefined" || str === "NaN") return "—";
  if (/^\d{4}-\d{2}-\d{2}T/.test(str)) return str.slice(0, 10);
  return str;
}

/**
 * Tabla expandible canónica para el detalle de Balanzas.
 *
 * Reemplaza la tabla plana actual de `balanzas-node-detail-sheet.tsx`.
 *
 * Jerarquía:
 * - Nivel 0: **Semana** (derivada del `work_date` / `lot_date` de cada fila)
 * - Nivel 1 (opcional): agrupación seleccionada por usuario (destination / grade / gradeGroup)
 * - Nivel 2 (o 1 si no hay agrupación): detalle transaccional con todas las columnas
 *
 * Subtotales (suma):
 * - Por nivel agrupador: sum de cada columna numérica del detail (B1 kg, B1A kg, etc.)
 * - Conteo de filas en cada nodo (vía `node.badge`)
 *
 * Reglas:
 * - Eliminar gráfico/cards visuales — la tabla es ahora la única visualización tabular del detalle
 * - Filtros del sheet padre (destino, grado, grupo, fecha) se aplican antes; este componente solo agrupa
 * - Si los datos no tienen columna de fecha utilizable, fallback a "Sin agrupación temporal"
 */
export function BalanzasExpandableTable({
  detail,
  groupBy,
  className,
}: {
  detail: BalanzasNodeDetail;
  groupBy: BalanzasGroupBy;
  className?: string;
}) {
  const dateColumn = useMemo(() => findDateColumn(detail.columns), [detail.columns]);
  const groupByColumn = useMemo(
    () => (groupBy ? findGroupByColumn(detail.columns, groupBy) : null),
    [detail.columns, groupBy],
  );
  const numericColumns = useMemo(() => detail.columns.filter((c) => c.numeric), [detail.columns]);

  const tree = useMemo<TreeNode<BalanzasNodeData>[]>(() => {
    if (!detail.rows.length) return [];

    // Agrupar por semana
    const weekBuckets = new Map<string, BalanzasRow[]>();
    for (const row of detail.rows) {
      const week = dateColumn ? isoWeekFromDate(row[dateColumn]) : null;
      const bucketKey = week ?? "Sin semana";
      const existing = weekBuckets.get(bucketKey);
      if (existing) existing.push(row);
      else weekBuckets.set(bucketKey, [row]);
    }

    const sortedWeeks = Array.from(weekBuckets.entries()).sort((a, b) => {
      if (a[0] === "Sin semana") return 1;
      if (b[0] === "Sin semana") return -1;
      return b[0].localeCompare(a[0]); // más reciente primero
    });

    return sortedWeeks.map(([weekKey, weekRows]) => {
      const weekMetrics = aggregateBalanzasMetrics(weekRows, numericColumns);
      const weekData: BalanzasNodeData = {
        rowCount: weekRows.length,
        metrics: weekMetrics,
      };

      let weekChildren: TreeNode<BalanzasNodeData>[];

      if (groupByColumn) {
        // Sub-agrupar por la columna seleccionada
        const subBuckets = new Map<string, BalanzasRow[]>();
        for (const row of weekRows) {
          const groupValue = row[groupByColumn];
          const groupKey = groupValue === null || groupValue === undefined || groupValue === ""
            ? "(sin valor)"
            : String(groupValue);
          const existing = subBuckets.get(groupKey);
          if (existing) existing.push(row);
          else subBuckets.set(groupKey, [row]);
        }

        weekChildren = Array.from(subBuckets.entries())
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([groupKey, groupRows]) => {
            const groupMetrics = aggregateBalanzasMetrics(groupRows, numericColumns);
            const groupData: BalanzasNodeData = {
              rowCount: groupRows.length,
              metrics: groupMetrics,
            };
            const leafChildren: TreeNode<BalanzasNodeData>[] = groupRows.map((row, idx) => ({
              id: `${weekKey}/${groupKey}/leaf-${idx}`,
              label: dateColumn ? formatLeafCell(row[dateColumn]) : `Fila ${idx + 1}`,
              data: { rowCount: 1, metrics: buildBalanzasLeafMetrics(row, numericColumns), rawRow: row },
              isLeaf: true,
            }));
            return {
              id: `${weekKey}/${groupKey}`,
              label: groupKey,
              data: groupData,
              badge: { label: `${groupRows.length} filas`, tone: "neutral" as const },
              children: leafChildren,
            };
          });
      } else {
        // Sin agrupación: hojas directas debajo de Semana
        weekChildren = weekRows.map((row, idx) => ({
          id: `${weekKey}/leaf-${idx}`,
          label: dateColumn ? formatLeafCell(row[dateColumn]) : `Fila ${idx + 1}`,
          data: { rowCount: 1, metrics: buildBalanzasLeafMetrics(row, numericColumns), rawRow: row },
          isLeaf: true,
        }));
      }

      return {
        id: `week/${weekKey}`,
        label: weekKey === "Sin semana" ? "Sin agrupación temporal" : `Semana ${weekKey}`,
        data: weekData,
        badge: { label: `${weekRows.length} filas`, tone: "info" as const },
        children: weekChildren,
      };
    });
  }, [detail.rows, dateColumn, groupByColumn, numericColumns]);

  const columns = useMemo<ExpandableTreeTableColumn<BalanzasNodeData>[]>(() => {
    const numericCols = detail.columns.filter((c) => c.numeric);
    const textCols = detail.columns.filter((c) => !c.numeric && c.key !== dateColumn);
    return [
      {
        key: "label",
        label: "Descripción",
        align: "left",
        cellClassName: "min-w-[220px]",
        headerClassName: "min-w-[220px]",
        render: (node, level) => (
          <span className={level === 0 ? "font-semibold text-foreground" : undefined}>
            {node.label}
          </span>
        ),
      },
      ...textCols.map<ExpandableTreeTableColumn<BalanzasNodeData>>((col) => ({
        key: col.key,
        label: col.label,
        align: "left",
        render: (node) => (node.data.rawRow ? formatLeafCell(node.data.rawRow[col.key]) : ""),
      })),
      ...numericCols.map<ExpandableTreeTableColumn<BalanzasNodeData>>((col) => ({
        key: col.key,
        label: col.label,
        align: "right",
        render: (node, level) => (
          <span className={level === 0 ? "font-semibold text-foreground" : undefined}>
            {formatBalanzasTableMetric(node.data.metrics[col.key] ?? null, col)}
          </span>
        ),
      })),
    ];
  }, [dateColumn, detail.columns]);

  return (
    <ScrollFadeTable className={className ?? "rounded-[16px] border border-border/70 bg-card"} innerClassName="tabular-nums" topScrollbar>
      <ExpandableTreeTable
        nodes={tree}
        columns={columns}
        defaultExpandLevel={0}
        indentPerLevel={20}
        tableClassName="min-w-[1280px]"
        withWrapper={false}
        emptyState="No hay filas para los filtros seleccionados."
      />
    </ScrollFadeTable>
  );
}
